# Mockmate architecture

Mockmate is a single free experience for authentication, account settings, resume upload and coaching, camera-on spoken interviews, saved reports, dashboard analytics, and suggestions.

## Runtime and ownership

Next.js App Router renders the existing responsive interface. Live mode is the default. Supabase Auth validates accounts; FastAPI validates identity and resource ownership on every protected API operation. PostgreSQL stores profiles, usage reservations, resumes and versioned analyses, interview sessions, questions, answers, reports, durable jobs, worker heartbeats, and request-rate counters. RLS remains enabled with owner-scoped read policies. Raw resume bytes and job payloads are accessible only through the backend.

Private PDF storage uses account/resource paths. API-authorized downloads expire after 60 seconds. PDF parsing and provider input budgets remain bounded. Resume excerpts and interview answers are sent to external AI; output schemas and evidence checks reject invalid results. Scores are coaching feedback, not hiring predictions.

## Durable processing

A separate Python worker claims jobs with database leases and unique tokens. It persists validated analyses, interview questions, responses, and reports. Backoff, retry limits, terminal-failure reservation releases, stale-worker fencing, idempotency, immutable answers, and server interview deadlines remain in place. Analytics and suggestions derive from account-owned saved results in live mode.

## Authorization and usage

All retained features are available to every account. The API returns only remaining resume and interview allowances. RESUME_LIMIT (default 20) and INTERVIEW_LIMIT (default 3) protect provider capacity, alongside the existing 120 authenticated requests per user per minute. Allowances count account-lifetime reservations; deleting successful resources does not reset usage. Profile-row locks serialize concurrent reservations. Client metadata cannot grant access or capacity.

The new single_free_experience migration drops only the obsolete entitlement table. Historical migrations are unchanged. Apply the new migration with the API and worker stopped, then restart them. Existing profiles, usage history, resumes, sessions, answers and reports are preserved. No coding database tables exist.

## Demo compatibility

NEXT_PUBLIC_DEMO_MODE=true selects explicitly simulated local services. The mockmate-demo-v1 storage key and version remain compatible. Validated hydration strips retired plan, coding, and learning fields and rewrites only retained profile, preferences, resume metadata, sessions/answers and history. Corrupt values recover safely. Demo interviews have a single browser-lifetime allowance of 20 created sessions; saved reports and sessions remain usable at the limit. All resume improvements, detailed report feedback and analytics are available without gates.

## Routes and verification

Workspace navigation: dashboard, resume analysis, AI camera-on spoken interviews, suggestions/advice, and settings. Analytics and saved reports are accessible from the interview/dashboard flows. /pricing redirects to /. Retired coding URLs use the ordinary not-found page, even while signed out.

CI verifies generated OpenAPI contracts, backend unit/integration tests, account isolation, usage enforcement and native PostgreSQL concurrency, TypeScript, ESLint, production builds, and demo/live browser flows. See phase-2-setup.md for test commands and product-simplification.md for migration review and verification.

## Spoken practice phase

New sessions use camera-on spoken answers, a real device check, authenticated Groq transcription jobs, local worker-based MediaPipe inference, bounded browser observation episodes, and a frozen deterministic observation summary alongside the existing transcript performance report. Legacy text sessions keep their mode. The new migration adds backend-only temporary audio and observation tables with RLS, answer provenance, versioned configuration and device metadata. See [implementation and privacy details](spoken-interviews.md).

Optional phone visibility uses a local EfficientDet-Lite0 candidate filter and bounded Groq image checks after separate consent. No image bytes are persisted. Server-wide budgets, lifecycle/ownership checks and immutable completion snapshots protect the existing interview flow. See [phone-vision.md](phone-vision.md).
