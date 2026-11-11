from contextlib import contextmanager
import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from app.core.config import settings, configured
from app.core.errors import AppError


@contextmanager
def transaction():
    if not configured(settings().database_url):
        raise AppError(503, 'setup_required', 'Database configuration is required.')
    # Transaction poolers do not preserve a backend session's prepared statements.
    with psycopg.connect(settings().database_url, row_factory=dict_row, connect_timeout=10, prepare_threshold=None) as conn:
        conn.execute('SET LOCAL search_path = public')
        conn.execute("SET LOCAL timezone = 'UTC'")
        conn.execute("SET LOCAL statement_timeout = '15s'")
        yield conn


def owned(conn, table, resource_id, user_id, lock=False):
    # Identifiers are fixed internal constants, never supplied by HTTP clients.
    from psycopg import sql
    row = conn.execute(sql.SQL('SELECT * FROM {} WHERE id=%s AND user_id=%s' + (' FOR UPDATE' if lock else '')).format(sql.Identifier(table)), (resource_id, user_id)).fetchone()
    if not row:
        raise AppError(404, 'not_found', 'Record not found.')
    return row


def enqueue(conn, user_id, kind, resource_id, key, payload=None):
    return conn.execute('''INSERT INTO public.jobs(user_id,kind,resource_id,idempotency_key,payload)
        VALUES (%s,%s,%s,%s,%s) ON CONFLICT(user_id,idempotency_key) DO UPDATE
        SET idempotency_key=excluded.idempotency_key RETURNING *''',
        (user_id, kind, resource_id, key, Jsonb(payload or {}))).fetchone()
