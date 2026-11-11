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
    assert report.rubric_version=='transcript-v2'
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
