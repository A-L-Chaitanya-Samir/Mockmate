"""Read-only live setup checks. Prints status/variable names, never credential values."""
import argparse
import sys
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
import httpx
import psycopg
from dotenv import dotenv_values
from app.core.config import settings, configured

parser = argparse.ArgumentParser()
parser.add_argument('--provider-smoke', action='store_true', help='Make one synthetic Groq request')
args = parser.parse_args()
cfg = settings()
public = dotenv_values('.env.local', encoding='utf-8-sig')
failures = []

def result(label, passed, detail=''):
    print(f'{"PASS" if passed else "ACTION REQUIRED"}: {label}' + (f' - {detail}' if detail and not passed else ''))
    if not passed:
        failures.append(label)

for name in cfg.missing_configuration():
    result(name, False, 'fill this value privately in backend/.env')
result('Frontend/backend project match', cfg.supabase_url == public.get('NEXT_PUBLIC_SUPABASE_URL'))
result('Frontend/backend publishable key match', cfg.supabase_publishable_key == public.get('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'))
result('Live mode', public.get('NEXT_PUBLIC_DEMO_MODE', 'false') == 'false')
result('Public key is publishable', (public.get('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') or '').startswith('sb_publishable_'))

try:
    response = httpx.get(f'{cfg.supabase_url}/auth/v1/settings',headers={'apikey':cfg.supabase_publishable_key},timeout=15)
    result('Supabase public key accepted',response.status_code == 200)
    if response.status_code == 200:
        data=response.json()
        result('Email/password signup enabled',data.get('external',{}).get('email') is True and not data.get('disable_signup'))
        result('Email confirmation enabled',not data.get('mailer_autoconfirm',False))
    rejection=httpx.get(f'{cfg.supabase_url}/auth/v1/user',headers={'apikey':cfg.supabase_publishable_key,'Authorization':'Bearer intentionally-invalid-test-token'},timeout=15)
    result('Real Auth rejects invalid token',rejection.status_code in (401,403))
except Exception as exc:
    result('Supabase Auth connectivity',False,type(exc).__name__)

if configured(cfg.database_url):
    try:
        # Refuse a connection string for another hosted Supabase project.
        ref=urlparse(cfg.supabase_url).hostname.split('.')[0]
        target=urlparse(cfg.database_url)
        same_project=(target.hostname == f'db.{ref}.supabase.co' or target.username == f'postgres.{ref}')
        result('Database connection targets selected project',same_project)
        if same_project:
            with psycopg.connect(cfg.database_url, connect_timeout=10) as conn:
                conn.execute("SET LOCAL statement_timeout='10s'")
                rows=conn.execute("SELECT relname,relrowsecurity FROM pg_class JOIN pg_namespace ON pg_namespace.oid=relnamespace WHERE nspname='public' AND relkind='r'").fetchall()
                tables=dict(rows)
                expected={'profiles','entitlements','usage_reservations','resumes','resume_analyses','interview_sessions','questions','answers','interview_reports','jobs','worker_heartbeats','api_rate_limits'}
                result('All Phase 2 tables exist', expected.issubset(tables), 'apply the committed migration if missing')
                result('RLS enabled on all Phase 2 tables',all(tables.get(name,False) for name in expected))
                bucket=conn.execute("SELECT public FROM storage.buckets WHERE id='resumes'").fetchone()
                result('Resume bucket exists and is private',bucket is not None and bucket[0] is False)
    except Exception as exc:
        result('Database connectivity/schema',False,type(exc).__name__)

if configured(cfg.supabase_secret_key):
    try:
        headers={'apikey':cfg.supabase_secret_key}
        if not cfg.supabase_secret_key.startswith('sb_secret_'):
            headers['Authorization']=f'Bearer {cfg.supabase_secret_key}'
        response=httpx.get(f'{cfg.supabase_url}/storage/v1/bucket/resumes',headers=headers,timeout=15)
        result('Storage server key and private bucket',response.status_code == 200 and response.json().get('public') is False)
    except Exception as exc:
        result('Storage connectivity',False,type(exc).__name__)

if args.provider_smoke and configured(cfg.groq_api_key):
    try:
        from app.ai.provider import GroqProvider
        from app.modules.schemas import Response
        GroqProvider().generate('Acknowledge this synthetic practice answer; no follow-up needed.',
            {'question':'How do you test an API?','answer':'I check contracts, authorization and persisted results.'},Response)
        result('Real Groq structured response',True)
    except Exception as exc:
        result('Real Groq structured response',False,type(exc).__name__)
elif not args.provider_smoke:
    print('NOT RUN: Groq inference (add --provider-smoke to send synthetic test content).')

print('Remaining setup checks:',len(failures))
raise SystemExit(1 if failures else 0)
