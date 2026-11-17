from datetime import datetime, timezone
from io import BytesIO
from uuid import uuid4
import httpx
import pytest
from PIL import Image, ImageDraw
from psycopg.errors import InsufficientPrivilege
from app.core.auth import identity
from app.core.config import settings
from app.core.db import transaction
from app.core.errors import AppError
from app.integrations.vision import normalize_frame, GroqVision, VisionUnavailable
from app.modules import vision, service
from app.modules.schemas import PhoneFinding
from app.main import app
from test_spoken import spoken


def photo(offset=0):
    image=Image.new('RGB',(320,240),'white');draw=ImageDraw.Draw(image)
    draw.rectangle((20+offset,20,180,200),fill='navy');draw.rectangle((200,30,300,150),fill='orange')
    output=BytesIO();image.save(output,format='JPEG');return output.getvalue()


class FakeVision:
    def __init__(self, findings=('visible','visible','not_visible')): self.findings=iter(findings);self.calls=0
    def inspect(self, data, model):
        self.calls+=1
        with Image.open(BytesIO(data)) as image:
            assert image.width<=640 and image.height<=640 and not image.getexif()
        return PhoneFinding(phone_visibility=next(self.findings))


def upload(client,url,key=None,data=None):
    return client.post(url+'/vision-checks',headers={'Idempotency-Key':key or str(uuid4())},
        data={'observed_at':datetime.now(timezone.utc).isoformat()},files={'file':('frame.jpg',data or photo(),'image/jpeg')})


def age():
    with transaction() as conn: conn.execute("UPDATE interview_vision_checks SET received_at=received_at-interval '21 seconds'")


@pytest.mark.parametrize('data,mime',[ (b'bad','image/jpeg'),(photo(),'image/png'),(b'x'*131073,'image/jpeg') ])
def test_invalid_images_rejected_before_provider(data,mime):
    with pytest.raises(AppError):normalize_frame(data,mime)


def test_phone_checks_require_consent_and_owner_and_preserve_report(client,accounts,monkeypatch):
    monkeypatch.setattr(settings(),'groq_api_key','test-only-key')
    fake=FakeVision();monkeypatch.setattr(vision,'GroqVision',lambda:fake)
    url,q,worker=spoken(client)
    assert upload(client,url).status_code==403 and fake.calls==0
    assert client.put(url+'/vision-consent',json={'enabled':True}).json()['enabled']
    app.dependency_overrides[identity]=lambda:accounts[1]
    assert upload(client,url).status_code==404
    assert client.get(url+'/vision').status_code==404
    assert client.put(url+'/vision-consent',json={'enabled':False}).status_code==404
    app.dependency_overrides[identity]=lambda:accounts[0]
    key=str(uuid4());first=upload(client,url,key)
    assert first.status_code==200,first.text
    assert first.json()['latest']['result']=='visible' and not first.json()['warning_active']
    assert upload(client,url,key).json()['checks']==1 and fake.calls==1
    assert upload(client,url,key,photo(4)).status_code==409
    assert upload(client,url).json()['retry_after']>0 and fake.calls==1
    age();second=upload(client,url).json()
    assert second['warning_active'] and second['latest']['phase']=='start'
    episode=second['latest']['episode_id']
    age();third=upload(client,url).json()
    assert not third['warning_active'] and third['latest']['phase']=='recovered' and third['latest']['episode_id']==episode
    saved=client.post(url+'/complete').json()['integrity']['vision']
    assert saved['checks']==3 and saved['episodes']==1 and saved['visible']==2
    assert upload(client,url).status_code==409
    assert client.get(url).json()['integrity']['vision']==saved
    with transaction() as conn:
        columns={r['column_name'] for r in conn.execute("SELECT column_name FROM information_schema.columns WHERE table_name='interview_vision_checks'")}
        assert not columns & {'image','image_bytes','jpeg','frame','base64'}
    with pytest.raises(InsufficientPrivilege):
        with transaction() as conn:
            conn.execute('SET LOCAL ROLE authenticated');conn.execute('SELECT * FROM interview_vision_checks')


def test_quota_pause_shared_and_failure_not_a_phone_detection(client,monkeypatch):
    monkeypatch.setattr(settings(),'groq_api_key','test-only-key')
    class Limited:
        def inspect(self,*args):raise VisionUnavailable('provider_quota',90)
    monkeypatch.setattr(vision,'GroqVision',Limited)
    url,q,w=spoken(client);client.put(url+'/vision-consent',json={'enabled':True})
    result=upload(client,url).json()
    assert result['latest']['status']=='unavailable' and result['latest']['result'] is None and result['retry_after']==90
    age();result=upload(client,url).json()
    assert result['checks']==1 and result['retry_after']>60 and not result['warning_active']


def test_withdrawal_and_completion_fence_inflight_results(client,accounts,monkeypatch):
    monkeypatch.setattr(settings(),'groq_api_key','test-only-key')
    url,q,w=spoken(client);resource=url.rsplit('/',1)[-1]
    client.put(url+'/vision-consent',json={'enabled':True})
    class Withdraw:
        def inspect(self,*args):
            with transaction() as conn:vision.consent(conn,accounts[0],resource,False)
            return PhoneFinding(phone_visibility='visible')
    monkeypatch.setattr(vision,'GroqVision',Withdraw)
    result=upload(client,url).json()
    assert not result['enabled'] and result['latest']['error_code']=='consent_withdrawn'
    age();client.put(url+'/vision-consent',json={'enabled':True})
    class Complete:
        def inspect(self,*args):
            with transaction() as conn:service.complete(conn,accounts[0],resource)
            return PhoneFinding(phone_visibility='visible')
    monkeypatch.setattr(vision,'GroqVision',Complete)
    result=upload(client,url).json()
    assert result['latest']['result'] is None
    assert client.get(url).json()['integrity']['vision']['unavailable']==2


def test_budgets_and_model_errors(client,monkeypatch):
    monkeypatch.setattr(settings(),'groq_api_key','test-only-key')
    monkeypatch.setattr(settings(),'vision_max_per_session',1)
    fake=FakeVision();monkeypatch.setattr(vision,'GroqVision',lambda:fake)
    url,q,w=spoken(client);client.put(url+'/vision-consent',json={'enabled':True});upload(client,url);age()
    assert upload(client,url).json()['retry_after']==86400 and fake.calls==1
    monkeypatch.setattr(httpx,'post',lambda *a,**k:httpx.Response(429,headers={'retry-after':'70'}))
    with pytest.raises(VisionUnavailable) as error:GroqVision().inspect(photo(),'test-model')
    assert error.value.code=='provider_quota' and error.value.retry_after==70
    monkeypatch.setattr(httpx,'post',lambda *a,**k:httpx.Response(200,request=httpx.Request('POST','https://example.test'),json={'choices':[{'message':{'content':'{"phone_visibility":"uncertain"}'}}]}))
    assert GroqVision().inspect(photo(),'test-model').phone_visibility=='uncertain'


@pytest.mark.parametrize('setting,minimum',[('vision_max_per_minute',1),('vision_max_per_day',3600)])
def test_shared_budget_survives_check_metadata_deletion(client,monkeypatch,setting,minimum):
    monkeypatch.setattr(settings(),'groq_api_key','test-only-key')
    monkeypatch.setattr(settings(),setting,1)
    fake=FakeVision(('not_visible',));monkeypatch.setattr(vision,'GroqVision',lambda:fake)
    url,q,w=spoken(client);client.put(url+'/vision-consent',json={'enabled':True})
    assert upload(client,url).json()['checks']==1
    with transaction() as conn:conn.execute('DELETE FROM interview_vision_checks')
    result=upload(client,url).json()
    assert result['checks']==0 and result['retry_after']>=minimum and fake.calls==1
