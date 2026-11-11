"""Synthetic, real-provider scoring calibration. Never reads account interview data."""
from pathlib import Path
import sys
from uuid import uuid5, NAMESPACE_DNS
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
from app.ai.provider import GroqProvider
from app.ai.interview_grading import evaluate
from app.core.errors import ProviderError
import json
import argparse
import time

QUESTIONS = [
    'In Python, how do lists and tuples differ, and when would you choose each?',
    'What is the difference between HTTP 401 and HTTP 403?',
    'How do parameterized SQL queries prevent SQL injection?',
    'What does atomicity mean in a database transaction, and what happens when an operation fails?',
]
SUITE_VERSION = 'phase4-synthetic-v1'
CASES = {
    'vague': ['I would follow best practices and choose the right approach depending on the requirements. It is important that everything works well and remains efficient.']*4,
    'incorrect': ['Tuples are mutable and lists are immutable, so tuples are best when you need to append values.',
        '401 means the server crashed, while 403 means the page was not found.',
        'I concatenate the user input into SQL and encrypt it. Encryption makes the SQL injection safe.',
        'Atomicity means each database write commits independently. If one fails, previous writes stay committed and rollback makes queries faster.'],
    'strong': ['Lists are mutable sequences; tuples are immutable sequences. I use a list for a collection that changes, and a tuple for a fixed record. A tuple is hashable only if its elements are hashable, which matters for dictionary keys.',
        '401 means valid authentication credentials are missing or rejected; the client should authenticate. 403 means the server refuses authorization, such as a signed-in user lacking permission. Retrying the same credentials does not grant that permission.',
        'I pass values separately from SQL text using the database driver parameter API, such as cursor.execute("SELECT id FROM users WHERE email=%s", (email,)). The driver treats the value as data rather than executable SQL. Dynamic identifiers need a separate allowlist or identifier quoting.',
        'Atomicity makes a transaction all-or-nothing. For a transfer, both the debit and credit commit together; if either fails, I roll back the transaction so neither change persists. In PostgreSQL an error typically leaves the transaction aborted until rollback; using a transaction context ensures rollback on exceptions.'],
    'partial': ['Lists can change and tuples cannot.', '401 needs login; 403 is forbidden.', 'Parameters separate values from SQL.', 'Atomic means all or nothing.'],
    'off_topic': ['I enjoy hiking and making tea.']*4,
    'filler': ['Best practices. Best practices. Best practices.']*4,
    'transcription_errors': ['Lists are mutable sequences and too pulls are immutable sequences.', 'Four oh one means missing authentication; four oh three is missing authorization.', 'Pass values separately so they are data and never sequel commands.', 'A transaction is all or nothing. If a debit or credit fails, roll back both.'],
    'unanswered': [None]*4,
}

def context(case):
    return {'configuration': {'role':'Backend Engineer','type':'Technical','difficulty':'Medium','duration':20,
        'mode':'Spoken','language':'Python','resume_id':None},
        'history':[{'id':str(uuid5(NAMESPACE_DNS,'mockmate-calibration-'+str(i))), 'position':i,
            'prompt':q,'topic':'Backend fundamentals','answer':a} for i,(q,a) in enumerate(zip(QUESTIONS,CASES[case]))]}

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--case',choices=list(CASES),action='append')
    args=parser.parse_args()
    failed = False
    for case in args.case or list(CASES):
        for attempt in range(2):
            try:
                report=evaluate(GroqProvider(),context(case))
                passed=report.overall<=35 if case in ('vague','off_topic','filler') else report.overall<=25 if case=='incorrect' else report.overall>=75 if case=='strong' else report.overall==0 if case=='unanswered' else True
                print(json.dumps({'suite_version':SUITE_VERSION,'case':case,'attempt':attempt+1,'overall':report.overall,'question_scores':[q.score for q in report.questions],
                    'rubric_version':report.rubric_version,'calibration_pass':passed,'feedback':[q.feedback for q in report.questions]}),flush=True)
                failed |= not passed
                break
            except ProviderError as exc:
                print(json.dumps({'suite_version':SUITE_VERSION,'case':case,'attempt':attempt+1,'not_verified':exc.message}),flush=True)
                if 'rate limit' in exc.message.lower():
                    # Stop the evaluation; further calls would only spend unavailable capacity.
                    raise SystemExit(2)
                if attempt == 1:
                    failed = True
                else:
                    time.sleep(exc.retry_after)
        time.sleep(2)
    raise SystemExit(1 if failed else 0)
