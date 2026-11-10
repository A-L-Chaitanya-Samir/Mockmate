import hashlib
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, File, Form, Header, UploadFile
from psycopg.types.json import Jsonb
from app.core.auth import identity
from app.core.config import settings
from app.core.db import transaction, owned, enqueue
from app.core.errors import AppError
from app.integrations.pdf import extract_pdf
from app.integrations.storage import Storage
from app.modules import service
from app.modules.schemas import (Workspace, ProfileInput, ResumeView, InterviewView, InterviewCreate,
    AnswerInput, JobView, FileLink, Capabilities, ErrorResponse)

router = APIRouter(prefix='/api/v1', responses={401: {'model': ErrorResponse}, 404: {'model': ErrorResponse}, 409: {'model': ErrorResponse}, 422: {'model': ErrorResponse}, 429: {'model': ErrorResponse}, 503: {'model': ErrorResponse}})
User = Annotated[UUID, Depends(identity)]
Key = Annotated[UUID, Header(alias='Idempotency-Key')]


@router.get('/workspace', response_model=Workspace)
def workspace(user: User):
    with transaction() as conn:
        return service.workspace(conn, user)


@router.get('/capabilities', response_model=Capabilities)
def capabilities(user: User):
    with transaction() as conn:
        return service.capabilities(conn, user)


@router.put('/profile', response_model=ProfileInput)
def profile(data: ProfileInput, user: User):
    with transaction() as conn:
        service.ensure_account(conn, user)
        conn.execute('UPDATE profiles SET data=%s,updated_at=now() WHERE user_id=%s', (Jsonb(data.model_dump()), user))
    return data


@router.post('/resumes', response_model=ResumeView, status_code=202)
def upload(user: User, key: Key, file: UploadFile = File(), target_role: str = Form('', max_length=120)):
    data = file.file.read(settings().max_pdf_bytes + 1)
    # Validate before any durable reservation or private upload; worker independently revalidates.
    extract_pdf(data, file.filename or '', file.content_type or '')
    digest = hashlib.sha256(data).hexdigest()
    with transaction() as conn:
        resource = uuid4()
        selected = service.reserve(conn, user, 'resume', str(key), resource)
        if selected != resource:
            row = owned(conn, 'resumes', selected, user)
            if row['sha256'] != digest or row['target_role'] != target_role:
                raise AppError(409, 'idempotency_conflict', 'Request key was used for a different upload.')
            return service.resume_view(conn, row)
        path = f'{user}/{resource}.pdf'
        conn.execute('''INSERT INTO resumes(id,user_id,filename,storage_path,sha256,target_role,pdf_bytes)
            VALUES(%s,%s,%s,%s,%s,%s,%s)''', (resource, user, (file.filename or 'resume.pdf')[:255], path, digest, target_role, data))
        # The transactional outbox holds bytes only until successful private-storage upload.
        enqueue(conn, user, 'resume', resource, f'resume:{resource}')
        return service.resume_view(conn, owned(conn, 'resumes', resource, user))


@router.get('/resumes/{resource}', response_model=ResumeView)
def resume(resource: UUID, user: User):
    with transaction() as conn:
        return service.resume_view(conn, owned(conn, 'resumes', resource, user))


@router.get('/resumes/{resource}/file', response_model=FileLink)
def resume_file(resource: UUID, user: User):
    with transaction() as conn:
        row = owned(conn, 'resumes', resource, user)
        if row['status'] != 'ready':
            raise AppError(409, 'not_ready', 'File is not available yet.')
        return {'url': Storage().signed_url(row['storage_path'])}


@router.delete('/resumes/{resource}', status_code=202, response_model=JobView)
def delete_resume(resource: UUID, user: User):
    with transaction() as conn:
        owned(conn, 'resumes', resource, user, True)
        conn.execute("UPDATE resumes SET status='deleting',pdf_bytes=NULL WHERE id=%s AND user_id=%s", (resource, user))
        conn.execute("UPDATE jobs SET status='cancelled',lease_token=NULL WHERE user_id=%s AND resource_id=%s AND kind='resume' AND status IN ('queued','running','failed')", (user, resource))
        return enqueue(conn, user, 'delete_resume', resource, f'delete:{resource}')


@router.post('/interviews', status_code=202, response_model=InterviewView)
def create_interview(data: InterviewCreate, user: User, key: Key):
    with transaction() as conn:
        existing = conn.execute('SELECT resource_id FROM usage_reservations WHERE user_id=%s AND idempotency_key=%s', (user, str(key))).fetchone()
        if existing:
            prior = owned(conn, 'interview_sessions', existing['resource_id'], user)
            if prior['config'] != data.model_dump(mode='json'):
                raise AppError(409, 'idempotency_conflict', 'Request key was used for different interview settings.')
        return service.create_interview(conn, user, data, str(key))


@router.get('/interviews/{resource}', response_model=InterviewView)
def interview(resource: UUID, user: User):
    with transaction() as conn:
        return service.interview_view(conn, owned(conn, 'interview_sessions', resource, user))


@router.post('/interviews/{resource}/answers', status_code=202, response_model=InterviewView)
def answer(resource: UUID, data: AnswerInput, user: User, key: Key):
    with transaction() as conn:
        return service.answer(conn, user, resource, data, str(key))


@router.post('/interviews/{resource}/complete', status_code=202, response_model=InterviewView)
def complete(resource: UUID, user: User):
    with transaction() as conn:
        return service.complete(conn, user, resource)


@router.get('/jobs', response_model=list[JobView])
def jobs(user: User):
    with transaction() as conn:
        return conn.execute("SELECT * FROM jobs WHERE user_id=%s AND status!='cancelled' ORDER BY created_at DESC LIMIT 100", (user,)).fetchall()


@router.get('/jobs/{resource}', response_model=JobView)
def job(resource: UUID, user: User):
    with transaction() as conn:
        return owned(conn, 'jobs', resource, user)


@router.post('/jobs/{resource}/retry', status_code=202, response_model=JobView)
def retry_job(resource: UUID, user: User):
    with transaction() as conn:
        job = owned(conn, 'jobs', resource, user, True)
        if job['status'] != 'failed':
            return job
        if job['kind'] == 'response':
            session = owned(conn, 'interview_sessions', job['resource_id'], user)
            if session['status'] != 'active' or not session['deadline'] or session['deadline'] <= datetime.now(timezone.utc):
                raise AppError(409, 'session_closed', 'Complete this session instead of retrying a closed interview turn.')
        if job['retry_count'] >= 3:
            raise AppError(429, 'retry_limit', 'This job reached its retry allowance. Contact support.')
        # Failed initial jobs released their usage; retry must reacquire capacity atomically.
        if job['kind'] in ('resume', 'questions'):
            kind = 'resume' if job['kind'] == 'resume' else 'interview'
            caps = service.capabilities(conn, user)
            if caps[f'{kind}s_remaining'] <= 0:
                raise AppError(429, 'usage_limit', 'Usage allowance reached. Cannot retry yet.')
            conn.execute("UPDATE usage_reservations SET state='reserved' WHERE user_id=%s AND resource_id=%s AND state='released'", (user, job['resource_id']))
        conn.execute("UPDATE jobs SET status='queued',attempts=0,retry_count=retry_count+1,error=NULL,available_at=now(),lease_token=NULL WHERE id=%s AND user_id=%s", (resource, user))
        if job['kind'] == 'resume':
            conn.execute("UPDATE resumes SET status='processing' WHERE id=%s AND user_id=%s AND status!='deleting'", (job['resource_id'], user))
        if job['kind'] == 'questions':
            conn.execute("UPDATE interview_sessions SET status='generating' WHERE id=%s AND user_id=%s", (job['resource_id'], user))
        return owned(conn, 'jobs', resource, user)
