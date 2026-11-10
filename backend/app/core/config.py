from functools import lru_cache
import re
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
    ai_max_tokens: int = 4096
    groq_reasoning_effort: Literal['low','medium','high'] = 'low'
    ai_input_chars: int = 11000
    free_resume_limit: int = 3
    free_interview_limit: int = 3
    pro_resume_limit: int = 20
    pro_interview_limit: int = 20
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
