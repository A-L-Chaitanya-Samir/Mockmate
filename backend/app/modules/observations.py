"""Client-reported observations. Never feed events to the performance evaluator."""
from datetime import datetime, timezone
from psycopg.types.json import Jsonb
from app.core.config import settings
from app.core.db import owned
from app.core.errors import AppError
from app.modules import vision


def configuration():
    cfg = settings()
    return {'version': 'practice-v1', 'sample_ms': max(500, cfg.observation_sample_ms),
        'sustain_ms': max(1000, cfg.observation_sustain_ms), 'debounce_ms': max(250, cfg.observation_debounce_ms), 'recovery_ms': max(500, cfg.observation_recovery_ms),
        'cooldown_ms': max(1000, cfg.observation_cooldown_ms), 'source': 'client-reported',
        'model_path': cfg.face_model_path if cfg.face_model_path.startswith('/mediapipe/') else '/mediapipe/blaze_face_short_range.tflite',
        'min_confidence': max(.1, min(.99, cfg.face_min_confidence))}


def check_devices(conn, user, resource, data):
    row = owned(conn, 'interview_sessions', resource, user, True)
    if row['config'].get('mode') != 'Spoken' or row['status'] not in ('generating', 'active'):
        raise AppError(409, 'session_closed', 'Device checks are only available for an open spoken interview.')
    if not row['device_check']:
        conn.execute('UPDATE interview_sessions SET device_check=%s WHERE id=%s',
            (Jsonb(data.model_dump() | {'received_at': datetime.now(timezone.utc).isoformat(), 'client_reported': True}), resource))
    if row['status'] == 'active' and not row['deadline']:
        conn.execute('UPDATE interview_sessions SET deadline=now()+make_interval(mins=>%s) WHERE id=%s', (row['config']['duration'], resource))
    vision.consent(conn, user, resource, data.phone_vision)


def ingest(conn, user, resource, batch):
    row = owned(conn, 'interview_sessions', resource, user, True)
    # Serialize against completion. Late retries never change a saved snapshot.
    existing = {str(r['id']) for r in conn.execute('SELECT id FROM interview_observations WHERE session_id=%s AND user_id=%s AND id=ANY(%s)',
        (resource, user, [e.id for e in batch.events]))}
    if all(str(e.id) in existing for e in batch.events):
        return
    if row['config'].get('mode') != 'Spoken' or not row['device_check'] or row['status'] != 'active':
        raise AppError(409, 'observations_closed', 'Observation collection is closed for this session.')
    recent = conn.execute("SELECT count(*) n FROM interview_observations WHERE session_id=%s AND received_at>now()-interval '1 minute'", (resource,)).fetchone()['n']
    total = conn.execute('SELECT count(*) n FROM interview_observations WHERE session_id=%s', (resource,)).fetchone()['n']
    if recent + len(batch.events) > 120 or total + len(batch.events) > 2000:
        raise AppError(429, 'observation_limit', 'Observation event allowance reached. Collection gaps will be reported.')
    for event in batch.events:
        if event.observed_at.tzinfo is None:
            raise AppError(422, 'observation_time', 'Observation times must include a timezone.')
        if event.phase == 'start' and event.duration_ms is not None:
            raise AppError(422, 'observation_duration', 'Only recovery events may include durations.')
        conn.execute('''INSERT INTO interview_observations(id,user_id,session_id,episode_id,kind,phase,observed_at,duration_ms)
            VALUES(%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING''',
            (event.id, user, resource, event.episode_id, event.kind, event.phase, event.observed_at, event.duration_ms))


def summary(conn, row, observed_ms=0):
    events = conn.execute('''SELECT id,episode_id,kind,phase,observed_at,duration_ms,received_at
        FROM interview_observations WHERE session_id=%s AND user_id=%s ORDER BY received_at,id''', (row['id'], row['user_id'])).fetchall()
    return {'configuration': row['observation_config'], 'device_check': row['device_check'],
        'events': [{k: v.isoformat() if isinstance(v, datetime) else str(v) if k in ('id','episode_id') else v for k,v in e.items()} for e in events],
        'gaps': row['observation_gaps'], 'observed_ms': observed_ms, 'client_reported': True, 'vision': vision.summary(conn, row)}
