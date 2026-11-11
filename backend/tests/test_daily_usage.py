from datetime import datetime, timedelta, timezone
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
import os
import pytest
from app.core.db import transaction
from app.core.errors import AppError
from app.modules import usage

START = datetime(2026, 11, 10, 9, tzinfo=timezone.utc)


def use(conn, user, kind, at=START, key=None, resource=None):
    return usage.reserve(conn, user, kind, key or str(uuid4()), resource or uuid4(), at=at)


@pytest.mark.parametrize('kind,limit', [('resume', 10), ('interview', 3)])
def test_exact_limits_and_duplicate_and_independent_accounts(accounts, kind, limit):
    user, other = accounts
    with transaction() as conn:
        key = str(uuid4())
        resource = use(conn, user, kind, key=key)
        assert use(conn, user, kind, key=key) == resource
        for _ in range(limit-1): use(conn, user, kind)
    with transaction() as conn:
        with pytest.raises(AppError) as error: use(conn, user, kind)
        assert error.value.quota[kind] == dict(limit=limit, used=0, reserved=limit, remaining=0)
        assert error.value.quota['reset_at'] == START + timedelta(hours=24)
    with transaction() as conn:
        use(conn, other, kind, key=key)
        assert usage.capabilities(conn, other, at=START)[kind]['remaining'] == limit-1


@pytest.mark.parametrize('offset,renewed', [(-1, False), (0, True), (1, True)])
def test_shared_fixed_boundary_and_late_settlement(accounts, offset, renewed):
    user = accounts[0]
    boundary = START + timedelta(hours=24)
    with transaction() as conn:
        old = use(conn, user, 'resume')
        use(conn, user, 'interview', at=START+timedelta(hours=5))
        caps = usage.capabilities(conn, user, at=boundary+timedelta(microseconds=offset))
        assert caps['resumes_remaining'] == (10 if renewed else 9)
        assert caps['interviews_remaining'] == (3 if renewed else 2)
        assert caps['reset_at'] == (None if renewed else boundary)
        use(conn, user, 'resume', at=boundary)
        usage.settle(conn, user, old, 'consumed')
        after = usage.capabilities(conn, user, at=boundary)
        assert after['resume'] == dict(limit=10, used=0, reserved=1, remaining=9)
        assert after['interview']['remaining'] == 3
        assert after['reset_at'] == boundary+timedelta(hours=24)


def test_failure_retry_preserves_original_attempt_and_new_window(accounts):
    user = accounts[0]
    with transaction() as conn:
        resource = use(conn, user, 'resume')
        usage.settle(conn, user, resource, 'released')
        assert usage.capabilities(conn, user, at=START)['resumes_remaining'] == 10
        boundary = START+timedelta(hours=24)
        usage.reacquire(conn, user, 'resume', resource, at=boundary)
        usage.reacquire(conn, user, 'resume', resource, at=boundary)
        usage.settle(conn, user, resource, 'consumed')
        usage.settle(conn, user, resource, 'released')  # consumed work cannot be refunded
        rows = conn.execute('SELECT * FROM usage_attempts WHERE user_id=%s ORDER BY created_at', (user,)).fetchall()
        assert [r['state'] for r in rows] == ['released', 'consumed']
        assert rows[0]['window_id'] != rows[1]['window_id']
        assert usage.capabilities(conn, user, at=boundary)['resume']['used'] == 1


def test_late_failure_does_not_refund_new_window_and_replay_does_not_recharge(accounts):
    user = accounts[0]
    with transaction() as conn:
        key = str(uuid4())
        old = use(conn, user, 'interview', key=key)
        boundary = START+timedelta(hours=24)
        use(conn, user, 'interview', at=boundary)
        usage.settle(conn, user, old, 'released')
        assert use(conn, user, 'interview', at=boundary, key=key) == old
        assert usage.capabilities(conn, user, at=boundary)['interviews_remaining'] == 2
        usage.reacquire(conn, user, 'interview', old, at=boundary)
        assert usage.capabilities(conn, user, at=boundary)['interviews_remaining'] == 1


def test_historical_lifetime_reservations_do_not_start_window(accounts):
    user = accounts[0]
    with transaction() as conn:
        conn.execute("INSERT INTO usage_reservations(user_id,kind,idempotency_key,resource_id,state) VALUES(%s,'resume','legacy',%s,'consumed')", (user, uuid4()))
        caps = usage.capabilities(conn, user, at=START)
        assert caps['reset_at'] is None and caps['resumes_remaining'] == 10


def test_retry_reacquires_same_window_and_cannot_bypass_full_capacity(accounts):
    user = accounts[0]
    with transaction() as conn:
        resource = use(conn, user, 'interview')
        usage.settle(conn, user, resource, 'released')
        for _ in range(3): use(conn, user, 'interview')
    with transaction() as conn:
        with pytest.raises(AppError): usage.reacquire(conn, user, 'interview', resource, at=START)
    with transaction() as conn:
        assert conn.execute("SELECT count(*) n FROM usage_attempts WHERE user_id=%s AND resource_id=%s", (user, resource)).fetchone()['n'] == 1
        usage.reacquire(conn, user, 'interview', resource, at=START+timedelta(hours=24))
        assert usage.capabilities(conn, user, at=START+timedelta(hours=24))['interview']['reserved'] == 1


def test_http_limit_includes_structured_quota(client):
    for _ in range(3):
        response = client.post('/api/v1/interviews', headers={'Idempotency-Key': str(uuid4())}, json={
            'role': 'Engineer', 'type': 'Technical', 'difficulty': 'Medium', 'duration': 20})
        assert response.status_code == 202
    response = client.post('/api/v1/interviews', headers={'Idempotency-Key': str(uuid4())}, json={
        'role': 'Engineer', 'type': 'Technical', 'difficulty': 'Medium', 'duration': 20})
    assert response.status_code == 429
    quota = response.json()['error']['quota']
    assert quota['interview'] == dict(limit=3, used=0, reserved=3, remaining=0)
    assert quota['reset_at'] and quota['server_time']


def test_real_worker_finishes_old_job_without_charging_renewed_window(client, accounts):
    from test_integration import create, DeterministicProvider, MemoryStorage
    from app.workers.runner import Worker
    first = create(client).json()['id']
    with transaction() as conn:
        conn.execute("UPDATE usage_windows SET starts_at=now()-interval '48 hours',ends_at=now()-interval '24 hours' WHERE user_id=%s", (accounts[0],))
    assert create(client).status_code == 202
    assert Worker(DeterministicProvider(), MemoryStorage()).run_once()
    assert client.get('/api/v1/interviews/'+first).json()['status'] == 'active'
    caps = client.get('/api/v1/capabilities').json()
    assert caps['interview'] == dict(limit=3, used=0, reserved=1, remaining=2)


def test_real_job_failure_and_retry_after_window_boundary(client, accounts):
    from test_integration import create, DeterministicProvider, MemoryStorage
    from app.workers.runner import Worker, claim, mark_failure
    resource = create(client).json()['id']
    job = claim()
    with transaction() as conn:
        mark_failure(conn, job)
        conn.execute("UPDATE jobs SET status='failed',lease_token=NULL WHERE id=%s", (job['id'],))
        conn.execute("UPDATE usage_windows SET starts_at=now()-interval '48 hours',ends_at=now()-interval '24 hours' WHERE user_id=%s", (accounts[0],))
    assert client.post(f"/api/v1/jobs/{job['id']}/retry").status_code == 202
    assert client.post(f"/api/v1/jobs/{job['id']}/retry").status_code == 202
    assert Worker(DeterministicProvider(), MemoryStorage()).run_once()
    caps = client.get('/api/v1/capabilities').json()
    assert caps['interview'] == dict(limit=3, used=1, reserved=0, remaining=2)
    with transaction() as conn:
        rows = conn.execute('SELECT state,window_id FROM usage_attempts WHERE resource_id=%s ORDER BY created_at', (resource,)).fetchall()
        assert [r['state'] for r in rows] == ['released', 'consumed']
        assert rows[0]['window_id'] != rows[1]['window_id']


@pytest.mark.skipif(os.getenv('TEST_DB_CONCURRENCY') != '1', reason='Needs native PostgreSQL row locking; PGlite serializes connections')
@pytest.mark.parametrize('kind,limit', [('resume', 10), ('interview', 3)])
def test_concurrent_reservations_and_same_key(accounts, kind, limit):
    def attempt(key):
        try:
            with transaction() as conn: return use(conn, accounts[0], kind, key=key)
        except AppError as error:
            assert error.code == 'usage_limit'
            return None
    with ThreadPoolExecutor(max_workers=8) as pool:
        duplicate = list(pool.map(attempt, ['same-key']*8))
        assert len(set(duplicate)) == 1 and duplicate[0] is not None
        results = list(pool.map(attempt, [str(uuid4()) for _ in range(limit+5)]))
        assert sum(r is not None for r in results) == limit-1
