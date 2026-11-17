"""Limited native PostgreSQL quota check with disposable accounts; no AI or email sends.

Run from the repository root. Uses backend/.env, never runs test-suite TRUNCATEs.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import uuid4
import sys
import httpx
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from app.core.config import settings
from app.core.db import transaction
from app.core.errors import AppError
from app.modules import usage


def main():
    cfg = settings()
    users = []
    headers = {'apikey': cfg.supabase_secret_key, 'Authorization': f'Bearer {cfg.supabase_secret_key}'}
    try:
        for _ in range(2):
            response = httpx.post(cfg.supabase_url+'/auth/v1/admin/users', headers=headers,
                json={'email': f'quota-smoke-{uuid4()}@example.test', 'email_confirm': True,
                      'password': str(uuid4())+str(uuid4())}, timeout=20)
            response.raise_for_status()
            users.append(response.json()['id'])

        def attempt(user, kind, key):
            try:
                with transaction() as conn:
                    return str(usage.reserve(conn, user, kind, key, uuid4()))
            except AppError as error:
                assert error.code == 'usage_limit'
                return None

        with ThreadPoolExecutor(max_workers=8) as pool:
            for kind, limit in [('resume', cfg.resume_limit), ('interview', cfg.interview_limit)]:
                duplicates = list(pool.map(lambda _: attempt(users[0], kind, kind+'-duplicate'), range(8)))
                assert duplicates[0] and len(set(duplicates)) == 1
                results = list(pool.map(lambda _: attempt(users[0], kind, str(uuid4())), range(limit+5)))
                assert sum(r is not None for r in results) == limit-1
                assert attempt(users[1], kind, kind+'-duplicate') is not None
                print(f'PASS native PostgreSQL: {kind} exact limit, concurrency, duplicates, independent account')
        with transaction() as conn:
            caps = usage.capabilities(conn, users[0])
            assert caps['resume']['remaining'] == caps['interview']['remaining'] == 0
            assert caps['reset_at'] is not None
            print('PASS native PostgreSQL: shared window and structured counters')
    finally:
        for user in users:
            response = httpx.delete(cfg.supabase_url+'/auth/v1/admin/users/'+user, headers=headers, timeout=20)
            response.raise_for_status()
        print('Disposable quota accounts cleaned up; no emails or AI requests sent.')


if __name__ == '__main__':
    main()
