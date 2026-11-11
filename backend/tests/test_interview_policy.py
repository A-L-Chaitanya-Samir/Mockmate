import json
from pathlib import Path
from uuid import uuid5, NAMESPACE_DNS
import pytest
from app.ai.interview_prompts import validate_questions
from app.ai.interview_grading import report_from_marks, evaluate, VERSION
from app.modules.schemas import Questions, InterviewEvaluation, InterviewCreate
from app.core.errors import ProviderError

FIXTURE = json.loads((Path(__file__).parents[1] / 'app/ai/calibration-v2.json').read_text())


def test_generation_rejects_reworded_duplicate_punctuation():
    result = Questions(questions=[{'prompt': p, 'topic': 'Transactions'} for p in
        ['Explain atomicity.', 'Explain atomicity!', 'Describe rollback.', 'Test a failed transfer.']])
    with pytest.raises(ProviderError): validate_questions(result)


def test_seniority_is_bounded_and_defaults_for_legacy_inputs():
    cfg = dict(role='Backend engineer', type='Technical', difficulty='Medium', duration=20)
    assert InterviewCreate(**cfg).seniority == 'Mid-level'
    assert InterviewCreate(**cfg, seniority='Senior').seniority == 'Senior'
    with pytest.raises(ValueError): InterviewCreate(**cfg, seniority='Override grading')


def test_authored_calibration_arithmetic_order_and_full_marks_are_possible():
    reports = {}
    for case, answer in FIXTURE['cases'].items():
        question_id = uuid5(NAMESPACE_DNS, 'rigorous-'+case)
        marks = FIXTURE['benchmark_marks'][case]
        evaluation = InterviewEvaluation(questions=[{'question_id': question_id,
            'rubric': dict(zip(['correctness_relevance', 'reasoning_evidence', 'clarity_structure'], marks)),
            'evidence': answer, 'feedback': 'Calibration anchor for the requested mechanism and failure check.'}],
            strengths=[], improvements=[], recommendations=[])
        reports[case] = report_from_marks(evaluation, [{'id': question_id, 'prompt': FIXTURE['question'], 'answer': answer}])
    assert reports['excellent'].overall == 100  # no imposed ceiling/blanket reduction
    assert reports['competent'].overall == 85
    assert reports['borderline'].overall == 55
    assert reports['excellent'].overall > reports['competent'].overall > reports['borderline'].overall > reports['weak'].overall
    assert reports['incorrect'].overall == reports['off_topic'].overall == reports['filler'].overall == 0
    assert reports['unanswered'].answered == 0
    assert reports['transcription_errors'].overall == 84
    assert all(r.rubric_version == VERSION for r in reports.values())


def test_grader_receives_role_seniority_question_but_no_observation_configuration():
    question_id = uuid5(NAMESPACE_DNS, 'context-calibration')
    answer = FIXTURE['cases']['competent']
    class Inspect:
        def generate(self, task, content, schema):
            assert content['configuration'] == FIXTURE['configuration']
            assert content['history'][0]['prompt'] == FIXTURE['question']
            return InterviewEvaluation(questions=[{'question_id': question_id,
                'rubric': dict(correctness_relevance=85, reasoning_evidence=85, clarity_structure=85),
                'evidence': answer, 'feedback': 'Concrete rollback and balance verification.'}], strengths=[], improvements=[], recommendations=[])
    report = evaluate(Inspect(), {'configuration': FIXTURE['configuration'] | {'phone_vision': True, 'confidence': 'high'},
        'history': [{'id': question_id, 'prompt': FIXTURE['question'], 'answer': answer, 'face_count': 2}]})
    assert report.overall == 85


def test_submitted_filler_cannot_be_reported_as_missing_answer():
    question_id = uuid5(NAMESPACE_DNS, 'submitted-filler')
    evaluation = InterviewEvaluation(questions=[{'question_id': question_id,
        'rubric': dict(correctness_relevance=0, reasoning_evidence=0, clarity_structure=0),
        'evidence': None, 'feedback': 'Unanswered: repeats generic best practices instead of explaining rollback.'}],
        strengths=[], improvements=[], recommendations=[])
    report = report_from_marks(evaluation, [{'id': question_id, 'prompt': FIXTURE['question'], 'answer': FIXTURE['cases']['filler']}])
    assert report.answered == 1 and report.overall == 0
    assert report.questions[0].feedback.startswith('Nonresponsive:')


def test_pre_seniority_creation_key_retry_keeps_original_resource_and_charge(client):
    from uuid import uuid4
    from app.core.db import transaction
    key = str(uuid4())
    data = dict(role='Backend engineer', type='Technical', difficulty='Medium', duration=20)
    first = client.post('/api/v1/interviews', json=data, headers={'Idempotency-Key': key})
    assert first.status_code == 202
    resource = first.json()['id']
    with transaction() as conn:
        conn.execute("UPDATE interview_sessions SET config=config-'seniority' WHERE id=%s", (resource,))
    retry = client.post('/api/v1/interviews', json=data, headers={'Idempotency-Key': key})
    assert retry.status_code == 202 and retry.json()['id'] == resource
    assert client.get('/api/v1/capabilities').json()['interview']['reserved'] == 1
    assert client.post('/api/v1/interviews', json=data | {'seniority': 'Senior'}, headers={'Idempotency-Key': key}).status_code == 409
