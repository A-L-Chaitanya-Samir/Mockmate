from uuid import uuid4
import pytest
from pydantic import ValidationError
from app.ai.interview_grading import report_from_marks, evaluate
from app.modules.schemas import InterviewEvaluation, QuestionMark
from app.core.errors import ProviderError


def sample(answer='I use transactions to preserve atomicity.'):
    question={'id':str(uuid4()),'prompt':'Explain atomicity.','answer':answer}
    mark={'question_id':question['id'],'rubric':{'correctness_relevance':80,'reasoning_evidence':60,'clarity_structure':100},
        'evidence':answer if answer else None,'feedback':'The answer identifies transactions but should explain all-or-nothing rollback.'}
    return question,mark


def grade(history,marks):
    return report_from_marks(InterviewEvaluation(questions=marks,strengths=[],improvements=[],recommendations=[]),history)


def test_totals_are_computed_from_criteria_and_all_questions():
    answered,mark=sample();unanswered,missing=sample(None)
    # Ignore hallucinated credit and praise for an absent transcript.
    missing['evidence']='Invented answer';missing['feedback']='Great explanation.'
    report=grade([answered,unanswered],[missing,mark])
    assert report.questions[0].score==78 # 80*.4 + 60*.35 + 100*.25
    assert report.questions[1].score==0 and 'Unanswered' in report.questions[1].feedback
    assert report.overall==39 and report.answered==1 and report.total_questions==2
    assert report.rubric_version=='transcript-v4-isolated'
    assert [d.score for d in report.scores]==[40,30,50]


@pytest.mark.parametrize('change',['missing','duplicate','foreign','invented_evidence','no_evidence'])
def test_grading_rejects_unmatched_ids_and_ungrounded_credit(change):
    q,mark=sample();marks=[mark]
    if change=='missing':marks=[]
    elif change=='duplicate':marks=[mark,mark]
    elif change=='foreign':mark['question_id']=str(uuid4())
    elif change=='invented_evidence':mark['evidence']='I implemented a billion transactions per second.'
    else:mark['evidence']=None
    with pytest.raises((ProviderError,ValidationError)):grade([q],marks)


def test_empty_session_requires_no_provider_and_has_no_invented_strengths():
    class NoProvider:
        def generate(self,*args):raise AssertionError('Unanswered questions do not require an AI score')
    q,_=sample(None)
    report=evaluate(NoProvider(),{'history':[q]})
    assert report.overall==0 and report.strengths==[] and report.answered==0


def test_evidence_preserves_actual_answer_and_not_a_paraphrase():
    q,mark=sample('I use transactions\n to preserve atomicity.')
    mark['evidence']='transactions to preserve atomicity'
    assert grade([q],[mark]).questions[0].evidence=='transactions\n to preserve atomicity'


def test_out_of_range_model_marks_fail_validation():
    q,mark=sample();mark['rubric']['correctness_relevance']=101
    with pytest.raises(ValidationError):QuestionMark.model_validate(mark)


def test_observations_never_enter_model_context_or_change_marks():
    q, mark = sample()
    class InspectProvider:
        def generate(self, task, content, schema):
            assert set(content) == {'configuration', 'history'}
            assert 'integrity' not in content['history'][0]
            return InterviewEvaluation(questions=[mark], strengths=[], improvements=[], recommendations=[])
    context = {'history': [q | {'integrity': 'phone visible'}], 'integrity': {'tab_switches': 100}}
    report = evaluate(InspectProvider(), context)
    assert report.overall == grade([q], [mark]).overall


def test_each_answer_is_isolated_and_summary_keeps_question_attribution():
    first, first_mark = sample('I use a transaction with rollback and verify both balances.')
    second, second_mark = sample('I role back changes, but I do not know how to verify them.')
    missing, _ = sample(None)
    seen = []
    class IsolatedProvider:
        def generate(self, task, content, schema):
            assert len(content['history']) == 1
            current = content['history'][0]
            seen.append(current['id'])
            mark = first_mark if current['id'] == first['id'] else second_mark
            assert content['configuration'] == {'role': 'Backend engineer', 'seniority': 'Junior', 'difficulty': 'Medium'}
            assert set(current) == {'id', 'prompt', 'answer'}
            assert current['answer'] == (first if current['id'] == first['id'] else second)['answer']
            return InterviewEvaluation(questions=[mark], strengths=[current['answer']],
                improvements=[], recommendations=['Explain the requested verification.'])
    report = evaluate(IsolatedProvider(), {'configuration': {'role': 'Backend engineer',
        'seniority': 'Junior', 'difficulty': 'Medium', 'phone_vision': True},
        'history': [first | {'original_transcript': 'wrong transcript', 'integrity': 'phone'}, second, missing]})
    assert seen == [first['id'], second['id']]
    assert report.strengths == ['Question 1: ' + first['answer'], 'Question 2: ' + second['answer']]
    assert report.questions[0].evidence == first['answer']
    assert 'role back' not in report.questions[0].feedback
    assert report.answered == 2 and report.total_questions == 3


@pytest.mark.parametrize('failure', ['other_answer_quote', 'other_question_id', 'extra_question'])
def test_isolated_result_rejects_cross_answer_attribution_before_next_call(failure):
    first, mark = sample('I verify rollback using an injected failure.')
    second, other = sample('Unique wording belonging only to the other answer.')
    calls = []
    class WrongProvider:
        def generate(self, task, content, schema):
            calls.append(content)
            if failure == 'other_answer_quote': mark['evidence'] = second['answer']
            if failure == 'other_question_id': mark['question_id'] = second['id']
            return InterviewEvaluation(questions=[mark, other] if failure == 'extra_question' else [mark],
                strengths=[], improvements=[], recommendations=[])
    with pytest.raises(ProviderError):
        evaluate(WrongProvider(), {'history': [first, second]})
    assert len(calls) == 1


def test_isolation_keeps_full_credit_and_half_up_rounding_without_extra_calls():
    question, mark = sample('A transaction commits all changes together or rolls them back.')
    mark['rubric'] = dict(correctness_relevance=100, reasoning_evidence=100, clarity_structure=100)
    class FullCredit:
        def generate(self, task, content, schema):
            return InterviewEvaluation(questions=[mark], strengths=[], improvements=[], recommendations=[])
    report = evaluate(FullCredit(), {'history': [question]})
    assert report.overall == 100
    mark['rubric'] = dict(correctness_relevance=0, reasoning_evidence=0, clarity_structure=2)
    assert evaluate(FullCredit(), {'history': [question]}).overall == 1


@pytest.mark.parametrize('field', ['feedback', 'strengths', 'improvements', 'recommendations'])
def test_quotes_in_feedback_and_summaries_must_belong_to_this_answer(field):
    q, mark = sample('I use a transaction and inject a failure to check rollback.')
    payload = dict(questions=[mark], strengths=[], improvements=[], recommendations=[])
    if field == 'feedback': mark['feedback'] = 'You said "role back" in this answer.'
    else: payload[field] = ['You said "role back" in this answer.']
    class InventedQuote:
        def generate(self, task, content, schema): return InterviewEvaluation(**payload)
    with pytest.raises(ProviderError): evaluate(InventedQuote(), {'history': [q]})


def test_feedback_accepts_a_real_quote_with_normalized_whitespace():
    q, mark = sample('I use a transaction\nand check rollback.')
    mark['feedback'] = 'You said "transaction and check rollback"; describe a failure injection.'
    assert grade([q], [mark]).questions[0].score == 78
