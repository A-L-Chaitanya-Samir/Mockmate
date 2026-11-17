"""Run only with a ready consenting tester. Temporary account; no email sends."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
from uuid import uuid4
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
import httpx
from app.core.config import settings
from app.core.db import transaction
from app.integrations.storage import Storage

parser = argparse.ArgumentParser()
parser.add_argument('--consent-audio-camera', action='store_true')
args = parser.parse_args()
if not args.consent_audio_camera:
    raise SystemExit('Explicit tester audio transmission/local-camera consent and readiness are required.')
cfg = settings()
headers = {'apikey': cfg.supabase_secret_key}
if not cfg.supabase_secret_key.startswith('sb_secret_'):
    headers['Authorization'] = 'Bearer '+cfg.supabase_secret_key
email, password = f'physical-acceptance-{uuid4().hex}@example.invalid', uuid4().hex+'aA9!'
response = httpx.post(cfg.supabase_url+'/auth/v1/admin/users', headers=headers,
    json={'email': email, 'password': password, 'email_confirm': True,
          'user_metadata': {'name': 'Physical Acceptance Tester'}}, timeout=20)
response.raise_for_status()
user = response.json()['id']
try:
    child = subprocess.Popen(['node', 'scripts/guided-physical.mjs'], stdin=subprocess.PIPE,
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    child.stdin.write(json.dumps({'email': email, 'password': password}))
    child.stdin.close()
    for line in child.stdout:
        if line.startswith(('PASS:', 'READY:', 'RESULT:')):
            print(line.rstrip(), flush=True)
        if line.startswith('RESULT: '):
            record = json.loads(line[len('RESULT: '):])
            with Path('docs/physical-acceptance-results.jsonl').open('a', encoding='utf-8') as output:
                output.write(json.dumps(record)+'\n')
    raise SystemExit(child.wait())

finally:
    with transaction() as conn:
        paths = conn.execute('SELECT storage_path FROM resumes WHERE user_id=%s', (user,)).fetchall()
    for row in paths:
        Storage().delete(row['storage_path'])
    response = httpx.delete(cfg.supabase_url+'/auth/v1/admin/users/'+user, headers=headers, timeout=20)
    response.raise_for_status()
    print('Temporary physical acceptance account and files removed.', flush=True)
