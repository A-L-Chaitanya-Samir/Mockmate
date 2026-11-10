# Mockmate

Phase 2 connects the existing Next.js/TypeScript frontend to Supabase Auth, PostgreSQL, private resume storage, FastAPI and a separate durable Python worker. It implements PDF resume coaching, text interviews, saved reports, analytics, suggestions, profiles and preferences.

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

Free/Pro names and ₹0/₹299 presentation remain. Paid checkout is disabled. Introductory server-controlled allowances are account lifetime, not monthly subscriptions: Free defaults to twenty analyses for testing and three interviews; operator-controlled Pro testing defaults to twenty each. Failed initial processing releases reservations; retry reacquires capacity; deletion does not reset usage.

Resume excerpts and interview text go to Groq. Common resume email/phone/link patterns are removed where detected, which is not full anonymization. Files are private; download links expire after 60 seconds. Resume quality is coaching under a documented rubric, not an ATS score or hiring prediction. Only text communication is assessed.

Coding execution/evaluation, voice, video, face detection, proctoring and paid subscriptions remain future features. Set NEXT_PUBLIC_DEMO_MODE=true before building to run the separate Phase 1 demo and its simulated features. Live accounts never import its sample history or browser-local records. Original branding, themes, navigation and design references remain.
