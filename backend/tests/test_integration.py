from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
import os
import pytest
from psycopg.errors import ForeignKeyViolation, InsufficientPrivilege
from app.core.auth import identity
from app.core.config import settings
from app.core.db import transaction, owned
from app.core.errors import AppError, ProviderError
from app.main import app
from app.modules import service
from app.modules.schemas import Analysis, Questions, Response, Report
from app.workers.runner import Worker, claim
from test_core import pdf


class MemoryStorage:
    def __init__(self): self.files = {}
    def upload(self, path, data): self.files[path] = data
    def download(self, path): return self.files[path]
    def delete(self, path): self.files.pop(path, None)


class DeterministicProvider:
    def __init__(self): self.calls = []
    def generate(self, task, content, schema):
        self.calls.append((task, content, schema))
        if schema == Analysis:
            return Analysis(score=64, skills=['Python'], strengths=['The resume explicitly identifies Python experience.'],
                improvements=['Describe one verified project outcome.'], structure='Readable experience section.', readability='Readable text.', missing_information=['Project outcomes'],
                evidence=[{'quote':'Python engineer','feedback':'Explicit skill evidence.'}], role_relevance=content['target_role'] or 'No target role supplied.')
        if schema == Questions:
            cfg = content['configuration']
            return Questions(questions=[{'prompt':f"{cfg['difficulty']} {cfg['type']} question {i} for {cfg['role']} in {cfg['language']}", 'topic':cfg['type']} for i in range(4)])
        if schema == Response:
            return Response(message='You gave a relevant example. Explain the trade-offs next time.', follow_up='What trade-off did you consider?')
        if schema == Report:
            history = content['history']
            return Report(overall=66, scores=[{'skill':'Text clarity','score':66}], strengths=['Relevant examples.'], improvements=['Explain trade-offs.'], recommendations=['Practice giving evidence for each decision.'],
                questions=[{'question_id':str(q['id']),'score':66 if q['answer'] else 0,'feedback':f"Answer received: {q['answer'] or 'Unanswered'}"} for q in history])
        raise AssertionError(schema)


def create(client, key=None):
    return client.post('/api/v1/interviews', headers={'Idempotency-Key':key or str(uuid4())}, json={'role':'Backend Engineer','type':'Technical','difficulty':'Hard','duration':20,'mode':'Text','language':'Python'})


def test_pdf_to_private_file_analysis_history_and_delete(client, accounts):
    provider, storage = DeterministicProvider(), MemoryStorage()
    worker = Worker(provider, storage)
    key = str(uuid4())
    binary = pdf()
    def upload():
        return client.post('/api/v1/resumes', headers={'Idempotency-Key':key}, files={'file':('resume.pdf',binary,'application/pdf')}, data={'target_role':'Python Engineer'})
    result = upload()
    assert result.status_code == 202, result.text
    resource = result.json()['id']
    assert upload().json()['id'] == resource
    assert worker.run_once()
    result = client.get(f'/api/v1/resumes/{resource}').json()
    assert result['status'] == 'ready'
    assert 'Python' in result['analysis']['skills']
    assert 'Python engineer' in provider.calls[0][1]['resume_text']
    assert len(storage.files) == 1
    assert client.get('/api/v1/workspace').json()['resumes'][0] == result
    assert client.delete(f'/api/v1/resumes/{resource}').status_code == 202
    assert worker.run_once()
    assert not storage.files
    assert client.get(f'/api/v1/resumes/{resource}').status_code == 404
    with transaction() as conn:
        assert conn.execute('SELECT count(*) n FROM resume_analyses').fetchone()['n'] == 0
        assert conn.execute("SELECT count(*) n FROM usage_reservations WHERE state='consumed'").fetchone()['n'] == 1  # Deletion does not reset usage.


def test_actual_questions_answers_context_report_and_idempotency(client, accounts):
    provider = DeterministicProvider(); worker = Worker(provider, MemoryStorage())
    key = str(uuid4()); created = create(client,key)
    assert created.status_code == 202, created.text
    resource = created.json()['id']
    assert create(client,key).json()['id'] == resource
    worker.run_once()
    session = client.get(f'/api/v1/interviews/{resource}').json()
    assert session['status'] == 'active'
    assert 'Hard Technical' in session['questions'][0]['prompt']
    q = session['questions'][0]['id']; answer_key = str(uuid4())
    payload = {'question_id':q, 'text':'I built a Python API and selected explicit database transactions for consistency.'}
    result = client.post(f'/api/v1/interviews/{resource}/answers',headers={'Idempotency-Key':answer_key},json=payload)
    assert result.status_code == 202, result.text
    assert client.post(f'/api/v1/interviews/{resource}/answers',headers={'Idempotency-Key':answer_key},json=payload).status_code == 202
    worker.run_once()
    session = client.get(f'/api/v1/interviews/{resource}').json()
    assert len(session['questions']) == 5
    assert session['questions'][0]['response']['message']
    assert client.post(f'/api/v1/interviews/{resource}/complete').status_code == 202
    assert client.post(f'/api/v1/interviews/{resource}/complete').status_code == 202
    worker.run_once()
    saved = client.get(f'/api/v1/interviews/{resource}').json()
    assert saved['status'] == 'completed'
    assert payload['text'] in saved['report']['questions'][0]['feedback']
    evaluation = next(call for call in provider.calls if call[2] == Report)
    assert evaluation[1]['history'][0]['answer'] == payload['text']
    with transaction() as conn:
        assert conn.execute('SELECT count(*) n FROM interview_reports').fetchone()['n'] == 1
        assert conn.execute('SELECT count(*) n FROM usage_reservations').fetchone()['n'] == 1
        assert conn.execute("SELECT count(*) n FROM jobs WHERE kind='evaluate'").fetchone()['n'] == 1
    assert client.get('/api/v1/workspace').json()['interviews'][0]['report']['overall'] == 66


def test_cross_account_routes_nested_resources_jobs_and_private_files(client, accounts):
    own = create(client).json()['id']; Worker(DeterministicProvider(), MemoryStorage()).run_once()
    first = client.get(f'/api/v1/interviews/{own}').json()
    job = client.get('/api/v1/jobs').json()[0]['id']
    uploaded = client.post('/api/v1/resumes',headers={'Idempotency-Key':str(uuid4())},files={'file':('x.pdf',pdf(),'application/pdf')}).json()['id']
    client.put('/api/v1/profile',json={'name':'Account One','role':'Engineer','bio':'Private'})
    app.dependency_overrides[identity] = lambda: accounts[1]
    assert client.get('/api/v1/workspace').json()['interviews'] == []
    assert client.get('/api/v1/workspace').json()['profile']['name'] != 'Account One'
    for path in [f'/interviews/{own}',f'/jobs/{job}',f'/resumes/{uploaded}',f'/resumes/{uploaded}/file']:
        assert client.get('/api/v1'+path).status_code == 404
    assert client.post(f'/api/v1/jobs/{job}/retry').status_code == 404
    assert client.delete(f'/api/v1/resumes/{uploaded}').status_code == 404
    assert client.post(f'/api/v1/interviews/{own}/complete').status_code == 404
    assert client.post(f'/api/v1/interviews/{own}/answers',headers={'Idempotency-Key':str(uuid4())},json={'question_id':first['questions'][0]['id'],'text':'Attempted cross account answer'}).status_code == 404
    # Privileged connection really bypasses RLS; repository must still enforce owner.
    with transaction() as conn:
        assert conn.execute('SELECT id FROM interview_sessions WHERE id=%s',(own,)).fetchone()
        with pytest.raises(AppError): owned(conn,'interview_sessions',own,accounts[1])


def test_database_rls_private_storage_and_composite_foreign_keys(client, accounts):
    resource = create(client).json()['id']; Worker(DeterministicProvider(),MemoryStorage()).run_once()
    question = client.get(f'/api/v1/interviews/{resource}').json()['questions'][0]['id']
    with pytest.raises(ForeignKeyViolation):
        with transaction() as conn:
            conn.execute('INSERT INTO answers(user_id,session_id,question_id,text,idempotency_key) VALUES(%s,%s,%s,%s,%s)',(accounts[1],resource,question,'Cross account content',str(uuid4())))
    with transaction() as conn:
        conn.execute('SET LOCAL ROLE authenticated')
        conn.execute("SELECT set_config('request.jwt.claim.sub',%s,true)",(str(accounts[1]),))
        assert not conn.execute('SELECT * FROM interview_sessions').fetchall()
        assert not conn.execute('SELECT * FROM questions').fetchall()
        assert not conn.execute('SELECT * FROM storage.objects').fetchall()
    with pytest.raises(InsufficientPrivilege):
        with transaction() as conn:
            conn.execute('SET LOCAL ROLE authenticated')
            conn.execute('SELECT * FROM resumes')


def test_worker_restart_and_lease_fence(client, accounts):
    resource = create(client).json()['id']
    original = claim()
    with transaction() as conn: conn.execute("UPDATE jobs SET lease_until=now()-interval '1 second' WHERE id=%s",(original['id'],))
    reclaimed = claim()
    assert reclaimed['id'] == original['id']
    assert reclaimed['lease_token'] != original['lease_token']
    Worker(DeterministicProvider(),MemoryStorage()).process(original)
    assert client.get(f'/api/v1/interviews/{resource}').json()['status'] == 'generating'
    Worker(DeterministicProvider(),MemoryStorage()).process(reclaimed)
    assert client.get(f'/api/v1/interviews/{resource}').json()['status'] == 'active'
    with transaction() as conn:
        assert conn.execute('SELECT count(*) n FROM questions').fetchone()['n'] == 4


def test_provider_failure_releases_usage_and_retry(client, accounts):
    class FailedProvider:
        def generate(self,*a): raise ProviderError('Provider failed',1)
    resource = create(client).json()['id']; worker = Worker(FailedProvider(),MemoryStorage())
    for _ in range(settings().max_job_attempts):
        worker.run_once()
        with transaction() as conn: conn.execute('UPDATE jobs SET available_at=now()')
    job = client.get('/api/v1/jobs').json()[0]
    assert job['status'] == 'failed'
    assert client.get('/api/v1/capabilities').json()['interviews_remaining'] == settings().free_interview_limit
    assert client.post(f"/api/v1/jobs/{job['id']}/retry").status_code == 202
    Worker(DeterministicProvider(),MemoryStorage()).run_once()
    assert client.get(f'/api/v1/interviews/{resource}').json()['status'] == 'active'


def test_deadline_and_quota(client, accounts):
    for _ in range(settings().free_interview_limit): assert create(client).status_code == 202
    assert create(client).status_code == 429
    Worker(DeterministicProvider(),MemoryStorage()).run_once()
    session = next(s for s in client.get('/api/v1/workspace').json()['interviews'] if s['status']=='active')
    with transaction() as conn: conn.execute("UPDATE interview_sessions SET deadline=now()-interval '1 second'")
    assert client.post(f"/api/v1/interviews/{session['id']}/answers",headers={'Idempotency-Key':str(uuid4())},json={'question_id':session['questions'][0]['id'],'text':'A late answer should be refused.'}).status_code == 409


@pytest.mark.skipif(os.getenv('TEST_DB_CONCURRENCY') != '1', reason='Requires native PostgreSQL, not the single-connection WASM test engine')
def test_atomic_quota_under_concurrent_connections(accounts):
    from app.modules.schemas import InterviewCreate
    config = InterviewCreate(role='Concurrency Engineer',type='Technical',difficulty='Hard',duration=20)
    def reserve_one(_):
        try:
            with transaction() as conn:
                service.create_interview(conn,accounts[0],config,str(uuid4()))
            return True
        except AppError as e:
            assert e.status == 429
            return False
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(reserve_one, range(8)))
    assert sum(results) == settings().free_interview_limit


def test_invalid_ai_evidence_is_not_saved(client):
    class BadEvidence(DeterministicProvider):
        def generate(self, task, content, schema):
            result = super().generate(task,content,schema)
            result.evidence[0].quote = 'Invented achievement never in the PDF'
            return result
    uploaded = client.post('/api/v1/resumes',headers={'Idempotency-Key':str(uuid4())},files={'file':('x.pdf',pdf(),'application/pdf')}).json()['id']
    Worker(BadEvidence(),MemoryStorage()).run_once()
    result = client.get(f'/api/v1/resumes/{uploaded}').json()
    assert result['analysis'] is None
    job = client.get('/api/v1/jobs').json()[0]
    assert job['status'] == 'queued'
    assert 'grounded in the PDF' in job['error']


def test_follow_up_budget_and_duplicate_answer(client):
    worker = Worker(DeterministicProvider(),MemoryStorage())
    resource = create(client).json()['id']; worker.run_once()
    for _ in range(6):
        session = client.get(f'/api/v1/interviews/{resource}').json()
        pending = next(q for q in session['questions'] if not q['answer'])
        payload = {'question_id':pending['id'],'text':'I considered correctness, reliability and measurable performance when designing the API.'}
        assert client.post(f'/api/v1/interviews/{resource}/answers',headers={'Idempotency-Key':str(uuid4())},json=payload).status_code == 202
        assert client.post(f'/api/v1/interviews/{resource}/answers',headers={'Idempotency-Key':str(uuid4())},json=payload).status_code == 409
        worker.run_once()
    final = client.get(f'/api/v1/interviews/{resource}').json()
    assert len(final['questions']) == 6
    assert all(q['answer'] for q in final['questions'])


def test_shared_per_user_request_limit(accounts, monkeypatch):
    import httpx
    from fastapi.security import HTTPAuthorizationCredentials
    settings().supabase_url = 'https://example.supabase.co'
    settings().supabase_publishable_key = 'test-only'
    monkeypatch.setattr(httpx,'get',lambda *a,**k: httpx.Response(200,json={'id':str(accounts[0]),'email_confirmed_at':'2026-11-08T00:00:00Z'}))
    with transaction() as conn:
        conn.execute("INSERT INTO api_rate_limits(user_id,minute,count) VALUES(%s,date_trunc('minute',now()),120)",(accounts[0],))
    with pytest.raises(AppError) as error:
        identity(HTTPAuthorizationCredentials(scheme='Bearer',credentials='test-token'))
    assert error.value.status == 429
