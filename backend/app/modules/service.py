from uuid import uuid4
from psycopg.types.json import Jsonb
from app.core.db import owned, enqueue
from app.core.errors import AppError
from app.core.config import settings
from app.modules.schemas import ProfileInput


def ensure_account(conn, user):
    # User metadata is display input only, never authorization or entitlement data.
    conn.execute('''INSERT INTO profiles(id,user_id,data) SELECT id,id,
        jsonb_build_object('name',CASE WHEN length(trim(coalesce(raw_user_meta_data->>'name','')))>=2
            THEN left(trim(raw_user_meta_data->>'name'),60) ELSE 'New member' END,
            'role','','bio','','notifications',true,'reminders',true)
        FROM auth.users WHERE id=%s ON CONFLICT DO NOTHING''', (user,))
    conn.execute('INSERT INTO entitlements(user_id) VALUES (%s) ON CONFLICT DO NOTHING', (user,))


def capabilities(conn, user):
    ensure_account(conn, user)
    plan = conn.execute('SELECT plan FROM entitlements WHERE user_id=%s FOR UPDATE', (user,)).fetchone()['plan']
    cfg = settings()
    limits = {'resume': cfg.pro_resume_limit if plan == 'pro' else cfg.free_resume_limit,
              'interview': cfg.pro_interview_limit if plan == 'pro' else cfg.free_interview_limit}
    used = {r['kind']: r['n'] for r in conn.execute("SELECT kind,count(*) n FROM usage_reservations WHERE user_id=%s AND state!='released' GROUP BY kind", (user,))}
    return {'plan': plan, **{f'{k}s_remaining': max(0, v-used.get(k, 0)) for k, v in limits.items()}}


def reserve(conn, user, kind, key, resource):
    caps = capabilities(conn, user)  # Locks one entitlement row; serializes concurrent reservations.
    prior = conn.execute('SELECT * FROM usage_reservations WHERE user_id=%s AND idempotency_key=%s', (user, key)).fetchone()
    if prior:
        if prior['kind'] != kind:
            raise AppError(409, 'idempotency_conflict', 'This request key belongs to another operation.')
        return prior['resource_id']
    if caps[f'{kind}s_remaining'] <= 0:
        raise AppError(429, 'usage_limit', 'Introductory usage allowance reached.')
    conn.execute('INSERT INTO usage_reservations(user_id,kind,idempotency_key,resource_id) VALUES(%s,%s,%s,%s)', (user, kind, key, resource))
    return resource


def interview_view(conn, row):
    questions = conn.execute('''SELECT q.id,q.position,q.prompt,q.topic,a.text answer,a.response FROM questions q
        LEFT JOIN answers a ON a.question_id=q.id AND a.user_id=q.user_id WHERE q.session_id=%s AND q.user_id=%s ORDER BY q.position''', (row['id'], row['user_id'])).fetchall()
    report = conn.execute('SELECT result FROM interview_reports WHERE session_id=%s AND user_id=%s', (row['id'], row['user_id'])).fetchone()
    return {k: row[k] for k in ('id', 'config', 'status', 'created_at', 'deadline')} | {'questions': questions, 'report': report['result'] if report else None}


def resume_view(conn, row):
    analysis = conn.execute('SELECT result FROM resume_analyses WHERE resume_id=%s AND user_id=%s ORDER BY version DESC LIMIT 1', (row['id'], row['user_id'])).fetchone()
    return {k: row[k] for k in ('id', 'filename', 'target_role', 'status', 'created_at')} | {'analysis': analysis['result'] if analysis else None}


def workspace(conn, user):
    caps = capabilities(conn, user)
    profile = conn.execute('SELECT data FROM profiles WHERE user_id=%s', (user,)).fetchone()['data']
    return {'profile': ProfileInput.model_validate(profile), 'capabilities': caps,
        'resumes': [resume_view(conn, r) for r in conn.execute("SELECT * FROM resumes WHERE user_id=%s AND status!='deleting' ORDER BY created_at DESC", (user,)).fetchall()],
        'interviews': [interview_view(conn, r) for r in conn.execute('SELECT * FROM interview_sessions WHERE user_id=%s ORDER BY created_at DESC', (user,)).fetchall()]}


def create_interview(conn, user, data, key):
    resource = uuid4()
    selected = reserve(conn, user, 'interview', key, resource)
    if selected != resource:
        previous = owned(conn, 'interview_sessions', selected, user)
        if previous['config'] != data.model_dump(mode='json'):
            raise AppError(409, 'idempotency_conflict', 'Request key was used for different interview settings.')
        return interview_view(conn, previous)
    if data.resume_id:
        resume = owned(conn, 'resumes', data.resume_id, user)
        if resume['status'] != 'ready':
            raise AppError(409, 'resume_not_ready', 'Select a successfully analyzed resume.')
    conn.execute('INSERT INTO interview_sessions(id,user_id,config) VALUES(%s,%s,%s)', (resource, user, Jsonb(data.model_dump(mode='json'))))
    enqueue(conn, user, 'questions', resource, f'questions:{resource}')
    return interview_view(conn, owned(conn, 'interview_sessions', resource, user))


def answer(conn, user, session_id, data, key):
    session = owned(conn, 'interview_sessions', session_id, user, True)
    previous = conn.execute('SELECT * FROM answers WHERE session_id=%s AND user_id=%s AND idempotency_key=%s', (session_id, user, key)).fetchone()
    if previous:
        if previous['question_id'] != data.question_id or previous['text'] != data.text:
            raise AppError(409, 'idempotency_conflict', 'Request key was already used for a different answer.')
        return interview_view(conn, session)
    active = conn.execute("SELECT status='active' AND deadline>now() ok FROM interview_sessions WHERE id=%s", (session_id,)).fetchone()['ok']
    if not active:
        raise AppError(409, 'session_closed', 'Session is not active or its deadline has passed. Complete it to view feedback.')
    question = owned(conn, 'questions', data.question_id, user)
    if question['session_id'] != session_id:
        raise AppError(404, 'not_found', 'Question not found in this session.')
    pending = conn.execute('''SELECT q.id FROM questions q LEFT JOIN answers a ON a.question_id=q.id
        WHERE q.session_id=%s AND q.user_id=%s AND a.id IS NULL ORDER BY q.position LIMIT 1''', (session_id, user)).fetchone()
    busy = conn.execute("SELECT 1 FROM jobs WHERE resource_id=%s AND user_id=%s AND kind='response' AND status IN ('queued','running')", (session_id, user)).fetchone()
    if not pending or pending['id'] != data.question_id or busy:
        raise AppError(409, 'turn_order', 'Wait for the interviewer response and answer the current question once.')
    conn.execute('INSERT INTO answers(user_id,session_id,question_id,text,idempotency_key) VALUES(%s,%s,%s,%s,%s)', (user, session_id, data.question_id, data.text, key))
    enqueue(conn, user, 'response', session_id, f'response:{data.question_id}', {'question_id': str(data.question_id)})
    return interview_view(conn, session)


def complete(conn, user, resource):
    row = owned(conn, 'interview_sessions', resource, user, True)
    if row['status'] in ('evaluating', 'completed'):
        return interview_view(conn, row)
    if row['status'] != 'active':
        raise AppError(409, 'not_active', 'Wait for question generation or retry the failed job.')
    conn.execute("UPDATE jobs SET status='cancelled',lease_token=NULL WHERE user_id=%s AND resource_id=%s AND kind='response' AND status IN ('queued','running','failed')", (user, resource))
    conn.execute("UPDATE interview_sessions SET status='evaluating',completed_at=now() WHERE id=%s AND user_id=%s", (resource, user))
    enqueue(conn, user, 'evaluate', resource, f'evaluate:{resource}')
    return interview_view(conn, owned(conn, 'interview_sessions', resource, user))
