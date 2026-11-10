"""Real Auth confirmation/recovery without sending email. Creates and removes one synthetic user."""
import json
import subprocess
import sys
from uuid import uuid4
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
import httpx
from app.core.config import settings

if '--run' not in sys.argv:
    raise SystemExit('Use --run only against the configured development project.')
cfg=settings()
admin={'apikey':cfg.supabase_secret_key}
if not cfg.supabase_secret_key.startswith('sb_secret_'): admin['Authorization']='Bearer '+cfg.supabase_secret_key
public={'apikey':cfg.supabase_publishable_key}
email='auth-smoke-'+uuid4().hex+'@example.invalid'
password=uuid4().hex+'aA9!'
user_id=None

def request(method,path,headers=admin,**kwargs):
    return httpx.request(method,cfg.supabase_url+'/auth/v1/'+path,headers=headers,timeout=30,**kwargs)

def check(label,condition):
    if not condition: raise RuntimeError(label)
    print('PASS:',label,flush=True)

try:
    # generate_link creates the unconfirmed synthetic account but sends no mail.
    signup=request('POST','admin/generate_link',json={'type':'signup','email':email,'password':password})
    check('Synthetic signup token generated without email',signup.status_code==200)
    data=signup.json(); user_id=data['id']
    login=request('POST','token?grant_type=password',headers=public,json={'email':email,'password':password})
    check('Real Auth blocks login before email confirmation',login.status_code in (400,401,403))
    confirmed=request('POST','verify',headers=public,json={'type':'signup','token_hash':data['hashed_token']})
    check('Real signup confirmation token accepted',confirmed.status_code==200)
    login=request('POST','token?grant_type=password',headers=public,json={'email':email,'password':password})
    check('Real login succeeds after confirmation',login.status_code==200)
    recovery=request('POST','admin/generate_link',json={'type':'recovery','email':email})
    check('Real recovery token generated without email',recovery.status_code==200)
    token=recovery.json()['hashed_token']; new_password=uuid4().hex+'aA9!'
    check('Project default Auth redirect is local app',recovery.json().get('redirect_to','').rstrip('/')=='http://localhost:3000')
    code='''import {chromium} from '@playwright/test';
let raw=''; for await (const c of process.stdin) raw+=c;
const data=JSON.parse(raw); const browser=await chromium.launch({channel:'chrome'});
try { const context=await browser.newContext(); const page=await context.newPage();
await page.goto('http://localhost:3000/auth/callback?token_hash='+encodeURIComponent(data.token)+'&type=recovery');
await page.waitForURL('**/reset-password',{timeout:45000});
await page.getByLabel('Password',{exact:true}).fill(data.password);
await page.getByRole('button',{name:'Update password',exact:true}).click();
await page.waitForURL('**/login?message=password_updated',{timeout:45000});
console.log('PASS: Real recovery callback and reset-password browser form');
} catch { process.exitCode=1; } finally { await browser.close(); }
'''
    child=subprocess.run(['node','--input-type=module','-e',code],input=json.dumps({'token':token,'password':new_password}),capture_output=True,text=True,timeout=100)
    check('Real recovery callback and browser password reset',child.returncode==0)
    login=request('POST','token?grant_type=password',headers=public,json={'email':email,'password':new_password})
    check('New password works after recovery',login.status_code==200)
    old=request('POST','token?grant_type=password',headers=public,json={'email':email,'password':password})
    check('Old password rejected after recovery',old.status_code in (400,401,403))
    print('LIVE AUTH SMOKE PASSED (email delivery itself not tested).',flush=True)
except Exception as exc:
    print('LIVE AUTH SMOKE FAILED:',type(exc).__name__,flush=True)
    if isinstance(exc,RuntimeError): print('Check:',str(exc),flush=True)
    raise SystemExit(1)
finally:
    if user_id:
        removed=request('DELETE','admin/users/'+user_id)
        print('Synthetic Auth account cleanup:', 'PASS' if removed.status_code in (200,204) else 'NEEDS ATTENTION',flush=True)
