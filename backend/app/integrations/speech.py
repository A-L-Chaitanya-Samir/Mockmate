"""Bounded local decoding; only normalized mono audio leaves the server."""
from array import array
from io import BytesIO
import math
import wave
import httpx
from app.core.config import settings, configured
from app.core.errors import AppError, ProviderError

MIMES = {'audio/webm': {'matroska', 'webm'}, 'audio/ogg': {'ogg'},
    'audio/mp4': {'mov', 'mp4', 'm4a', '3gp', '3g2', 'mj2'}, 'audio/wav': {'wav'}, 'audio/x-wav': {'wav'}}


def validate_audio(data: bytes, mime: str) -> tuple[bytes, float]:
    cfg = settings()
    if mime.split(';')[0].lower() not in MIMES:
        raise AppError(422, 'audio_format', 'Unsupported audio format. Try another supported browser.')
    if not data or len(data) > cfg.max_audio_bytes:
        raise AppError(422, 'audio_size', 'Audio must be nonempty and at most 8 MB.')
    try:
        import av
    except ImportError:
        raise AppError(503, 'audio_decoder_missing', 'The server audio decoder is not installed.') from None
    pcm = bytearray()
    voiced = 0
    try:
        with av.open(BytesIO(data)) as container:
            if not set(container.format.name.split(',')) & MIMES[mime.split(';')[0].lower()]:
                raise ValueError('Container does not match a supported recording type')
            if len(container.streams.audio) != 1 or container.streams.video:
                raise ValueError('Expected one audio track')
            codec = container.streams.audio[0].codec_context
            if not 8000 <= codec.sample_rate <= 192000 or not 1 <= codec.channels <= 2:
                raise ValueError('Unsupported audio sampling rate or channel count')
            resampler = av.AudioResampler(format='s16', layout='mono', rate=16000)
            for frame in container.decode(audio=0):
                for converted in resampler.resample(frame):
                    chunk = bytes(converted.planes[0])[:converted.samples * 2]
                    pcm.extend(chunk)
                    if len(pcm) > min(cfg.max_audio_seconds, 120) * 32000:
                        raise AppError(422, 'audio_duration', 'Record an answer of 1–120 seconds.')
                    samples = array('h', chunk)
                    if samples and math.sqrt(sum(v*v for v in samples)/len(samples))/32768 >= cfg.audio_min_rms:
                        voiced += len(samples)
    except AppError:
        raise
    except Exception:
        raise AppError(422, 'audio_decode', 'Audio could not be decoded. Re-record in a supported format.') from None
    duration = len(pcm) / 32000
    if duration < 1:
        raise AppError(422, 'audio_duration', 'Record an answer of 1–120 seconds.')
    if voiced < 4800:
        raise AppError(422, 'audio_silent', 'Very little audio was detected. Check your microphone and re-record.')
    output = BytesIO()
    with wave.open(output, 'wb') as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(16000)
        writer.writeframes(pcm)
    return output.getvalue(), duration


class GroqSpeech:
    def transcribe(self, audio: bytes, model: str) -> str:
        cfg = settings()
        if not configured(cfg.groq_api_key):
            raise ProviderError('Groq transcription is not configured. Ask the operator to configure the server key.')
        try:
            response = httpx.post('https://api.groq.com/openai/v1/audio/transcriptions',
                headers={'Authorization': f'Bearer {cfg.groq_api_key}'},
                files={'file': ('answer.wav', audio, 'audio/wav')},
                data={'model': model, 'response_format': 'verbose_json', 'temperature': '0'}, timeout=45)
            if response.status_code == 429:
                delay = response.headers.get('retry-after', '30')
                raise ProviderError('Groq speech quota exhausted. Retrying with backoff; no paid fallback is enabled.', min(3600, int(delay)) if delay.isdigit() else 30)
            if response.status_code in (400, 401, 403, 404):
                raise ProviderError('Groq transcription rejected the configured key, model, or audio. Check account model access.')
            response.raise_for_status()
            result = response.json()
            text = result.get('text', '').strip()
            segments = result.get('segments') or []
            if len(text) < 10 or len(text) > 2000 or not segments or all(s.get('no_speech_prob', 0) > .7 for s in segments):
                raise ProviderError('No reliable answer transcript was found. Re-record your answer.')
            return text
        except ProviderError:
            raise
        except (httpx.HTTPError, ValueError, TypeError, AttributeError):
            raise ProviderError('Speech transcription is temporarily unavailable. Retry or re-record your answer.') from None
