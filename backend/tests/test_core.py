from io import BytesIO
import json
from uuid import uuid4
import httpx
import pytest
from fastapi.testclient import TestClient
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import ValidationError
from pypdf import PdfWriter
from reportlab.pdfgen import canvas
from app.main import app
from app.core.auth import identity
from app.core.config import settings
from app.core.errors import AppError, ProviderError
from app.ai.provider import GroqProvider
from app.integrations.pdf import extract_pdf, minimize
from app.modules.schemas import Analysis, InterviewCreate, Response


def pdf(text='Python engineer built accessible applications and maintained reliable APIs for internal teams.'):
    stream = BytesIO()
    c = canvas.Canvas(stream)
    c.drawString(40, 700, text)
    c.save()
    return stream.getvalue()


def test_health_and_missing_token():
    with TestClient(app) as client:
        assert client.get('/health').status_code == 200
        result = client.get('/api/v1/workspace')
        assert result.status_code == 401
        assert result.json()['error']['request_id'] == result.headers['x-request-id']


@pytest.mark.parametrize('token', ['invalid', 'expired'])
def test_auth_rejects_invalid_and_expired(monkeypatch, token):
    settings().supabase_url = 'https://example.supabase.co'
    settings().supabase_publishable_key = 'test-publishable'
    monkeypatch.setattr(httpx, 'get', lambda *a, **k: httpx.Response(401))
    with pytest.raises(AppError) as error:
        identity(HTTPAuthorizationCredentials(scheme='Bearer', credentials=token))
    assert error.value.status == 401


def test_auth_requires_confirmed_email(monkeypatch):
    monkeypatch.setattr(httpx, 'get', lambda *a, **k: httpx.Response(200, json={'id': str(uuid4())}))
    with pytest.raises(AppError) as error:
        identity(HTTPAuthorizationCredentials(scheme='Bearer', credentials='unverified'))
    assert error.value.status == 401


def test_pdf_real_content_and_minimization():
    assert 'Python engineer' in extract_pdf(pdf(), 'resume.pdf', 'application/pdf')
    minimized = minimize('Contact me at owner@example.com https://example.com +1 212 555 1234')
    assert 'owner@example.com' not in minimized
    assert 'https://' not in minimized
    assert '212' not in minimized


@pytest.mark.parametrize('data,name,mime,code', [(b'bad','x.pdf','application/pdf','invalid_pdf'), (pdf(),'x.txt','application/pdf','invalid_pdf'), (pdf(),'x.pdf','text/plain','invalid_pdf'), (b'%PDF-bad','x.pdf','application/pdf','corrupt_pdf'), (pdf(' '),'x.pdf','application/pdf','no_text'), (b'%PDF-'+b' '*(5*1024*1024),'x.pdf','application/pdf','pdf_size')])
def test_pdf_failures(data, name, mime, code):
    with pytest.raises(AppError) as error:
        extract_pdf(data, name, mime)
    assert error.value.code == code


def test_encrypted_pdf():
    writer = PdfWriter(); writer.add_blank_page(100,100); writer.encrypt('secret')
    stream = BytesIO(); writer.write(stream)
    with pytest.raises(AppError) as error:
        extract_pdf(stream.getvalue(), 'x.pdf', 'application/pdf')
    assert error.value.code == 'encrypted_pdf'


def test_provider_rate_limit_and_invalid_output(monkeypatch):
    settings().groq_api_key = 'test-only'
    monkeypatch.setattr(httpx, 'post', lambda *a, **k: httpx.Response(429, headers={'retry-after':'7'}))
    with pytest.raises(ProviderError) as error:
        GroqProvider().generate('task', {}, Response)
    assert error.value.retry_after == 7
    monkeypatch.setattr(httpx, 'post', lambda *a, **k: httpx.Response(200, json={'choices':[{'message':{'content':'{"message":4}'}}]}, request=httpx.Request('POST','https://api.groq.com')))
    with pytest.raises(ProviderError):
        GroqProvider().generate('task', {}, Response)


def test_unsupported_options_and_output_validation():
    with pytest.raises(ValidationError):
        InterviewCreate(role='Engineer',type='Technical',difficulty='Medium',duration=20,mode='Voice')
    with pytest.raises(ValidationError):
        Analysis(score=101)


def test_contract_matches_export():
    from pathlib import Path
    contract = Path(__file__).resolve().parents[2] / 'contracts' / 'openapi.json'
    assert app.openapi() == json.loads(contract.read_text(encoding='utf-8'))


def test_example_credentials_never_count_as_configured():
    from app.core.config import configured, Settings
    assert not configured('your-account-key')
    assert not configured('postgresql://postgres:your-password@localhost/postgres')
    assert not configured('')
    cfg=Settings(_env_file=None)
    assert set(cfg.missing_configuration()) == {'DATABASE_URL','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY','GROQ_API_KEY'}


def test_placeholder_groq_key_never_leaves_server(monkeypatch):
    monkeypatch.setattr(settings(), 'groq_api_key', 'your-account-key')
    def network_must_not_run(*args, **kwargs):
        raise AssertionError('Placeholder credential reached HTTP client')
    monkeypatch.setattr(httpx, 'post', network_must_not_run)
    with pytest.raises(ProviderError):
        GroqProvider().generate('test',{},Response)


def test_provider_rejected_schema_and_truncation_are_safe_and_actionable(monkeypatch):
    monkeypatch.setattr(settings(), 'groq_api_key', 'test-only')
    monkeypatch.setattr(httpx,'post',lambda *a,**k: httpx.Response(400,json={'error':{'code':'json_validate_failed','message':'PRIVATE RESUME CONTENT','failed_generation':'PRIVATE RESUME CONTENT'}}))
    with pytest.raises(ProviderError) as error:
        GroqProvider().generate('task',{},Response)
    assert 'required format' in error.value.message
    assert 'PRIVATE' not in error.value.message
    monkeypatch.setattr(httpx,'post',lambda *a,**k: httpx.Response(200,json={'choices':[{'finish_reason':'length','message':{'content':'PRIVATE'}}]},request=httpx.Request('POST','https://api.groq.com')))
    with pytest.raises(ProviderError) as error:
        GroqProvider().generate('task',{},Response)
    assert 'output budget' in error.value.message


def test_gpt_oss_receives_configurable_low_reasoning_and_output_budget(monkeypatch):
    monkeypatch.setattr(settings(), 'groq_api_key', 'test-only')
    monkeypatch.setattr(settings(), 'groq_reasoning_effort', 'low')
    def respond(*args,**kwargs):
        assert kwargs['json']['reasoning_effort']=='low'
        assert kwargs['json']['max_completion_tokens']==settings().ai_max_tokens
        return httpx.Response(200,json={'choices':[{'finish_reason':'stop','message':{'content':'{"message":"Acknowledged.","follow_up":null}'}}]},request=httpx.Request('POST','https://api.groq.com'))
    monkeypatch.setattr(httpx,'post',respond)
    assert GroqProvider().generate('task',{},Response).message=='Acknowledged.'
