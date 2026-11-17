from functools import lru_cache
import re
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Literal


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='backend/.env', env_file_encoding='utf-8-sig', extra='ignore')
    database_url: str = ''
    supabase_url: str = ''
    supabase_publishable_key: str = ''
    supabase_secret_key: str = ''
    groq_api_key: str = ''
    groq_model: str = 'openai/gpt-oss-20b'
    transcription_model: str = 'whisper-large-v3-turbo'
    transcription_provider: Literal['groq'] = 'groq'
    max_audio_bytes: int = 8 * 1024 * 1024
    max_audio_seconds: int = 120
    audio_min_rms: float = 0.003
    observation_sample_ms: int = 750
    observation_sustain_ms: int = 4000
    observation_debounce_ms: int = 1000
    observation_recovery_ms: int = 2000
    observation_cooldown_ms: int = 10000
    face_model_path: str = '/mediapipe/blaze_face_short_range.tflite'
    face_min_confidence: float = 0.6
    vision_enabled: bool = True
    vision_model: str = 'qwen/qwen3.8-27b'
    vision_interval_seconds: int = 20
    vision_audit_seconds: int = 60
    vision_max_per_minute: int = 3
    vision_max_per_day: int = 80
    vision_max_per_session: int = 180
    vision_max_image_bytes: int = 128 * 1024
    ai_max_tokens: int = 4096
    groq_reasoning_effort: Literal['low','medium','high'] = 'low'
    ai_input_chars: int = 11000
    resume_limit: int = Field(default=10, ge=1)
    interview_limit: int = Field(default=3, ge=1)
    usage_window_hours: int = Field(default=24, ge=1, le=168)
    cors_origins: list[str] = ['http://localhost:3000']
    max_pdf_bytes: int = 5 * 1024 * 1024
    lease_seconds: int = 180
    max_job_attempts: int = 3

    def missing_configuration(self) -> list[str]:
        return [name.upper() for name in ('database_url', 'supabase_url', 'supabase_publishable_key',
                'supabase_secret_key', 'groq_api_key') if not configured(getattr(self, name))]


def configured(value: str) -> bool:
    """Example-file placeholders must never be submitted as real credentials."""
    return bool(value.strip()) and not bool(re.search(
        r'your[-_ ]|YOUR_|\[YOUR|your-project|your-password', value))


@lru_cache
def settings():
    return Settings()
