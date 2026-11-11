# Mockmate

Phase 2 connects the existing Next.js/TypeScript frontend to Supabase Auth, PostgreSQL, private resume storage, FastAPI and a separate durable Python worker. It implements PDF resume coaching, camera-on spoken interviews, saved reports, analytics, suggestions, profiles and preferences.

Live mode is the default. On 10 November 2026, the owner's development Supabase database, private Storage, Auth and Groq were connected and tested end to end. The API, separate worker and local frontend use ignored environment files. Automated regression checks also retain separate deterministic adapters. Email delivery to a real inbox still needs an owner check; see the verification record.

## Windows quick start

Prerequisites: Node 24, Python 3.10+ (3.12 recommended), and Docker Desktop for local Supabase.

```powershell
Set-Location A:\Mockmate
npm.cmd ci
python -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
Copy-Item .env.example .env.local
Copy-Item backend/.env.example backend/.env
# Edit ignored environment files with credentials issued to your own accounts.
npx.cmd supabase start
npx.cmd supabase db push
```

Follow [the setup guide](docs/phase-2-setup.md) for credentials, hosted/local migrations, email delivery, callback URLs, Groq and exact test commands. Keep secrets out of chat and Git.

Open three terminals at the repository root:

```powershell
# Frontend: http://localhost:3000
npm.cmd run dev
# API, separate terminal: http://localhost:8000/docs
$env:PYTHONPATH='backend'
.\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000 --no-access-log
# Worker, separate terminal
$env:PYTHONPATH='backend'
.\backend\.venv\Scripts\python.exe -m app.workers.runner
```

## Verification

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
.\backend\.venv\Scripts\python.exe scripts/export-openapi.py
npx.cmd openapi-typescript contracts/openapi.json -o src/lib/api/generated.ts
$env:PYTHONPATH='backend'
.\backend\.venv\Scripts\python.exe -m pytest backend/tests -q
.\backend\.venv\Scripts\python.exe scripts/check-secrets.py
# Calls your actual Groq account only after its server key is configured:
.\backend\.venv\Scripts\python.exe scripts/provider-smoke.py
```

Database tests need an isolated TEST_DATABASE_URL. [Setup and browser commands](docs/phase-2-setup.md#automated-verification) explain PGlite, native PostgreSQL and both browser modes. CI runs native PostgreSQL concurrency checks and browser regressions. [Verification evidence](docs/phase-2-verification.md) distinguishes local checks from outstanding real-service acceptance.

## Product boundaries

Mockmate is a single free experience. All retained features are available without a subscription. Server-controlled allowances default to 10 resume analyses and 3 video interviews in one fixed 24-hour window, configured with RESUME_LIMIT=10, INTERVIEW_LIMIT=3 and USAGE_WINDOW_HOURS=24. The first accepted reservation starts the shared window; activity never extends it. Both allowances renew at expiry, and the next accepted use starts the next window. Failed initial processing releases reservations; retry reacquires capacity; deletion does not reset usage. Shared server rate limits remain in place.

Resume excerpts, spoken-answer audio and confirmed interview transcripts go to Groq. Video frames are processed locally with MediaPipe; no full video recording is saved. Common resume email/phone/link patterns are removed where detected, which is not full anonymization. Files are private; download links expire after 60 seconds. Resume quality is coaching under a documented rubric, not an ATS score or hiring prediction. Only text communication is assessed.

Set NEXT_PUBLIC_DEMO_MODE=true before building to run the separate simulated demo. Live accounts never import its sample history or browser-local records. Original branding, themes and design references remain.

Existing installations: stop API/worker, review and apply the new single_free_experience migration, replace old allowance environment variables with RESUME_LIMIT and INTERVIEW_LIMIT, then restart. Profiles, resumes, reports, sessions and usage history are preserved. See [simplification and migration review](docs/product-simplification.md).

## Spoken interviews

See [camera-on spoken practice](docs/spoken-interviews.md) for the device check, audio lifecycle, observation privacy, migration, configurable limits, and verification boundaries. This supersedes older text-first roadmaps. Historical text sessions remain readable.

Optional [AI phone-visibility checks](docs/phone-vision.md) reuse the existing Groq server key. They require separate consent during device checks; selected image samples leave the browser but are not saved by Mockmate. Local object filtering, periodic audits and server-wide limits control usage.


Phase 4 software checks passed; overall acceptance remains open for hosted email capacity/delivery, consenting physical-device checks and the remaining real-model scoring cases. See [Phase 4 acceptance and requirement status](docs/phase-4-acceptance.md) and the [manual acceptance record](docs/phase-4-manual-acceptance.md).


Latest local follow-up: [rigorous questions/scoring, responsive coverage and physical acceptance](docs/phase-4-followup-acceptance.md). New reports use `transcript-v3-rigorous`; the documented arithmetic and historical reports are preserved. Email delivery and full physical/device acceptance still require recorded evidence.
