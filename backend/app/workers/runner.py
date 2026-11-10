"""Run from repository root: python -m app.workers.runner (PYTHONPATH=backend)."""
import logging
import signal
import time
from uuid import uuid4
from psycopg.types.json import Jsonb
from app.core.config import settings
from app.core.db import transaction, owned
from app.core.errors import AppError, ProviderError
from app.ai.provider import GroqProvider, Provider
from app.ai.evidence import ground_analysis
from app.integrations.pdf import extract_pdf, minimize
from app.integrations.storage import Storage
from app.modules.schemas import Analysis, Questions, Response, Report
from app.modules.service import interview_view

log = logging.getLogger('mockmate.worker')


def claim():
    with transaction() as conn:
        # Exhausted leases are finalized as failed and initial quota is released.
        exhausted = conn.execute("""UPDATE jobs SET status='failed',error='Processing interrupted too many times. Retry this job.',lease_token=NULL
            WHERE status='running' AND lease_until<now() AND attempts>=%s RETURNING *""", (settings().max_job_attempts,)).fetchall()
        for job in exhausted:
            mark_failure(conn, job)
        row = conn.execute("""WITH candidate AS (
            SELECT id FROM jobs WHERE ((status='queued' AND available_at<=now()) OR
            (status='running' AND lease_until<now())) AND attempts<%s
            ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT 1)
            UPDATE jobs j SET status='running',attempts=attempts+1,lease_token=%s,
            lease_until=now()+make_interval(secs=>%s) FROM candidate c WHERE j.id=c.id RETURNING j.*""",
            (settings().max_job_attempts, uuid4(), settings().lease_seconds)).fetchone()
        return row


def mark_failure(conn, job):
    if job['kind'] in ('resume', 'questions'):
        conn.execute("UPDATE usage_reservations SET state='released' WHERE user_id=%s AND resource_id=%s AND state='reserved'", (job['user_id'], job['resource_id']))
        table = 'resumes' if job['kind'] == 'resume' else 'interview_sessions'
        from psycopg import sql
        conn.execute(sql.SQL("UPDATE {} SET status='failed' WHERE id=%s AND user_id=%s AND status!='deleting'").format(sql.Identifier(table)), (job['resource_id'], job['user_id']))


class Worker:
    def __init__(self, provider: Provider | None = None, storage=None):
        self.provider = provider or GroqProvider()
        self.storage = storage or Storage()

    def process(self, job):
        user, resource, kind = job['user_id'], job['resource_id'], job['kind']
        with transaction() as conn:
            if kind in ('resume', 'delete_resume'):
                source = owned(conn, 'resumes', resource, user)
            else:
                source = owned(conn, 'interview_sessions', resource, user)
                view = interview_view(conn, source)
                context = {'configuration': source['config'], 'history': [
                    {k: q[k] for k in ('id','position','prompt','topic','answer')}
                    for q in view['questions']]}
                if kind == 'questions' and source['config'].get('resume_id'):
                    row = conn.execute('SELECT result FROM resume_analyses WHERE resume_id=%s AND user_id=%s ORDER BY version DESC LIMIT 1', (source['config']['resume_id'], user)).fetchone()
                    if row:
                        context['resume'] = row['result']
        if kind == 'resume':
            if source['status'] == 'deleting':
                return
            data = source['pdf_bytes'] or self.storage.download(source['storage_path'])
            text = minimize(extract_pdf(bytes(data), source['filename'], 'application/pdf'))
            with transaction() as conn:
                latest = owned(conn, 'resumes', resource, user, True)
                if latest['status'] == 'deleting':
                    return
                self.storage.upload(source['storage_path'], bytes(data))
            result = self.provider.generate('Analyze the supplied resume. Keep feedback concise: at most 20 skills, four strengths, four improvements and four short evidence quotes. Omit empty strings and duplicate items. Every evidence.quote MUST be copied verbatim as a contiguous substring of resume_text, without ellipses, added punctuation or paraphrases. Every skills entry MUST also be a verbatim substring: for example return "Python" if present, never infer "Python programming" or "API design" from broader wording. Return an empty skills list if no exact skill names are present. Feedback may describe missing evidence but must not invent achievements. State unavailable target-role relevance when no role is supplied.',
                {'resume_text': text, 'target_role': source['target_role']}, Analysis)
            result = ground_analysis(result, text)
        elif kind == 'questions':
            result = self.provider.generate('Generate exactly four distinct text interview questions grounded in the role, type, difficulty and optional resume. Respect the configured language for technical questions. No executable coding task.', context, Questions)
        elif kind == 'response':
            context['current_question_id'] = job['payload']['question_id']
            result = self.provider.generate('Respond briefly to the current answer using session context. Optionally ask one clarifying follow-up; use null if unnecessary. Do not evaluate voice/video.', context, Response)
        elif kind == 'evaluate':
            result = self.provider.generate('Evaluate this exact interview history, including unanswered questions as unanswered. Include feedback for EVERY question_id using its id. Score only text, relevance, reasoning and evidence. Provide concrete practice recommendations.', context, Report)
            if {str(q.question_id) for q in result.questions} != {str(q['id']) for q in view['questions']} or len(result.questions) != len(view['questions']):
                raise ProviderError('AI returned mismatched question feedback. Please retry.')
        elif kind == 'delete_resume':
            # Serialize external deletion against any analysis upload/result transaction.
            with transaction() as conn:
                owned(conn, 'resumes', resource, user, True)
                self.storage.delete(source['storage_path'])
                conn.execute('DELETE FROM resumes WHERE id=%s AND user_id=%s', (resource, user))
                conn.execute("DELETE FROM jobs WHERE resource_id=%s AND user_id=%s AND id!=%s", (resource, user, job['id']))
                conn.execute("UPDATE jobs SET status='succeeded',payload='{}',lease_token=NULL WHERE id=%s AND lease_token=%s", (job['id'], job['lease_token']))
            return
        else:
            raise AppError(422, 'job_kind', 'Unsupported job type.')
        with transaction() as conn:
            # Lock resource before job, matching API lock order; fence stale workers.
            source = owned(conn, 'resumes' if kind == 'resume' else 'interview_sessions', resource, user, True)
            current = owned(conn, 'jobs', job['id'], user, True)
            if current['lease_token'] != job['lease_token'] or current['status'] != 'running':
                if kind == 'resume' and source['status'] == 'deleting':
                    self.storage.delete(source['storage_path'])
                return
            if kind == 'resume':
                conn.execute("INSERT INTO resume_analyses(user_id,resume_id,version,result,model,prompt_version) VALUES(%s,%s,1,%s,%s,'phase2-resume-v2') ON CONFLICT(resume_id,version) DO NOTHING", (user, resource, Jsonb(result.model_dump(mode='json')), settings().groq_model))
                conn.execute("UPDATE resumes SET status='ready',pdf_bytes=NULL WHERE id=%s AND user_id=%s", (resource, user))
            elif kind == 'questions':
                for position, question in enumerate(result.questions):
                    conn.execute('INSERT INTO questions(user_id,session_id,position,prompt,topic) VALUES(%s,%s,%s,%s,%s) ON CONFLICT(session_id,position) DO NOTHING', (user, resource, position, question.prompt, question.topic))
                conn.execute("UPDATE interview_sessions SET status='active',deadline=now()+make_interval(mins=>%s) WHERE id=%s AND user_id=%s", (source['config']['duration'], resource, user))
            elif kind == 'response':
                count = conn.execute('SELECT count(*) n FROM questions WHERE session_id=%s AND user_id=%s', (resource, user)).fetchone()['n']
                if result.follow_up and count < 6 and source['status'] == 'active':
                    conn.execute('INSERT INTO questions(user_id,session_id,position,prompt,topic) VALUES(%s,%s,%s,%s,%s) ON CONFLICT(session_id,position) DO NOTHING', (user, resource, count, result.follow_up, 'Follow-up'))
                conn.execute('UPDATE answers SET response=%s WHERE question_id=%s AND user_id=%s', (Jsonb(result.model_dump()), job['payload']['question_id'], user))
            elif kind == 'evaluate':
                conn.execute('INSERT INTO interview_reports(user_id,session_id,result,model) VALUES(%s,%s,%s,%s) ON CONFLICT(session_id) DO NOTHING', (user, resource, Jsonb(result.model_dump(mode='json')), settings().groq_model))
                conn.execute("UPDATE interview_sessions SET status='completed' WHERE id=%s AND user_id=%s", (resource, user))
            if kind in ('resume', 'questions'):
                conn.execute("UPDATE usage_reservations SET state='consumed' WHERE user_id=%s AND resource_id=%s", (user, resource))
            conn.execute("UPDATE jobs SET status='succeeded',lease_token=NULL,error=NULL WHERE id=%s AND lease_token=%s", (job['id'], job['lease_token']))

    def run_once(self):
        job = claim()
        if not job:
            return False
        try:
            self.process(job)
        except Exception as exc:
            message = exc.message if isinstance(exc, AppError) else 'Processing failed. Please retry.'
            delay = getattr(exc, 'retry_after', 10 * 2 ** job['attempts'])
            with transaction() as conn:
                current = owned(conn, 'jobs', job['id'], job['user_id'], True)
                if current['lease_token'] == job['lease_token']:
                    final = job['attempts'] >= settings().max_job_attempts
                    conn.execute("UPDATE jobs SET status=%s,error=%s,lease_token=NULL,available_at=now()+make_interval(secs=>%s) WHERE id=%s", ('failed' if final else 'queued', message, delay, job['id']))
                    if final:
                        mark_failure(conn, job)
            log.warning('job_failed id=%s type=%s', job['id'], type(exc).__name__)
        return True


def main():
    running = True
    def stop(*_):
        nonlocal running
        running = False
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    worker = Worker()
    worker_id = uuid4()
    while running:
        with transaction() as conn:
            conn.execute('INSERT INTO worker_heartbeats(id) VALUES(%s) ON CONFLICT(id) DO UPDATE SET seen_at=now()', (worker_id,))
            conn.execute("DELETE FROM api_rate_limits WHERE minute<now()-interval '1 day'")
            conn.execute("DELETE FROM worker_heartbeats WHERE seen_at<now()-interval '1 day'")
        try:
            if not worker.run_once():
                time.sleep(2)
        except Exception as exc:
            log.error('worker_iteration_failed type=%s', type(exc).__name__)
            time.sleep(5)


if __name__ == '__main__':
    main()
