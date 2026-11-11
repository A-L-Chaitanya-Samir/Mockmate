"""Explicit live development acceptance. Creates and removes synthetic Auth users; no emails sent.
Requires running API, separate worker and optionally frontend. Never targets production by default.
"""
import argparse
import json
import subprocess
import sys
import time
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
import httpx
import psycopg
from app.core.config import settings

parser=argparse.ArgumentParser()
parser.add_argument('--run',action='store_true',help='Authorize synthetic test account/data creation and cleanup')
parser.add_argument('--browser',action='store_true')
parser.add_argument('--spoken-audio',type=Path,help='Synthetic speech WAV for real spoken-provider acceptance; device check is client-reported test data, not physical hardware verification')
args=parser.parse_args()
if not args.run:
    raise SystemExit('Use --run against your development project to create and clean up synthetic accounts.')
cfg=settings()
if cfg.missing_configuration():
    raise SystemExit('Backend configuration incomplete. Run scripts/check-setup.py first.')
admin={'apikey':cfg.supabase_secret_key}
if not cfg.supabase_secret_key.startswith('sb_secret_'):
    admin['Authorization']='Bearer '+cfg.supabase_secret_key
users=[]
results=[]
api=httpx.Client(base_url='http://127.0.0.1:8000',timeout=45)

def check(label, condition):
    if not condition: raise RuntimeError(label)
    results.append(label)
    print('PASS:',label,flush=True)

def auth_request(method,path,**kwargs):
    return httpx.request(method,cfg.supabase_url+'/auth/v1/'+path,timeout=30,**kwargs)

def request(method,path,owner=0,**kwargs):
    return api.request(method,'/api/v1'+path,headers={'Authorization':'Bearer '+users[owner]['token'],**kwargs.pop('headers',{})},**kwargs)

def ready(path,field,value,limit=300):
    until=time.monotonic()+limit
    while time.monotonic()<until:
        response=request('GET',path)
        if response.status_code != 200: raise RuntimeError('Polling API did not return 200')
        data=response.json()
        if data[field] == value: return data
        if data[field]=='failed': raise RuntimeError('Durable processing failed; inspect owned job status')
        time.sleep(3)
    raise RuntimeError('Processing timed out; provider may be rate limited')

try:
    check('Real API and separate worker ready',api.get('/ready').status_code==200)
    for number in range(2):
        email=f'mockmate-smoke-{uuid4().hex}@example.invalid'
        password=uuid4().hex+'aA9!'
        created=auth_request('POST','admin/users',headers=admin,json={'email':email,'password':password,'email_confirm':True,'user_metadata':{'name':f'Synthetic Member {number+1}'}})
        if created.status_code not in (200,201): raise RuntimeError('Synthetic Auth account creation failed')
        user={'id':created.json()['id'],'email':email,'password':password}
        users.append(user)
        login=auth_request('POST','token?grant_type=password',headers={'apikey':cfg.supabase_publishable_key},json={'email':email,'password':password})
        if login.status_code!=200: raise RuntimeError('Real password login failed')
        user['token']=login.json()['access_token']
        user['refresh']=login.json()['refresh_token']
    check('Two real Auth test accounts can log in',len(users)==2)
    check('Missing token rejected',api.get('/api/v1/workspace').status_code==401)
    check('Invalid token rejected',api.get('/api/v1/workspace',headers={'Authorization':'Bearer invalid-test-token'}).status_code==401)
    for owner in range(2):
        check(f'Account {owner+1} starts with isolated empty records',request('GET','/workspace',owner).json()['interviews']==[])
    profile={'name':'Synthetic Member One','role':'Python Backend Engineer','bio':'Synthetic test data only.'}
    check('Profile save',request('PUT','/profile',json=profile).status_code==200)
    check('Profiles isolated',request('GET','/workspace',1).json()['profile']['name']!='Synthetic Member One')
    binary=Path('backend/tests/fixtures/synthetic-resume.pdf').read_bytes()
    key=str(uuid4())
    def upload():
        return request('POST','/resumes',headers={'Idempotency-Key':key},files={'file':('synthetic-resume.pdf',binary,'application/pdf')},data={'target_role':'Python Backend Engineer'})
    response=upload()
    check('Real PDF accepted into durable queue',response.status_code==202)
    resume_id=response.json()['id']
    check('Duplicate upload does not create another resume',upload().json()['id']==resume_id)
    resume=ready('/resumes/'+resume_id,'status','ready')
    check('Real Groq analysis persisted with PDF evidence',bool(resume['analysis']['evidence']) and all(e['quote'] in 'Python engineer built accessible applications and maintained reliable APIs for internal teams.\n' for e in resume['analysis']['evidence']))
    link=request('GET',f'/resumes/{resume_id}/file')
    check('Authorized private PDF download',link.status_code==200 and httpx.get(link.json()['url'],timeout=30).content==binary)
    check('Cross-account resume and signed-link access rejected',request('GET',f'/resumes/{resume_id}',1).status_code==404 and request('GET',f'/resumes/{resume_id}/file',1).status_code==404)
    path=f'{users[0]["id"]}/{resume_id}.pdf'
    direct=httpx.get(cfg.supabase_url+'/storage/v1/object/authenticated/resumes/'+path,headers={'apikey':cfg.supabase_publishable_key,'Authorization':'Bearer '+users[1]['token']},timeout=30)
    check('Direct cross-account Storage request denied',direct.status_code!=200)
    config={'role':'Python Backend Engineer','type':'Technical','difficulty':'Medium','duration':10,'mode':'Spoken' if args.spoken_audio else 'Text','language':'Python','resume_id':resume_id}
    interview_key=str(uuid4())
    response=request('POST','/interviews',headers={'Idempotency-Key':interview_key},json=config)
    check('Configured interview queued',response.status_code==202)
    session_id=response.json()['id']
    check('Duplicate interview creation is idempotent',request('POST','/interviews',headers={'Idempotency-Key':interview_key},json=config).json()['id']==session_id)
    session=ready('/interviews/'+session_id,'status','active')
    check('Real Groq questions saved with configuration',len(session['questions'])==4 and session['config']==config)
    answer={'question_id':session['questions'][0]['id'],'text':'I use Pydantic for request validation, enforce ownership using the authenticated user ID, and wrap related PostgreSQL writes in a transaction. I test invalid tokens, cross-account access and duplicate requests.'}
    if args.spoken_audio:
        check('Spoken deadline waits for device acknowledgement',session['deadline'] is None)
        check('Client-reported test device acknowledgement accepted (not hardware verification)',request('POST',f'/interviews/{session_id}/device-check',json={'camera':True,'microphone':True,'detector':True,'audio_test':True,'consent':True}).status_code==200)
        audio_key=str(uuid4())
        def transcribe():
            return request('POST',f'/interviews/{session_id}/transcriptions',headers={'Idempotency-Key':audio_key},data={'question_id':answer['question_id']},files={'file':('synthetic-speech.wav',args.spoken_audio.read_bytes(),'audio/wav')})
        recording=transcribe()
        check('Authenticated synthetic audio accepted by durable pipeline',recording.status_code==202)
        transcription_id=recording.json()['id']
        check('Audio upload idempotency',transcribe().json()['id']==transcription_id)
        until=time.monotonic()+240
        while time.monotonic()<until:
            session=request('GET','/interviews/'+session_id).json()
            transcription=next(t for t in session['transcriptions'] if t['id']==transcription_id)
            if transcription['status']=='ready': break
            if transcription['status'] in ('failed','cancelled'): raise RuntimeError('Real transcription did not complete')
            time.sleep(3)
        check('Real Groq spoken transcript saved',transcription['status']=='ready' and 'authentication' in transcription['original_text'].lower())
        answer['text']=transcription['original_text'];answer['transcription_id']=transcription_id
        with psycopg.connect(cfg.database_url,connect_timeout=10) as conn:
            check('Temporary real-provider audio removed after success',conn.execute('SELECT audio_bytes IS NULL FROM transcriptions WHERE id=%s',(transcription_id,)).fetchone()[0])
    answer_key=str(uuid4())
    response=request('POST',f'/interviews/{session_id}/answers',headers={'Idempotency-Key':answer_key},json=answer)
    check('Actual answer saved',response.status_code==202)
    check('Duplicate answer idempotent',request('POST',f'/interviews/{session_id}/answers',headers={'Idempotency-Key':answer_key},json=answer).status_code==202)
    until=time.monotonic()+240
    while time.monotonic()<until:
        session=request('GET','/interviews/'+session_id).json()
        if session['questions'][0]['response']: break
        time.sleep(3)
    check('Real contextual interviewer response saved',bool(session['questions'][0]['response']))
    check('Completion accepted',request('POST',f'/interviews/{session_id}/complete').status_code==202)
    check('Duplicate completion accepted without extra evaluation',request('POST',f'/interviews/{session_id}/complete').status_code==202)
    session=ready('/interviews/'+session_id,'status','completed')
    check('Real report evaluates saved answers and history',session['questions'][0]['answer']==answer['text'] and bool(session['report']['questions']))
    if args.spoken_audio:
        check('Spoken provenance and separate integrity snapshot saved',session['questions'][0]['modality']=='spoken' and session['questions'][0]['original_transcript']==answer['text'] and session['integrity'] is not None)
    check('Cross-account report rejected',request('GET','/interviews/'+session_id,1).status_code==404)
    jobs=request('GET','/jobs').json()
    check('Cross-account job rejected',request('GET','/jobs/'+jobs[0]['id'],1).status_code==404)
    refresh=auth_request('POST','token?grant_type=refresh_token',headers={'apikey':cfg.supabase_publishable_key},json={'refresh_token':users[0]['refresh']})
    check('Real session refresh',refresh.status_code==200)
    users[0]['token']=refresh.json()['access_token']
    with psycopg.connect(cfg.database_url,connect_timeout=10) as conn:
        count=conn.execute('SELECT count(*) FROM interview_reports WHERE session_id=%s',(session_id,)).fetchone()[0]
        used=conn.execute('SELECT count(*) FROM usage_reservations WHERE user_id=%s',(users[0]['id'],)).fetchone()[0]
        check('One report and two resource reservations',count==1 and used==2)
    if args.browser:
        script=Path('scripts/live-browser-smoke.mjs')
        run=subprocess.run(['node',str(script)],input=json.dumps({'users':users,'resume_id':resume_id,'session_id':session_id}),capture_output=True,text=True,timeout=180)
        # Never print arbitrary child errors/console text, which could contain credentials.
        for line in run.stdout.splitlines():
            if line.startswith('PASS:'): print(line,flush=True)
        check('Actual provider browser journeys',run.returncode==0)
        # Browser logout intentionally revokes this account's other sessions.
        login=auth_request('POST','token?grant_type=password',headers={'apikey':cfg.supabase_publishable_key},json={'email':users[0]['email'],'password':users[0]['password']})
        check('Fresh API login after browser logout',login.status_code==200)
        users[0]['token']=login.json()['access_token']
    deletion=request('DELETE','/resumes/'+resume_id)
    check('Resume deletion queued',deletion.status_code==202)
    until=time.monotonic()+90
    while time.monotonic()<until:
        if request('GET','/resumes/'+resume_id).status_code==404: break
        time.sleep(2)
    check('Private resume and related analyses deleted',request('GET','/resumes/'+resume_id).status_code==404)
    print('LIVE SMOKE PASSED:',len(results),'checks',flush=True)
except Exception as exc:
    print('LIVE SMOKE FAILED:',type(exc).__name__,flush=True)
    if isinstance(exc,RuntimeError): print('Check:',str(exc),flush=True)
    raise SystemExit(1)
finally:
    # Delete Storage objects before Auth cascades; never touch other account IDs.
    from app.integrations.storage import Storage
    for user in users:
        try:
            with psycopg.connect(cfg.database_url,connect_timeout=10) as conn:
                for path, in conn.execute('SELECT storage_path FROM public.resumes WHERE user_id=%s',(user['id'],)).fetchall():
                    Storage().delete(path)
            deleted=auth_request('DELETE','admin/users/'+user['id'],headers=admin)
            print('Synthetic account cleanup:', 'PASS' if deleted.status_code in (200,204) else 'NEEDS ATTENTION',flush=True)
        except Exception:
            print('Synthetic account cleanup: NEEDS ATTENTION',flush=True)
    api.close()
