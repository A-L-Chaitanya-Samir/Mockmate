from datetime import datetime, timezone
import hashlib
from uuid import uuid4
import math
from psycopg.types.json import Jsonb
from app.core.config import settings, configured
from app.core.db import owned, transaction
from app.core.errors import AppError
from app.integrations.vision import GroqVision, VisionUnavailable, normalize_frame
from app.modules.schemas import VisionCheckView


def available():
    return settings().vision_enabled and configured(settings().groq_api_key)


def view(record):
    return {key: record[key] for key in VisionCheckView.model_fields}


def state(conn, row, retry_after=0):
    cfg = settings()
    latest = conn.execute('SELECT * FROM interview_vision_checks WHERE session_id=%s AND user_id=%s ORDER BY received_at DESC LIMIT 1', (row['id'], row['user_id'])).fetchone()
    count = conn.execute('SELECT count(*) n FROM interview_vision_checks WHERE session_id=%s', (row['id'],)).fetchone()['n']
    return {'available': available() and row['config'].get('mode') == 'Spoken',
        'enabled': bool((row['device_check'] or {}).get('phone_vision')), 'model': cfg.vision_model,
        'interval_seconds': max(20, cfg.vision_interval_seconds), 'audit_seconds': max(60, cfg.vision_audit_seconds),
        'checks': count, 'limit': min(180, cfg.vision_max_per_session), 'retry_after': retry_after,
        'warning_active': bool(row['vision_state'].get('active_episode')), 'latest': view(latest) if latest else None}


def consent(conn, user, resource, enabled):
    row = owned(conn, 'interview_sessions', resource, user, True)
    if row['config'].get('mode') != 'Spoken' or row['status'] not in ('active','generating') or not row['device_check']:
        raise AppError(409, 'vision_closed', 'Phone checks require an open spoken interview and completed device checks.')
    if enabled and not available():
        raise AppError(503, 'vision_unavailable', 'Optional image analysis is not configured. You can continue without it.')
    data = row['device_check'] | {'phone_vision': enabled, 'vision_consent_at': datetime.now(timezone.utc).isoformat(), 'vision_consent_version': 'vision-v1'}
    conn.execute('UPDATE interview_sessions SET device_check=%s,vision_state=%s WHERE id=%s', (Jsonb(data), Jsonb({}), resource))
    if not enabled:
        conn.execute("UPDATE interview_vision_checks SET status='unavailable',error_code='consent_withdrawn',checked_at=now() WHERE session_id=%s AND status='processing'", (resource,))
    return state(conn, owned(conn, 'interview_sessions', resource, user))


def inspect(user, resource, key, data, mime, observed_at, provider=None):
    # Ownership/consent checks precede media decoding; bytes never enter the DB.
    with transaction() as conn:
        row = owned(conn, 'interview_sessions', resource, user)
        if not (row['device_check'] or {}).get('phone_vision'):
            raise AppError(403, 'vision_consent', 'Enable optional external image checks before sending camera images.')
    image = normalize_frame(data, mime)
    digest = hashlib.sha256(data).hexdigest()
    now = datetime.now(timezone.utc)
    if observed_at.tzinfo is None:
        raise AppError(422, 'vision_time', 'The image observation time must include a timezone.')
    with transaction() as conn:
        row = owned(conn, 'interview_sessions', resource, user, True)
        previous = conn.execute('SELECT * FROM interview_vision_checks WHERE session_id=%s AND idempotency_key=%s', (resource, str(key))).fetchone()
        if previous:
            if previous['sha256'] != digest:
                raise AppError(409, 'idempotency_conflict', 'This check ID belongs to another image.')
            return state(conn, row, 20)
        if row['status'] != 'active' or not row['deadline'] or row['deadline'] <= now or not (row['device_check'] or {}).get('phone_vision'):
            raise AppError(409, 'vision_closed', 'Image checks are closed for this session.')
        if not available():
            raise AppError(503, 'vision_unavailable', 'Optional image analysis is unavailable. Local face and tab checks can continue.')
        latest = conn.execute('SELECT received_at FROM interview_vision_checks WHERE session_id=%s ORDER BY received_at DESC LIMIT 1', (resource,)).fetchone()
        interval = max(20, settings().vision_interval_seconds)
        if latest and (now-latest['received_at']).total_seconds() < interval:
            return state(conn, row, max(1, interval-int((now-latest['received_at']).total_seconds())))
        count = conn.execute('SELECT count(*) n FROM interview_vision_checks WHERE session_id=%s', (resource,)).fetchone()['n']
        if count >= min(180, settings().vision_max_per_session):
            return state(conn, row, 86400)
        budget = conn.execute('SELECT * FROM vision_provider_limits WHERE id=true FOR UPDATE').fetchone()
        if budget['blocked_until'] and budget['blocked_until'] > now:
            return state(conn, row, max(1, int((budget['blocked_until']-now).total_seconds())))
        requests = [stamp for stamp in budget['requests'] if (now-stamp).total_seconds() < 86400]
        recent = [stamp for stamp in requests if (now-stamp).total_seconds() < 60]
        if len(recent) >= max(1, min(3, settings().vision_max_per_minute)):
            return state(conn, row, max(1, math.ceil(60-(now-min(recent)).total_seconds())+1))
        if len(requests) >= max(1, min(80, settings().vision_max_per_day)):
            return state(conn, row, max(1, math.ceil(86400-(now-min(requests)).total_seconds())+1))
        conn.execute('UPDATE vision_provider_limits SET requests=%s WHERE id=true', (requests+[now],))
        check = conn.execute('''INSERT INTO interview_vision_checks(user_id,session_id,idempotency_key,sha256,model,observed_at)
            VALUES(%s,%s,%s,%s,%s,%s) RETURNING *''', (user, resource, str(key), digest, settings().vision_model, observed_at)).fetchone()
        consent_at = row['device_check'].get('vision_consent_at')
    finding, failure = None, None
    try:
        finding = (provider or GroqVision()).inspect(image, check['model']).phone_visibility
    except VisionUnavailable as exc:
        failure = exc
    except Exception:
        failure = VisionUnavailable('provider_unavailable')
    finally:
        del image, data
    with transaction() as conn:
        row = owned(conn, 'interview_sessions', resource, user, True)
        current = owned(conn, 'interview_vision_checks', check['id'], user, True)
        if current['status'] != 'processing':
            return state(conn, row)
        if row['status'] != 'active' or not row['deadline'] or row['deadline'] <= datetime.now(timezone.utc) or not (row['device_check'] or {}).get('phone_vision') or row['device_check'].get('vision_consent_at') != consent_at:
            failure = VisionUnavailable('session_closed')
        if failure:
            conn.execute("UPDATE interview_vision_checks SET status='unavailable',error_code=%s,checked_at=now() WHERE id=%s", (failure.code, check['id']))
            if failure.code == 'provider_quota':
                conn.execute('UPDATE vision_provider_limits SET blocked_until=now()+make_interval(secs=>%s) WHERE id=true', (failure.retry_after,))
            # An interruption breaks the consecutive-positive evidence streak.
            saved = row['vision_state'] | {'positive': 0}
            conn.execute('UPDATE interview_sessions SET vision_state=%s WHERE id=%s', (Jsonb(saved), resource))
            return state(conn, owned(conn, 'interview_sessions', resource, user), failure.retry_after)
        saved = dict(row['vision_state'])
        positive = int(saved.get('positive', 0))+1 if finding == 'visible' else 0
        saved['positive'] = positive
        episode, phase = None, None
        if positive >= 2 and not saved.get('active_episode'):
            episode, phase = str(uuid4()), 'start'
            saved['active_episode'] = episode
        elif finding == 'not_visible' and saved.get('active_episode'):
            episode, phase = saved.pop('active_episode'), 'recovered'
        conn.execute("UPDATE interview_vision_checks SET status='completed',result=%s,episode_id=%s,phase=%s,checked_at=now() WHERE id=%s", (finding, episode, phase, check['id']))
        conn.execute('UPDATE interview_sessions SET vision_state=%s WHERE id=%s', (Jsonb(saved), resource))
        return state(conn, owned(conn, 'interview_sessions', resource, user))


def summary(conn, row):
    samples = [VisionCheckView.model_validate(view(record)).model_dump(mode='json') for record in conn.execute('SELECT * FROM interview_vision_checks WHERE session_id=%s AND user_id=%s ORDER BY received_at', (row['id'], row['user_id']))]
    if not samples and not (row['device_check'] or {}).get('phone_vision'):
        return None
    return {'model': settings().vision_model, 'provider': 'Groq', 'consented': bool((row['device_check'] or {}).get('phone_vision')),
        'checks': len(samples), 'unavailable': sum(s['status']!='completed' for s in samples),
        'uncertain': sum(s['result']=='uncertain' for s in samples), 'visible': sum(s['result']=='visible' for s in samples),
        'episodes': sum(s['phase']=='start' for s in samples), 'samples': samples}
