from uuid import UUID
import httpx
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.core.config import settings
from app.core.errors import AppError
from app.core.db import transaction

bearer = HTTPBearer(auto_error=False)


def identity(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> UUID:
    if not credentials or credentials.scheme.lower() != 'bearer':
        raise AppError(401, 'unauthorized', 'Sign in to continue.')
    cfg = settings()
    if not cfg.supabase_url or not cfg.supabase_publishable_key:
        raise AppError(503, 'setup_required', 'Authentication configuration is required.')
    # Auth server validates signature, expiry and current user. No unverified JWT decoding.
    try:
        response = httpx.get(f'{cfg.supabase_url}/auth/v1/user', headers={
            'apikey': cfg.supabase_publishable_key,
            'Authorization': f'Bearer {credentials.credentials}',
        }, timeout=10)
        if response.status_code == 200:
            user = response.json()
            if user.get('is_anonymous') or not user.get('email_confirmed_at'):
                raise AppError(401, 'unverified', 'Verify your email before continuing.')
            user_id = UUID(user['id'])
            # Database-backed across API processes. Rollback does not increment over-limit calls.
            with transaction() as conn:
                count = conn.execute('''INSERT INTO api_rate_limits(user_id,minute,count)
                    VALUES(%s,date_trunc('minute',now()),1) ON CONFLICT(user_id,minute)
                    DO UPDATE SET count=api_rate_limits.count+1 RETURNING count''', (user_id,)).fetchone()['count']
                if count > 120:
                    raise AppError(429, 'request_limit', 'Too many requests. Please wait a minute.')
            return user_id
        if response.status_code in (401, 403):
            raise AppError(401, 'session_expired', 'Your session expired. Sign in again.')
    except (httpx.HTTPError, ValueError, KeyError):
        pass
    raise AppError(503, 'auth_unavailable', 'Authentication is temporarily unavailable.')
