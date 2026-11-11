from uuid import uuid4
from psycopg.types.json import Jsonb
from app.core.db import owned, enqueue
from app.core.errors import AppError
from app.core.config import settings
from app.modules.schemas import ProfileInput
from app.modules import observations


def ensure_account(conn, user):
    # User metadata is display input only, never authorization data.
    conn.execute('''INSERT INTO profiles(id,user_id,data) SELECT id,id,
        jsonb_build_object('name',CASE WHEN length(trim(coalesce(raw_user_meta_data->>'name','')))>=2
            THEN left(trim(raw_user_meta_data->>'name'),60) ELSE 'New member' END,
            'role','','bio','','notifications',true,'reminders',true)
        FROM auth.users WHERE id=%s ON CONFLICT DO NOTHING''', (user,))


# Compatibility exports for existing API callers.
from app.modules.usage import capabilities, reserve, reacquire, settle


def interview_view(conn, row):
    questions = conn.execute('''SELECT q.id,q.position,q.prompt,q.topic,a.text answer,a.response,a.modality,a.original_transcript,coalesce(a.user_corrected,false) user_corrected FROM questions q
        LEFT JOIN answers a ON a.question_id=q.id AND a.user_id=q.user_id WHERE q.session_id=%s AND q.user_id=%s ORDER BY q.position''', (row['id'], row['user_id'])).fetchall()
    report = conn.execute('SELECT result FROM interview_reports WHERE session_id=%s AND user_id=%s', (row['id'], row['user_id'])).fetchone()
    transcriptions = conn.execute('''SELECT id,question_id,status,original_text,error,duration_seconds,model FROM transcriptions
        WHERE session_id=%s AND user_id=%s ORDER BY created_at''', (row['id'], row['user_id'])).fetchall()
    return {k: row[k] for k in ('id', 'config', 'status', 'created_at', 'deadline', 'device_check', 'observation_config')} | {
        'questions': questions, 'report': report['result'] if report else None, 'transcriptions': transcriptions,
        'integrity': row['integrity_snapshot'] if row['integrity_snapshot'] else None}


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
    conn.execute('INSERT INTO interview_sessions(id,user_id,config,observation_config) VALUES(%s,%s,%s,%s)',
        (resource, user, Jsonb(data.model_dump(mode='json')), Jsonb(observations.configuration() if data.mode == 'Spoken' else {})))
    enqueue(conn, user, 'questions', resource, f'questions:{resource}')
    return interview_view(conn, owned(conn, 'interview_sessions', resource, user))


def answer(conn, user, session_id, data, key):
    session = owned(conn, 'interview_sessions', session_id, user, True)
    previous = conn.execute('SELECT * FROM answers WHERE session_id=%s AND user_id=%s AND idempotency_key=%s', (session_id, user, key)).fetchone()
    if previous:
        if previous['question_id'] != data.question_id or previous['text'] != data.text or previous['transcription_id'] != data.transcription_id:
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
    if not pending or pending['id'] != data.question_id or (busy and session['config'].get('mode') != 'Spoken'):
        raise AppError(409, 'turn_order', 'Wait for the interviewer response and answer the current question once.')
    original = None
    spoken = session['config'].get('mode') == 'Spoken'
    if spoken:
        if not session['device_check'] or not data.transcription_id:
            raise AppError(422, 'spoken_required', 'Complete device checks and transcribe a spoken answer first.')
        transcription = owned(conn, 'transcriptions', data.transcription_id, user)
        if transcription['session_id'] != session_id or transcription['question_id'] != data.question_id or transcription['status'] != 'ready':
            raise AppError(422, 'transcription_invalid', 'Use a completed transcription for this question.')
        original = transcription['original_text']
    elif data.transcription_id:
        raise AppError(422, 'legacy_text', 'Legacy text sessions do not accept spoken transcripts.')
    conn.execute('''INSERT INTO answers(user_id,session_id,question_id,text,idempotency_key,modality,transcription_id,original_transcript,user_corrected)
        VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s)''',
        (user, session_id, data.question_id, data.text, key, 'spoken' if spoken else 'text', data.transcription_id, original, bool(original and original != data.text)))
    enqueue(conn, user, 'response', session_id, f'response:{data.question_id}', {'question_id': str(data.question_id)})
    return interview_view(conn, session)


def complete(conn, user, resource, observation_gaps=0, observed_ms=0):
    row = owned(conn, 'interview_sessions', resource, user, True)
    if row['status'] in ('evaluating', 'completed'):
        return interview_view(conn, row)
    if row['status'] != 'active':
        raise AppError(409, 'not_active', 'Wait for question generation or retry the failed job.')
    conn.execute("UPDATE jobs SET status='cancelled',lease_token=NULL WHERE user_id=%s AND resource_id=%s AND kind='response' AND status IN ('queued','running','failed')", (user, resource))
    conn.execute("UPDATE jobs SET status='cancelled',lease_token=NULL WHERE user_id=%s AND resource_id=%s AND kind='transcribe' AND status IN ('queued','running','failed')", (user, resource))
    conn.execute("UPDATE transcriptions SET status=CASE WHEN status='processing' THEN 'cancelled' ELSE status END,audio_bytes=NULL WHERE session_id=%s AND user_id=%s", (resource, user))
    conn.execute("UPDATE interview_vision_checks SET status='unavailable',error_code='session_closed',checked_at=now() WHERE session_id=%s AND user_id=%s AND status='processing'", (resource, user))
    if row['config'].get('mode') == 'Spoken':
        row['observation_gaps'] += observation_gaps
        snapshot = observations.summary(conn, row, observed_ms)
        conn.execute('UPDATE interview_sessions SET integrity_snapshot=%s,observation_gaps=%s WHERE id=%s', (Jsonb(snapshot), row['observation_gaps'], resource))
    conn.execute("UPDATE interview_sessions SET status='evaluating',completed_at=now() WHERE id=%s AND user_id=%s", (resource, user))
    enqueue(conn, user, 'evaluate', resource, f'evaluate:{resource}')
    return interview_view(conn, owned(conn, 'interview_sessions', resource, user))
