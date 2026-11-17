"""Explicitly invokes your configured Groq account. Does not use personal data."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from app.ai.provider import GroqProvider
from app.core.config import settings, configured
from app.modules.schemas import Response

if not configured(settings().groq_api_key):
    print('NOT VERIFIED: GROQ_API_KEY is not configured in backend/.env.')
    raise SystemExit(2)
result = GroqProvider().generate('Briefly acknowledge this synthetic practice answer. Do not ask a follow-up.',
    {'question': 'How do you test an API?', 'answer':'I validate contracts, test authentication and authorization, and verify persisted results.'}, Response)
print(f'PASS: configured Groq model {settings().groq_model} returned a validated {type(result).__name__}.')
