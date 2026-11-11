# Mockmate

Mockmate helps students, job seekers and working professionals improve their resumes and practise explaining their knowledge in interviews. It combines private PDF resume coaching with camera-on spoken practice, reviewable transcripts and saved feedback, so users can track progress and decide what to practise next.

The application is a single free experience. Live accounts use Supabase and Groq; a separate, explicitly simulated demo build uses fixtures. Coding interviews, paid plans and subscriptions are outside the product scope.

## Capabilities and user journey

1. Register, verify your email and sign in. Account settings manage your profile, preferences and password.
2. Upload a text-based PDF resume. Review evidence-linked coaching, missing information, skills and improvement suggestions; access or delete the private file from your workspace.
3. Choose a target role, seniority, interview type, difficulty, duration and optional resume context. New interviews are camera-on spoken practice.
4. Select camera/microphone devices, check the local detector, record and review an audio test, and acknowledge external transcription. Optional external image checks have a separate opt-in.
5. Read or hear a question, record an answer, review/correct its transcription and explicitly submit it. Contextual follow-ups probe the answer; recording alone does not submit it.
6. Complete practice and revisit the saved report, question-specific evidence, answer coverage and separate observation timeline. Dashboard analytics and suggestions use your saved work.

Camera observations describe practice conditions, not cheating. Answer scores assess confirmed text, never camera behavior, appearance, voice or inferred personality.

## Stack and architecture

The frontend uses Next.js App Router, React, TypeScript, Tailwind CSS, Radix UI and Recharts. Supabase Auth and `@supabase/ssr` provide cookie sessions; FastAPI verifies bearer identities independently. PostgreSQL stores account-owned application data and durable jobs. Supabase Storage holds private PDFs. A separate Python worker calls Groq for resume coaching, question generation, follow-ups, isolated answer grading and Whisper transcription. pypdf validates/extracts PDFs; PyAV validates and normalizes audio. Self-hosted MediaPipe models run face/object filtering locally in a browser worker.

```mermaid
flowchart LR
  U[Browser / Next.js UI] --> A[Supabase Auth]
  N[Next.js proxy and server layouts] --> A
  U --> N
  U -->|Bearer token / HTTPS| API[FastAPI API]
  API -->|Verify user| A
  API --> DB[(PostgreSQL: owned records and jobs)]
  W[Durable Python worker] <-->|Leases and fenced results| DB
  W --> S[Private Supabase PDF Storage]
  API -->|Authorized short-lived downloads| S
  W -->|Resume / text / temporary audio| G[Groq]
  U -->|Local camera frames| M[MediaPipe browser worker]
  U -->|Separate optional image consent| API
  API -->|Bounded image checks| G
```

The API enforces ownership explicitly because its database connection is privileged. Browser-readable tables also have owner-read RLS; job payloads, staged files and temporary audio have no browser grants. The browser cannot upload directly to the private bucket.

## Repository map

This abbreviated tree shows tracked source and documentation; dependencies, secrets, caches and generated build/test output are omitted.

```text
Mockmate/
|-- src/
|   |-- app/                    Next.js routes, layouts, callback and styles
|   |-- components/             Shared shells, charts and UI primitives
|   |-- features/               Auth, resumes, interviews, analytics and settings
|   |   `-- interview/spoken/   Capture, recording, observations and image consent
|   |-- hooks/                  Device, hydration, demo and usage hooks
|   |-- services/               Live API and isolated demo adapters
|   |-- lib/                    Supabase clients, validation and generated API types
|   |-- stores/                 Demo-only persisted state
|   |-- config/                 Demo usage configuration
|   |-- constants/              Navigation definitions
|   |-- data/                   Demo fixtures
|   |-- types/                  Frontend domain types
|   `-- proxy.ts                Session refresh and route protection
|-- backend/
|   |-- app/
|   |   |-- api/v1/             Authenticated HTTP routes
|   |   |-- ai/                 Provider, grounding, rubric and calibration anchors
|   |   |-- core/               Settings, identity, database and safe errors
|   |   |-- integrations/       PDF, speech, Storage and optional vision clients
|   |   |-- modules/            Schemas, ownership, usage and interview lifecycle
|   |   |-- workers/            Durable job runner and maintenance
|   |   `-- main.py             FastAPI application
|   |-- tests/                  Unit/integration tests and synthetic PDF fixture
|   |-- requirements.txt        Pinned Python dependencies
|   `-- Dockerfile              API/worker container
|-- supabase/
|   |-- config.toml             Local Supabase configuration
|   `-- migrations/             Ordered application schema history
|-- contracts/openapi.json      Generated API contract
|-- public/mediapipe/           Local models, inference worker and attribution
|-- scripts/                    Contract, migration, setup and acceptance utilities
|-- tests/                      Playwright product, spoken, vision and layout tests
|-- docs/                       Architecture, setup and dated acceptance evidence
|-- .github/workflows/ci.yml     Native PostgreSQL and browser checks
|-- .env.example                Public frontend configuration template
|-- backend/.env.example        Server configuration template
|-- compose.yaml                Optional API/worker containers
`-- package.json                Frontend scripts and locked dependency workflow
```

`src/services/live-api.ts` adds verified-session bearer credentials, handles safe API errors and maps DTOs. `src/services/api-client.ts` supports simulated requests; it is not the live transport. `src/lib/supabase/`, `src/proxy.ts` and protected layouts handle sessions; `src/features/auth/live-auth-form.tsx` implements confirmation, resend and password recovery.

`media.ts`, `recorder.ts` and `spoken-room.tsx` own capture, format selection, disposable playback and transcript confirmation. `observations.ts` coalesces local events and retries metadata; `phone-vision.tsx` manages optional consent, sampling and late-result cancellation. `public/mediapipe/face-worker.js` performs local inference.

Backend `integrations/speech.py` normalizes audio before Groq. `ai/evidence.py` checks resume evidence; `ai/interview_grading.py` grades one confirmed answer per provider request and computes report arithmetic. `workers/runner.py` claims jobs with leases, retries failures, fences stale writers and expires temporary audio. `supabase/migrations/` is the sole application schema history. `scripts/export-openapi.py` and `openapi-typescript` regenerate the HTTP contract and frontend types.

## Windows PowerShell setup

Prerequisites: Node.js 24, Python 3.10+ (3.12 recommended), Git, a free-capacity Groq account and a Supabase development project, or Docker Desktop for the full local Supabase stack. Use Chrome for the currently evidenced desktop spoken flow. Camera/microphone APIs require HTTPS or localhost. Run commands from the repository root.

```powershell
Set-Location A:\Mockmate
npm.cmd ci
python -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
# On an existing installation, keep your configured files instead of overwriting them.
Copy-Item .env.example .env.local
Copy-Item backend/.env.example backend/.env
```

Edit the ignored copies privately. Frontend/backend Supabase URL and publishable key must match. Set the server's database, Storage secret, Groq key and CORS origins for that same environment. Never use real credentials in the deterministic browser harness. Public variables are compiled at build time; rebuild after changing them.

For a fresh **local** Supabase stack, with Docker Desktop running:

```powershell
npx.cmd supabase --version
npx.cmd supabase start --help
npx.cmd supabase start
npx.cmd supabase db push --help
npx.cmd supabase db push
```

The locked CLI is v3; `db push` targets local by default. Copy the local URL/keys from startup into the ignored files. Default database/API/Studio/mail-catcher ports are 54322/54321/54323/54324. Local mail is captured, not delivered to outside inboxes. The full Docker stack was not exercised in this acceptance run.

For an existing **hosted development** project, stop API/worker before schema upgrades, select the intended project and review the pending SQL:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref YOUR_DEVELOPMENT_PROJECT_REF
npx.cmd supabase db push --remote --dry-run
# Apply only after reviewing the target and SQL; never reset a shared database.
npx.cmd supabase db push --remote
```

Use TLS for hosted PostgreSQL connections. Apply all committed migrations in order; keep historical files intact. No schema migration is needed for isolated v4 grading. The [setup guide](docs/phase-2-setup.md) covers private Storage, RLS, session-pooler connections and email templates.

Keep email confirmation mandatory. Configure exact Site URL and callback allowlist entries for your origin, including `/auth/callback` and `/auth/callback?next=/reset-password`. Preserve a suitable existing SMTP provider. Public Auth settings cannot verify sender activation, recipient restrictions or actual delivery. See [email setup and capacity](docs/phase-4-acceptance.md#email-delivery-configuration-still-required) and the [latest acceptance record](docs/phase-4-quality-closure.md).

Open three PowerShell terminals at `A:\Mockmate`:

```powershell
# Terminal 1: frontend at http://localhost:3000
npm.cmd run dev
```

```powershell
# Terminal 2: API at http://localhost:8000, OpenAPI UI at /docs
$env:PYTHONPATH='backend'
.\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000 --no-access-log
```

```powershell
# Terminal 3: continuously running worker
$env:PYTHONPATH='backend'
.\backend\.venv\Scripts\python.exe -m app.workers.runner
```

For a production-mode local frontend, use `npm.cmd run build`, then `npm.cmd start`. `docker compose up --build` optionally runs API and worker from `backend/.env`; it does not provide the frontend or Supabase stack. `/health` checks the API process; `/ready` checks configuration, database and a recent worker heartbeat. Neither establishes inbox delivery or AI/device acceptance.

## Environment variables

Only the following `NEXT_PUBLIC_*` variables belong in the browser bundle:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: public project endpoint and publishable key.
- `NEXT_PUBLIC_API_URL`: API origin, normally `http://localhost:8000` locally.
- `NEXT_PUBLIC_DEMO_MODE`: `false` for live accounts; `true` enables the separate fixture-based demo at build time. Demo state never imports into live accounts.

Server-only configuration lives in `backend/.env` and is loaded from the repository root:

- `DATABASE_URL`: privileged database connection; `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`: matching Auth/Storage project; `SUPABASE_SECRET_KEY`: private Storage privilege. The publishable key is public by nature, but the database URL and secret key are secrets.
- `GROQ_API_KEY`: secret provider credential; `GROQ_MODEL`, `GROQ_REASONING_EFFORT`, `AI_MAX_TOKENS`, `AI_INPUT_CHARS`: text inference model and budgets.
- `TRANSCRIPTION_PROVIDER=groq`, `TRANSCRIPTION_MODEL`: speech provider/model. `MAX_AUDIO_BYTES`, `MAX_AUDIO_SECONDS`, `AUDIO_MIN_RMS`: upload, duration and energy checks (hard maximum 120 seconds/8 MB).
- `VISION_ENABLED`, `VISION_MODEL`, `VISION_INTERVAL_SECONDS`, `VISION_AUDIT_SECONDS`, `VISION_MAX_PER_MINUTE`, `VISION_MAX_PER_DAY`, `VISION_MAX_PER_SESSION`, `VISION_MAX_IMAGE_BYTES`: optional-image feature, sampling and server capacity controls. Enabling the feature never grants user consent.
- `FACE_MODEL_PATH`, `FACE_MIN_CONFIDENCE`, `OBSERVATION_SAMPLE_MS`, `OBSERVATION_SUSTAIN_MS`, `OBSERVATION_DEBOUNCE_MS`, `OBSERVATION_RECOVERY_MS`, `OBSERVATION_COOLDOWN_MS`: local-model asset and observation policy exposed to the room. These are not credentials.
- `CORS_ORIGINS`: JSON array of exact allowed frontend origins.
- `RESUME_LIMIT=10`, `INTERVIEW_LIMIT=3`, `USAGE_WINDOW_HOURS=24`: shared account allowances.
- Optional `MAX_PDF_BYTES`, `LEASE_SECONDS=180`, `MAX_JOB_ATTEMPTS=3`: PDF limit and worker controls. Evaluation leases are at least 360 seconds for up to six sequential grading requests; other jobs retain the configured lease.

Tooling variables are process-only: `SUPABASE_ACCESS_TOKEN` grants the read-only email audit matching-project management access; it is secret. `TEST_DATABASE_URL`, `TEST_DB_PORT`, `TEST_DB_CONCURRENCY` select disposable test infrastructure. `MOCKMATE_TEST_HARNESS=1` guards deterministic services. `MOCKMATE_BROWSER_BUILD=1` isolates browser output under `.test-deps/next-browser`. `MOCKMATE_BROWSER_MODE`, `PLAYWRIGHT_CHANNEL`, `PLAYWRIGHT_ENGINE`, `PLAYWRIGHT_BASE_URL`, `RESPONSIVE_LAYOUT_ONLY` select browser-test scope. See the example files and [full setup commands](docs/phase-2-setup.md#automated-verification).

## Usage policy

Every account gets **10 resume analyses and 3 video interviews per shared fixed 24-hour window**, starting with its first accepted reservation. Activity never extends the deadline; both allowances renew together. Reads after expiry show renewed capacity; the next accepted use starts the next window. This is not midnight or inactivity renewal.

Initial terminal processing failure releases its reservation; explicit retry reacquires capacity. Successful creation consumes usage even if later abandoned or deleted. Duplicate creation keys return the same resource and do not charge again; changing inputs under the same key conflicts. Transcription, follow-ups, evaluation and report access use the existing interview reservation. PostgreSQL enforces allowances, independently of browser clocks. Existing reports remain accessible when capacity is exhausted.

## Verification and useful scripts

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:migrations
.\backend\.venv\Scripts\python.exe scripts/export-openapi.py
npx.cmd openapi-typescript contracts/openapi.json -o src/lib/api/generated.ts
git diff --exit-code -- contracts/openapi.json src/lib/api/generated.ts
.\backend\.venv\Scripts\python.exe scripts/check-secrets.py
git diff --check
```

For backend tests, first start an **isolated disposable database** in terminal A:

```powershell
node scripts/test-db.mjs
```

Then in terminal B, with no browser harness sharing that database:

```powershell
$env:PYTHONPATH='backend'
$env:TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable'
.\backend\.venv\Scripts\python.exe -m pytest backend/tests -q
```

Fixtures truncate synthetic Auth users and dependent data. **Never point tests or `scripts/init-test-db.py` at a real-account database.** PGlite validates SQL/migrations/RLS but skips native concurrency; CI uses disposable native PostgreSQL with `TEST_DB_CONCURRENCY=1` and initializes it with `scripts/init-test-db.py`.

After backend tests finish, keep the disposable database running and start browser services in terminal B:

```powershell
$env:TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable'
$env:MOCKMATE_TEST_HARNESS='1'
.\backend\.venv\Scripts\python.exe scripts/browser-test-server.py
```

Terminal C builds and tests the isolated live adapter:

```powershell
$env:MOCKMATE_BROWSER_BUILD='1'
$env:NEXT_PUBLIC_DEMO_MODE='false'
$env:NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:8011'
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='test-publishable'
$env:NEXT_PUBLIC_API_URL='http://127.0.0.1:8011'
$env:MOCKMATE_BROWSER_MODE='live'
$env:PLAYWRIGHT_CHANNEL='chrome'
# Alternatively install bundled Chromium and omit PLAYWRIGHT_CHANNEL:
# npx.cmd playwright install chromium
npm.cmd run build
npm.cmd run test:e2e
```

Playwright starts the production test frontend on port 3100. These checks use fake devices, deterministic AI/Storage and stub Auth; they do not establish real email, physical media or provider quality. Demo regressions require rebuilding with `NEXT_PUBLIC_DEMO_MODE=true` and removing `MOCKMATE_BROWSER_MODE`. Stop test services, clear the test process variables and build normal live mode again before human use.

Additional browser-engine layout checks use `PLAYWRIGHT_ENGINE=firefox` or `webkit`, `RESPONSIVE_LAYOUT_ONLY=1`, and `npx.cmd playwright test tests/responsive.spec.ts` after installing the corresponding engine. WebKit on Windows is not physical Safari/iPhone media acceptance.

Read-only `scripts/check-setup.py` checks matching configuration, Auth, schema/RLS and private Storage. `scripts/audit-auth-email.py` sends no mail and distinguishes public facts from management/provider/inbox checks. Opt-in `scripts/rigorous-evaluation.py --case excellent --case filler --max-provider-calls 2` sends only synthetic scoring examples, records actual variable scores/failures and stops on provider errors. `scripts/guided-physical.py --consent-audio-camera` is a human-operated physical helper: obtain explicit audio/local-camera consent and separate optional-image consent first. The [manual checklist](docs/phase-4-manual-acceptance.md) defines the required conditions; helpers and admin-confirmed test accounts cannot prove inbox delivery.

## Privacy, retention and limitations

Resume excerpts, spoken-answer audio and confirmed text are processed externally by Groq. Common email/phone/link patterns are removed from resume excerpts where detected; this is not full anonymization. Resume PDFs remain private, with owner-authorized download links lasting 60 seconds. Resume deletion durably schedules object/data cleanup; operators must monitor failed deletion jobs. Historical interview snapshots remain after contextual-resume deletion. Records otherwise remain until deleted; account deletion is not exposed in the UI.

Temporary normalized audio is held in backend-only storage until transcription success, terminal failure, completion or one-hour expiry cleanup. Keep a worker running for cleanup. Unsubmitted browser recordings are memory-only and can be lost on reload. Full interview video is never recorded or retained. Local face processing uploads no frames; separately consented optional phone checks send bounded samples to Groq and retain metadata only. Withdrawal stops new samples and invalidates late findings, but cannot recall already-sent data. Database backups and external-provider retention follow their operators' policies.

Observation warnings can miss events or be false, and client metadata can be incomplete or altered. They do not prove cheating and never reduce answer-quality scores. Optional vision failure does not prevent confirmed-answer submission. Transcripts require user review; scoring cannot infer emotion, personality, body language or vocal confidence. Scores are coaching estimates, not ATS guarantees, hiring decisions or validated accuracy claims. Model variability, unrequested deductions and generated-feedback errors remain possible even with answer isolation and evidence validation. See [scoring](docs/interview-scoring.md), [spoken practice](docs/spoken-interviews.md) and [optional images](docs/phone-vision.md).

## Current status and contribution

Phase 4 remains **partially accepted**. Historical evidence includes a consenting desktop physical spoken journey with six audio uploads/answers, saved-report refresh/another signed-in context and ended media tracks. Real inbox delivery and matching hosted SMTP/provider capacity remain unverified. Adverse physical conditions, multiple-person/ambiguous phone scenes, physical mobile/Safari media behavior and a complete assistive-technology audit remain open. Desktop engine layout coverage does not close those gaps. [Latest quality closure](docs/phase-4-quality-closure.md) records this revision's checks, scoring results, browser support scope and exact owner actions; [prior follow-up](docs/phase-4-followup-acceptance.md) preserves dated evidence. No production deployment is claimed.

Before changing code, read [AGENTS.md](AGENTS.md) and the relevant installed Next.js guides under `node_modules/next/dist/docs/`. Keep changes focused, preserve historical migrations/reports and version material grading changes. Add regressions for ownership, lifecycle, grounding and failure behavior when affected. Regenerate contracts after schema changes; run relevant checks before committing. Keep secrets, personal media and test artifacts out of Git. Preserve privacy/security/concurrency comments and third-party attribution. Contribution descriptions should explain behavior, verification and remaining limitations. No project-wide license has been selected; bundled MediaPipe attribution remains in `public/mediapipe/`.
