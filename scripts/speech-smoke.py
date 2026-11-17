"""Explicit real Groq acceptance with a supplied synthetic speech WAV, never fixture output."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from app.core.config import settings
from app.core.errors import AppError
from app.integrations.speech import validate_audio, GroqSpeech

try:
    source = Path(sys.argv[1])
    audio, duration = validate_audio(source.read_bytes(), 'audio/wav')
    text = GroqSpeech().transcribe(audio, settings().transcription_model)
    expected = ('authentication', 'ownership', 'transactions')
    if not all(word in text.lower() for word in expected):
        raise RuntimeError('Transcript did not contain expected synthetic sample terms')
    print(f'PASS: real Groq {settings().transcription_model}, {duration:.1f}s synthetic speech, validated expected transcript terms. Not real microphone verification.')
except AppError as error:
    print(f'NOT VERIFIED: {error.message}')
    raise SystemExit(2)
