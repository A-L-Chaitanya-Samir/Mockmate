"""Deterministic browser harness ONLY. Never deploy or use with real provider keys."""
import base64
import json
import os
import threading
import time
from uuid import UUID
import sys
from pathlib import Path

sys.path[:0] = [str(Path('backend').resolve()), str(Path('backend/tests').resolve())]
from fastapi import Request
from fastapi.responses import JSONResponse
from app.main import app
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.db import transaction
from app.workers.runner import Worker
from test_integration import DeterministicProvider, MemoryStorage

if os.getenv('MOCKMATE_TEST_HARNESS') != '1':
    raise RuntimeError('Set MOCKMATE_TEST_HARNESS=1 to run deterministic test services.')
cfg = settings()
cfg.database_url = os.environ['TEST_DATABASE_URL']
cfg.supabase_url = 'http://127.0.0.1:8011'
cfg.supabase_publishable_key = 'test-publishable'
cfg.cors_origins = ['http://localhost:3100']
cfg.free_resume_limit = 3
cfg.free_interview_limit = 3
app.add_middleware(CORSMiddleware, allow_origins=['http://localhost:3100'], allow_methods=['*'], allow_headers=['*'])
users = [UUID('11111111-1111-4111-8111-111111111111'), UUID('22222222-2222-4222-8222-222222222222')]
with transaction() as conn:
    for user in users:
        conn.execute('DELETE FROM auth.users WHERE id=%s', (user,))
        conn.execute('INSERT INTO auth.users(id) VALUES(%s) ON CONFLICT DO NOTHING', (user,))

def encoded(value):
    return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')

def token(user):
    return encoded({'alg':'HS256','typ':'JWT'}) + '.' + encoded({'sub':str(user),'exp':int(time.time())+3600,'aud':'authenticated','role':'authenticated','session_id':str(user)}) + '.testsignature'

def user_view(user):
    return {'id':str(user),'aud':'authenticated','role':'authenticated','email':f'account{users.index(user)+1}@example.test',
        'email_confirmed_at':'2026-11-08T00:00:00Z','confirmed_at':'2026-11-08T00:00:00Z','created_at':'2026-11-08T00:00:00Z',
        'app_metadata':{'provider':'email'},'user_metadata':{},'identities':[],'is_anonymous':False}

@app.post('/auth/v1/token')
async def login(request: Request):
    body = await request.json()
    user = users[1] if body.get('email') == 'account2@example.test' else users[0]
    if body.get('password') != 'test-password-123' and not body.get('refresh_token'):
        return JSONResponse(status_code=400,content={'error':'invalid_grant','error_description':'Invalid login credentials'})
    return {'access_token':token(user),'refresh_token':str(user),'token_type':'bearer','expires_in':3600,'expires_at':int(time.time())+3600,'user':user_view(user)}

@app.get('/auth/v1/user')
def get_user(request: Request):
    bearer = request.headers.get('authorization','').removeprefix('Bearer ')
    for user in users:
        if bearer == token(user) or (bearer.split('.')[:2] == token(user).split('.')[:2]):
            return user_view(user)
    # Token expiry is independently checked by this test stub.
    try:
        payload = json.loads(base64.urlsafe_b64decode(bearer.split('.')[1]+'=='))
        if payload['exp'] > time.time() and UUID(payload['sub']) in users:
            return user_view(UUID(payload['sub']))
    except Exception:
        pass
    return JSONResponse(status_code=401,content={'message':'Invalid token'})

@app.post('/auth/v1/logout')
def logout(): return {}

@app.post('/auth/v1/recover')
def recover(): return {}

@app.post('/auth/v1/signup')
def signup(): return {'user':user_view(users[0]),'session':None, **user_view(users[0])}

worker = Worker(DeterministicProvider(), MemoryStorage())
def work():
    while True:
        try:
            worker.run_once()
        except Exception:
            pass
        time.sleep(0.3)
threading.Thread(target=work, daemon=True).start()

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=8011, access_log=False)
