"""Transactional daily quota ledger. Caller must commit resource + reservation together."""
from datetime import timedelta
from app.core.config import settings
from app.core.errors import AppError


def capabilities(conn, user, *, at=None):
    from app.modules.service import ensure_account
    ensure_account(conn, user)
    conn.execute('SELECT id FROM profiles WHERE user_id=%s FOR UPDATE', (user,)).fetchone()
    # Read the clock AFTER waiting for the account lock, not at transaction start.
    now = at or conn.execute('SELECT clock_timestamp() t').fetchone()['t']
    window = conn.execute('SELECT * FROM usage_windows WHERE user_id=%s AND ends_at>%s ORDER BY ends_at DESC LIMIT 1', (user, now)).fetchone()
    counts = {}
    if window:
        counts = {(r['kind'], r['state']): r['n'] for r in conn.execute(
            'SELECT kind,state,count(*) n FROM usage_attempts WHERE window_id=%s AND user_id=%s GROUP BY kind,state',
            (window['id'], user))}
    result = {'server_time': now, 'window_started_at': window['starts_at'] if window else None,
              'reset_at': window['ends_at'] if window else None, 'window_hours': settings().usage_window_hours}
    for kind, limit in [('resume', settings().resume_limit), ('interview', settings().interview_limit)]:
        used, reserved = counts.get((kind, 'consumed'), 0), counts.get((kind, 'reserved'), 0)
        remaining = max(0, limit-used-reserved)
        result[kind] = dict(limit=limit, used=used, reserved=reserved, remaining=remaining)
        result[f'{kind}s_remaining'] = remaining
    return result


def _attempt(conn, user, kind, resource, caps):
    if caps[kind]['remaining'] <= 0:
        error = AppError(429, 'usage_limit', 'Your 24-hour allowance is used. Existing results remain available; try again after renewal.')
        error.quota = caps
        raise error
    if caps['reset_at'] is None:
        window = conn.execute('INSERT INTO usage_windows(user_id,starts_at,ends_at) VALUES(%s,%s,%s) RETURNING id',
            (user, caps['server_time'], caps['server_time'] + timedelta(hours=settings().usage_window_hours))).fetchone()
    else:
        window = conn.execute('SELECT id FROM usage_windows WHERE user_id=%s AND starts_at=%s AND ends_at=%s',
            (user, caps['window_started_at'], caps['reset_at'])).fetchone()
    conn.execute('INSERT INTO usage_attempts(user_id,window_id,kind,resource_id) VALUES(%s,%s,%s,%s)',
                 (user, window['id'], kind, resource))


def reserve(conn, user, kind, key, resource, *, at=None):
    caps = capabilities(conn, user, at=at)
    prior = conn.execute('SELECT * FROM usage_reservations WHERE user_id=%s AND idempotency_key=%s', (user, key)).fetchone()
    if prior:
        if prior['kind'] != kind:
            raise AppError(409, 'idempotency_conflict', 'This request key belongs to another operation.')
        # Replaying a failed creation only returns it; the explicit retry endpoint reacquires.
        return prior['resource_id']
    _attempt(conn, user, kind, resource, caps)
    conn.execute('INSERT INTO usage_reservations(user_id,kind,idempotency_key,resource_id) VALUES(%s,%s,%s,%s)', (user, kind, key, resource))
    return resource


def reacquire(conn, user, kind, resource, *, at=None):
    caps = capabilities(conn, user, at=at)
    active = conn.execute("SELECT 1 FROM usage_attempts WHERE user_id=%s AND resource_id=%s AND state!='released'", (user, resource)).fetchone()
    if not active:
        _attempt(conn, user, kind, resource, caps)
        conn.execute("UPDATE usage_reservations SET state='reserved' WHERE user_id=%s AND resource_id=%s AND state='released'", (user, resource))


def settle(conn, user, resource, state):
    # Fenced worker completion owns the resource/job lock. Never moves attempts to a newer window.
    conn.execute("UPDATE usage_attempts SET state=%s,settled_at=clock_timestamp() WHERE user_id=%s AND resource_id=%s AND state='reserved'", (state, user, resource))
    conn.execute("UPDATE usage_reservations SET state=%s WHERE user_id=%s AND resource_id=%s AND state='reserved'", (state, user, resource))
