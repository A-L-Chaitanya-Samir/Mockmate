from array import array
from datetime import datetime, timezone
from io import BytesIO
import math
import wave
from uuid import uuid4
import httpx
import pytest
from app.core.auth import identity
from app.core.config import settings
from app.core.db import transaction
from app.core.errors import AppError, ProviderError
from app.integrations.speech import validate_audio, GroqSpeech
from app.main import app
from app.workers.runner import Worker, claim, cleanup_audio
from test_integration import DeterministicProvider, MemoryStorage


def audio(seconds=2, volume=1000):
    output = BytesIO()
    with wave.open(output, 'wb') as writer:
        writer.setnchannels(1); writer.setsampwidth(2); writer.setframerate(16000)
        writer.writeframes(array('h', (int(volume*math.sin(i*2*math.pi*440/16000)) for i in range(int(seconds*16000)))).tobytes())
    return output.getvalue()


def test_decoded_audio_not_client_duration_or_mime():
    normalized, duration = validate_audio(audio(), 'audio/wav')
    assert duration == 2
    with wave.open(BytesIO(normalized)) as reader:
        assert reader.getframerate() == 16000 and reader.getnchannels() == 1


@pytest.mark.parametrize('data,mime,code', [(b'bad','audio/wav','audio_decode'), (audio(),'text/plain','audio_format'),
    (audio(.5),'audio/wav','audio_duration'), (audio(volume=0),'audio/wav','audio_silent'),
    (b'x'*(8*1024*1024+1),'audio/webm','audio_size'), (audio(121),'audio/wav','audio_duration')])
def test_audio_rejections(data, mime, code):
    with pytest.raises(AppError) as exc: validate_audio(data, mime)
    assert exc.value.code == code


def test_speech_quota_credentials_silence_and_valid_text(monkeypatch):
    monkeypatch.setattr(settings(), 'groq_api_key', '')
    with pytest.raises(ProviderError, match='not configured'): GroqSpeech().transcribe(b'audio','test')
    monkeypatch.setattr(settings(), 'groq_api_key', 'synthetic-test-key')
    monkeypatch.setattr(httpx, 'post', lambda *a, **kw: httpx.Response(429, headers={'retry-after':'17'}))
    with pytest.raises(ProviderError) as exc: GroqSpeech().transcribe(b'audio','test')
    assert exc.value.retry_after == 17
    monkeypatch.setattr(httpx, 'post', lambda *a, **kw: httpx.Response(200, request=httpx.Request('POST','https://example.test'), json={'text':'Thank you for watching.', 'segments':[{'no_speech_prob':.99}]}))
    with pytest.raises(ProviderError, match='No reliable'): GroqSpeech().transcribe(b'audio','test')
    monkeypatch.setattr(httpx, 'post', lambda *a, **kw: httpx.Response(200, request=httpx.Request('POST','https://example.test'), json={'text':'I test ownership with two separate accounts.', 'segments':[{'no_speech_prob':.01}]}))
    assert GroqSpeech().transcribe(b'audio','test').startswith('I test ownership')


class Speech:
    def transcribe(self, data, model):
        assert data.startswith(b'RIFF')
        return 'I use database transactions to preserve consistency.'


def spoken(client):
    response = client.post('/api/v1/interviews', headers={'Idempotency-Key':str(uuid4())}, json={
        'role':'Engineer', 'type':'Technical', 'difficulty':'Medium', 'duration':10})
    assert response.status_code == 202, response.text
    worker = Worker(DeterministicProvider(), MemoryStorage(), Speech())
    worker.run_once()
    session = client.get(f"/api/v1/interviews/{response.json()['id']}").json()
    assert session['config']['mode'] == 'Spoken' and session['deadline'] is None
    url = f"/api/v1/interviews/{session['id']}"
    assert client.post(url+'/device-check', json={'camera':True,'microphone':True,'detector':True,'audio_test':True,'consent':True}).status_code == 200
    assert client.get(url).json()['deadline']
    return url, session['questions'][0]['id'], worker


def test_spoken_durable_transcription_provenance_report_and_isolation(client, accounts):
    url, question, worker = spoken(client)
    key = str(uuid4())
    def upload(data=audio(), q=question):
        return client.post(url+'/transcriptions', headers={'Idempotency-Key':key}, data={'question_id':q}, files={'file':('answer.wav',data,'audio/wav')})
    first = upload(); assert first.status_code == 202, first.text
    record = first.json()
    assert 'audio_bytes' not in record and 'user_id' not in record
    assert upload().json()['id'] == record['id']
    assert upload(audio(volume=2000)).status_code == 409
    app.dependency_overrides[identity] = lambda: accounts[1]
    assert upload().status_code == 404
    assert client.post(url+'/observations',json={'events':[event()]}).status_code == 404
    app.dependency_overrides[identity] = lambda: accounts[0]
    worker.run_once()
    session = client.get(url).json()
    assert session['transcriptions'][0]['status'] == 'ready'
    with transaction() as conn: assert conn.execute('SELECT audio_bytes FROM transcriptions').fetchone()['audio_bytes'] is None
    answer = {'question_id':question,'text':'I use database transactions and test rollback behavior.','transcription_id':record['id']}
    answer_key = {'Idempotency-Key':str(uuid4())}
    assert client.post(url+'/answers',json={'question_id':question,'text':answer['text']},headers=answer_key).status_code == 422
    assert client.post(url+'/answers',json=answer,headers=answer_key).status_code == 202
    assert client.post(url+'/answers',json=answer,headers=answer_key).status_code == 202
    saved = client.get(url).json()['questions'][0]
    assert saved['user_corrected'] and saved['original_transcript'] == Speech().transcribe(b'RIFF','test') and saved['modality'] == 'spoken'
    start = event(); recovery = event(episode_id=start['episode_id'], phase='recovered', duration_ms=4500)
    assert client.post(url+'/observations',json={'events':[start,recovery]}).status_code == 200
    assert client.post(url+'/observations',json={'events':[start,recovery]}).status_code == 200
    result = client.post(url+'/complete?observation_gaps=2')
    assert result.status_code == 202
    snapshot = result.json()['integrity']
    assert len(snapshot['events']) == 2 and snapshot['gaps'] == 2
    assert client.post(url+'/observations',json={'events':[event()]}).status_code == 409
    assert client.post(url+'/observations',json={'events':[start]}).status_code == 200
    worker.run_once()
    result = client.get(url).json()
    assert result['status'] == 'completed' and result['report']['overall'] == 17
    assert answer['text'] in result['report']['questions'][0]['feedback']
    assert result['integrity'] == snapshot


def event(**changes):
    return {'id':str(uuid4()),'episode_id':str(uuid4()),'kind':'no_face','phase':'start','observed_at':datetime.now(timezone.utc).isoformat(), **changes}


def test_event_bounds_and_terminal_audio_cleanup(client, accounts):
    url, q, worker = spoken(client)
    assert client.post(url+'/observations',json={'events':[event() for _ in range(26)]}).status_code == 422
    assert client.post(url+'/observations',json={'events':[event(kind='cheating')]}).status_code == 422
    assert client.post(url+'/observations',json={'events':[event(observed_at='2026-11-10T01:00:00')]}).status_code == 422
    result = client.post(url+'/transcriptions', headers={'Idempotency-Key':str(uuid4())},data={'question_id':q},files={'file':('answer.wav',audio(),'audio/wav')})
    assert result.status_code == 202
    class FailingSpeech:
        def transcribe(self, *args): raise ProviderError('Speech quota exhausted.',1)
    worker.speech = FailingSpeech()
    for _ in range(3):
        worker.run_once()
        with transaction() as conn: conn.execute("UPDATE jobs SET available_at=now() WHERE kind='transcribe'")
    record = client.get(url).json()['transcriptions'][0]
    assert record['status'] == 'failed'
    with transaction() as conn: assert conn.execute('SELECT audio_bytes FROM transcriptions').fetchone()['audio_bytes'] is None


def test_abandoned_audio_ttl_deadline_and_duplicate_answer(client, accounts):
    url,q,worker = spoken(client)
    result = client.post(url+'/transcriptions', headers={'Idempotency-Key':str(uuid4())},data={'question_id':q},files={'file':('answer.wav',audio(),'audio/wav')})
    assert result.status_code == 202
    with transaction() as conn:
        conn.execute("UPDATE transcriptions SET expires_at=now()-interval '1 second'")
        cleanup_audio(conn)
        assert conn.execute('SELECT audio_bytes,status FROM transcriptions').fetchone() == {'audio_bytes':None,'status':'cancelled'}
        conn.execute("UPDATE interview_sessions SET deadline=now()-interval '1 second'")
    worker.run_once()
    result = client.get(url).json()
    assert result['status'] == 'completed'
    assert result['integrity']['gaps'] >= 1


def test_chunked_event_body_has_a_byte_bound(client):
    result=client.post(f'/api/v1/interviews/{uuid4()}/observations',
        content=iter([b' '*40000,b' '*40000]),headers={'Content-Type':'application/json'})
    assert result.status_code == 413


def test_event_rate_limit_and_incomplete_device_checks(client):
    url,q,worker=spoken(client)
    assert client.post(url+'/device-check',json={'camera':True,'microphone':True,'detector':False,'audio_test':True,'consent':True}).status_code==422
    for _ in range(4): assert client.post(url+'/observations',json={'events':[event() for _ in range(25)]}).status_code==200
    assert client.post(url+'/observations',json={'events':[event() for _ in range(25)]}).status_code==429
    assert client.post(url+'/observations',json={'events':[event() for _ in range(20)]}).status_code==200
    assert client.post(url+'/observations',json={'events':[event()]}).status_code==429


def test_spoken_next_answer_does_not_wait_for_ai_acknowledgement(client):
    url,q,worker=spoken(client)
    questions=client.get(url).json()['questions']
    for index in range(2):
        question=questions[index]['id']
        upload=client.post(url+'/transcriptions',headers={'Idempotency-Key':str(uuid4())},
            data={'question_id':question},files={'file':('answer.wav',audio(),'audio/wav')})
        assert upload.status_code==202,upload.text
        assert worker.run_once()
        record=next(t for t in client.get(url).json()['transcriptions'] if t['id']==upload.json()['id'])
        assert record['status']=='ready'
        result=client.post(url+'/answers',headers={'Idempotency-Key':str(uuid4())},json={
            'question_id':question,'text':record['original_text'],'transcription_id':record['id']})
        assert result.status_code==202,result.text
        with transaction() as conn:
            conn.execute("UPDATE jobs SET available_at=now()+interval '1 hour' WHERE kind='response'")
    saved=client.get(url).json()
    assert all(q['answer'] and q['response'] is None for q in saved['questions'][:2])
    wrong=client.post(url+'/transcriptions',headers={'Idempotency-Key':str(uuid4())},
        data={'question_id':questions[3]['id']},files={'file':('answer.wav',audio(),'audio/wav')})
    assert wrong.status_code==409
