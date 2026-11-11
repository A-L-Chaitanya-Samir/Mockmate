"""Read-only Auth email audit. Never sends mail or prints SMTP/management secrets."""
import json
import os
from pathlib import Path
import sys
from urllib.parse import urlparse
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
import httpx
from app.core.config import settings

cfg = settings()
response = httpx.get(cfg.supabase_url+'/auth/v1/settings', headers={'apikey': cfg.supabase_publishable_key}, timeout=20)
response.raise_for_status()
public = response.json()
result = dict(confirmation_required=public.get('mailer_autoconfirm') is False,
    signup_enabled=not public.get('disable_signup', True), email_sent=False,
    provider_capacity_verified=False, inbox_delivery_verified=False)
token = os.getenv('SUPABASE_ACCESS_TOKEN')
if not token:
    result.update(hosted_smtp_verified=False, remaining_setup=[
        'Provide management access to the matching project, or inspect its Auth email/SMTP settings in Dashboard.',
        'Verify sender activation, actual provider limits and recipient restrictions.',
        'Verify approved Site URL and confirmation/recovery callback allowlist.',
        'Supply an explicitly authorized inbox for limited delivery tests; never paste credentials into chat.'])
else:
    ref = urlparse(cfg.supabase_url).hostname.split('.')[0]
    response = httpx.get('https://api.supabase.com/v1/projects/'+ref+'/config/auth',
        headers={'Authorization': 'Bearer '+token}, timeout=20)
    response.raise_for_status()
    config = response.json()
    result.update(custom_smtp_configured=bool(config.get('smtp_host')),
        send_email_hook_enabled=bool(config.get('hook_send_email_enabled')),
        hosted_email_sends_per_hour=config.get('rate_limit_email_sent'),
        recipient_cooldown_seconds=config.get('smtp_max_frequency'),
        confirmation_required=config.get('mailer_autoconfirm') is False,
        site_url=config.get('site_url'), approved_redirect_urls=config.get('uri_allow_list'),
        hosted_smtp_verified=True)
    # SMTP settings alone do not establish the provider account's quota/activation.
print(json.dumps(result, indent=2))
raise SystemExit(0 if result.get('hosted_smtp_verified') and result['confirmation_required'] else 2)
