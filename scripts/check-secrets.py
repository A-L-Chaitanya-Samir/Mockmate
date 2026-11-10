"""Reports paths only, never matched secret values."""
import os
from pathlib import Path
import re
import subprocess
from dotenv import dotenv_values

files = subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard'],text=True).splitlines()
patterns = [re.compile(rb'gsk_[A-Za-z0-9]{25,}'), re.compile(rb'sb_secret_[A-Za-z0-9_-]{25,}'), re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')]
found = []
for name in files:
    path = Path(name)
    if not path.is_file(): continue
    content = path.read_bytes()
    if any(pattern.search(content) for pattern in patterns): found.append(name)
local_secrets = dotenv_values('backend/.env', encoding='utf-8-sig')
for key in ('GROQ_API_KEY','SUPABASE_SECRET_KEY','DATABASE_URL'):
    value = os.getenv(key) or local_secrets.get(key,'')
    if value and Path('.next/static').exists():
        for path in Path('.next/static').rglob('*.js'):
            if value.encode() in path.read_bytes(): found.append(str(path))
if found:
    print('Potential secrets found in paths:', '\n'.join(found))
    raise SystemExit(1)
print('PASS: no matching provider secrets/private keys in tracked or non-ignored files; configured server secrets absent from static bundles.')
