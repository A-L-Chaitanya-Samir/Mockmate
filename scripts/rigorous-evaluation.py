"""Small synthetic real-model evaluation. Appends safe evidence; stops on throttling."""
import argparse
import hashlib
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import time
from uuid import uuid5, NAMESPACE_DNS
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from app.ai.provider import GroqProvider
from app.ai.interview_grading import evaluate, VERSION, TASK
from app.ai.interview_prompts import QUESTION_TASK, RESPONSE_TASK, validate_questions
from app.core.config import settings
from app.core.errors import ProviderError
from app.modules.schemas import Questions, Response

fixture = json.loads(Path('backend/app/ai/calibration-v2.json').read_text())
parser = argparse.ArgumentParser()
parser.add_argument('--questions', action='store_true', help='Also make one question-generation and one follow-up request')
parser.add_argument('--output', default='docs/rigorous-evaluation-results.jsonl')
parser.add_argument('--case', action='append', choices=list(fixture['cases']))
args = parser.parse_args()


def record(result):
    item = dict(recorded_at=datetime.now(timezone.utc).isoformat(), suite_version=fixture['version'],
                rubric_version=VERSION, policy_hash=hashlib.sha256(TASK.encode()).hexdigest()[:12], model=settings().groq_model) | result
    with Path(args.output).open('a', encoding='utf-8') as output:
        output.write(json.dumps(item, ensure_ascii=False)+'\n')
    print(json.dumps(item, ensure_ascii=False), flush=True)


try:
    # Six questions maximum per report. Two requests assess all categories, including
    # previously unverified filler and transcription-error cases. No retries on quota errors.
    groups = [['excellent', 'incorrect', 'off_topic', 'filler', 'transcription_errors'],
              ['competent', 'borderline', 'weak', 'unanswered']]
    if args.case:
        groups = [args.case[i:i+6] for i in range(0, len(args.case), 6)]
    for group in groups:
        history = [dict(id=str(uuid5(NAMESPACE_DNS, fixture['version']+case)), position=i,
            prompt=fixture['question'], topic='Transactions', answer=fixture['cases'][case]) for i, case in enumerate(group)]
        report = evaluate(GroqProvider(), dict(configuration=fixture['configuration'], history=history))
        for case, question in zip(group, report.questions):
            record(dict(case=case, question=fixture['question'], answer=fixture['cases'][case],
                score=question.score, criteria=question.rubric.model_dump(), feedback=question.feedback,
                evidence=question.evidence, kind='quality_observation'))
        time.sleep(45)  # Leave free-tier token headroom; do not hammer the provider.
    if args.questions:
        context = dict(configuration=fixture['configuration'] | {'duration': 20}, history=[])
        questions = validate_questions(GroqProvider().generate(QUESTION_TASK, context, Questions))
        record(dict(kind='generated_questions', configuration=context['configuration'], result=questions.model_dump()))
        time.sleep(45)
        context['history'] = [dict(id='calibration-current', prompt=fixture['question'], answer=fixture['cases']['borderline'])]
        context['current_question_id'] = 'calibration-current'
        follow_up = GroqProvider().generate(RESPONSE_TASK, context, Response)
        record(dict(kind='adaptive_follow_up', question=fixture['question'], answer=fixture['cases']['borderline'], result=follow_up.model_dump()))
except ProviderError as error:
    record(dict(kind='unverified', reason=error.message))
    raise SystemExit(2)
