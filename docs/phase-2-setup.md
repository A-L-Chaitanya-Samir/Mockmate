# Phase 2 setup and operations

> Current interview behavior is documented in [camera-on spoken practice](spoken-interviews.md). That phase supersedes earlier text-first limitations; historical verification below remains a record of its original scope.

Run commands from `A:\Mockmate`. Use credentials issued to your own accounts, stored only in ignored environment files. Never paste secrets into chat. No billing or production deployment was performed. Hosted development migrations applied in later phases are recorded in the acceptance guides.

## Install and configure

Prerequisites: Node 24, Python 3.10+ (3.12 recommended), Docker Desktop if running Supabase locally.

```powershell
Set-Location A:\Mockmate
npm.cmd ci
python -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
Copy-Item .env.example .env.local
Copy-Item backend/.env.example backend/.env
```

Edit the copied files locally. Public settings are compiled into the frontend, so rebuild after changes. Backend settings load `backend/.env` when started from the root.

Frontend variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_API_URL=http://localhost:8000`, `NEXT_PUBLIC_DEMO_MODE=false`. Never put a secret/service-role key or AI key in a `NEXT_PUBLIC_` variable.

Backend variables:

- `DATABASE_URL`: privileged PostgreSQL URL. For hosted connections use TLS (`?sslmode=require`); the Supabase session pooler can help on networks without IPv6. This connection bypasses RLS, so API queries explicitly authorize ownership.
- `SUPABASE_URL`: matching Auth/Storage URL; `SUPABASE_PUBLISHABLE_KEY`: public key used when validating users with Auth.
- `SUPABASE_SECRET_KEY`: server secret or local legacy service-role key for private Storage.
- `GROQ_API_KEY`: your own Groq key; `GROQ_MODEL=openai/gpt-oss-20b` initially.
- `CORS_ORIGINS=["http://localhost:3000"]`: explicit frontend origins only.
- `RESUME_LIMIT=10`, `INTERVIEW_LIMIT=3`, `USAGE_WINDOW_HOURS=24`.
- `AI_MAX_TOKENS=4096`: bounded output limit per call; `GROQ_REASONING_EFFORT=low` for GPT-OSS models; `AI_INPUT_CHARS=11000`: redacted resume excerpt limit.
- Optional `LEASE_SECONDS=180`, `MAX_JOB_ATTEMPTS=3`, `MAX_PDF_BYTES=5242880`.

Python dependencies are pinned in `backend/requirements.txt`; npm uses the committed lockfile. TypeScript 5.9.3 satisfies the OpenAPI generator's current TypeScript 5 peer requirement.

## Supabase and migrations

Use [your Supabase dashboard](https://supabase.com/dashboard) to select a development project. Confirm its free entitlement before provisioning. An inactive connected project is not automatically restored or changed. Obtain the API URL, publishable key, server secret and database connection through your dashboard; store secrets only in `backend/.env`.

The [official Next.js SSR documentation](https://supabase.com/docs/guides/auth/server-side/nextjs) guides this implementation. Cookie clients use `@supabase/ssr`; `src/proxy.ts` refreshes sessions and protected layouts independently call `getUser()`. FastAPI verifies bearer credentials with Auth `/auth/v1/user`; unconfirmed and anonymous accounts are rejected. Browser-supplied user IDs and local plan flags are not trusted.

### Local development with Docker Desktop

```powershell
npx.cmd supabase --version
npx.cmd supabase start --help
npx.cmd supabase start
npx.cmd supabase db push --help
npx.cmd supabase db push
```

The locked CLI is 3.0.0; `db push` is local by default. Copy the local URL/keys shown by the CLI into ignored files. Typical services: API port 54321, PostgreSQL 54322, Studio 54323, email catcher 54324; verify the actual startup output. Docker was unavailable during implementation, so the full local Supabase stack was not started here.

`supabase/migrations/` is the single application migration authority. No Alembic or duplicate application schema exists. Seeding is disabled, and real accounts never import sample histories. For disposable local data only, `npx.cmd supabase db reset --no-seed` destroys local data and reapplies migrations.

### Hosted development

After selecting the intended development project yourself:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref YOUR_DEVELOPMENT_PROJECT_REF
npx.cmd supabase db push --remote --dry-run
# Review the target and SQL before this mutation:
npx.cmd supabase db push --remote
```

Let the CLI prompt for credentials; avoid passwords in shell history. Never reset a hosted database containing data. Run Supabase's database/security advisors after migration. Read [Storage access control](https://supabase.com/docs/guides/storage/security/access-control). No hosted migration was applied here.

### Email verification and password recovery

Enable email/password and email confirmation. Configure [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) for real delivery. The default hosted mail service has development recipient/rate restrictions; local mail is captured in the development mail catcher rather than delivered externally.

Set Site URL to `http://localhost:3000`. Allow exactly these URLs and exact equivalents for your staging host:

```text
http://localhost:3000/auth/callback
http://localhost:3000/auth/callback?next=/reset-password
```

The callback supports PKCE `code` exchange and `token_hash` verification. For email links usable on another device, customize confirmation and recovery templates:

```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup">Verify email</a>
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
```

See [email templates](https://supabase.com/docs/guides/auth/auth-email-templates) and [redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls). Never log callback query strings. Destinations are fixed to dashboard/reset-password; arbitrary redirect URLs are ignored. Invalid/expired links produce a visible error. Password reset signs out the browser and requires login with the new password.

Auth cookies persist and refresh sessions. Logout/account switching performs full navigation and drops in-memory account records/drafts. Live mode never hydrates the demo store. Submitted answers survive refresh; unsubmitted drafts intentionally do not. Use HTTPS in hosted environments. Sign-out does not retroactively revoke every issued JWT; immediate invalidation of all previously issued tokens would require an additional server session-revocation policy.

## Groq account and model

Follow the [official quickstart](https://console.groq.com/docs/quickstart), create your own key, and keep the account on its free plan. Check your own account eligibility, regional availability, model permissions and quotas. A public model listing does not establish account access.

Official documentation checked during implementation:

- [Structured outputs](https://console.groq.com/docs/structured-outputs) lists `openai/gpt-oss-20b` with strict JSON-schema support. Responses are also Pydantic-validated; resume quotes must appear in extracted text, skills must be explicitly present, and report question IDs must match the session.
- [Rate limits](https://console.groq.com/docs/rate-limits) currently lists this model on the free plan at 30 RPM, 1000 RPD, 8000 TPM and 200000 TPD. Limits are organization-wide and can change or differ per account. Check [your limits](https://console.groq.com/settings/limits). Token limits can be reached before request limits, especially with concurrent users.
- [Data handling](https://console.groq.com/docs/your-data) describes ordinary inference without default input/output retention, reliability/abuse exceptions up to 30 days, retained usage metadata and optional zero-data-retention controls. Review your organization's Data Controls and [terms](https://groq.com/terms-of-use/) before sending personal information. The application does not use batch/fine-tuning or external tools.
- [Billing FAQ](https://console.groq.com/docs/billing-faqs) distinguishes Free and paid Developer tiers. No unlimited/permanently free service is promised. There is no automatic paid upgrade or provider fallback.

```powershell
.\backend\.venv\Scripts\python.exe scripts/provider-smoke.py
```

This explicitly calls your configured model using synthetic content only, without printing the key or output. A missing key exits with `NOT VERIFIED`, not success. The provider protocol isolates feature code from Groq.

## Start API, worker and frontend

Run three terminals from the root:

```powershell
# Frontend
npm.cmd run dev
# API, second terminal
$env:PYTHONPATH='backend'
.\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000 --no-access-log
# Worker, third terminal
$env:PYTHONPATH='backend'
.\backend\.venv\Scripts\python.exe -m app.workers.runner
```

Frontend: `http://localhost:3000`; OpenAPI: `http://localhost:8000/docs`. `/health` checks process health; `/ready` requires provider configuration, schema and a recent worker heartbeat. Readiness does not prove a real provider call. Errors carry safe messages, codes and request IDs; application logs omit content, credentials and provider responses.

Optional `docker compose up --build` runs API and worker only using `backend/.env`. Supabase is separate. For local Supabase from containers, use `host.docker.internal` rather than container localhost. Do not deploy the test harness.

## Jobs, deadlines and usage

Resource creation and job insertion share a transaction. Validated resume bytes are staged in an API-only `bytea` outbox before a worker uploads to private Storage; successful analysis clears staged bytes. Failed processing retains them for retry. Workers independently validate the actual PDF. Browsers have no Storage write policy. Download links require ownership and expire after 60 seconds.

Claims use `FOR UPDATE SKIP LOCKED`, 180-second leases and unique lease tokens. Provider/Storage timeouts are 45/30 seconds. Crashed leases are reclaimed; late commits are fenced, and unique result constraints prevent duplicates. Three automatic attempts use backoff, honoring provider 429 `Retry-After` up to 300 seconds. Manual retries allow three cycles. Lost network responses can repeat upstream inference, but still yield one saved result and one application usage charge.

Initial terminal failure releases usage. Retry reacquires a reservation atomically. Successful creation consumes usage even if abandoned/deleted. Response/evaluation retries use the existing session reservation. Concurrent reservations serialize on the profile row. Idempotency keys are account-scoped; changed inputs under a reused key yield 409. Completion freezes answers, cancels pending follow-up jobs and creates one evaluation job.

Four generated questions start the server deadline; at most two follow-ups can be appended. Submitted answers are immutable and capped at 2000 characters. The stopping rule is six answers at most, explicit completion, or the deadline blocking further answers. Expired sessions still require completion to request a report. A session has eight logical AI calls at most before failure retries: generation + six responses + evaluation.

Shared database counters limit authenticated requests to 120 per user per minute. Counters older than a day are removed by the worker. Configure ingress limits of 6 MB and appropriate timeouts when hosting; Content-Length and PDF validation enforce application limits, while chunked ingress must also be bounded by the proxy.

Mockmate is free for every account. Account allowances default to 10 resume analyses and 3 video interviews per fixed 24-hour window (RESUME_LIMIT=10, INTERVIEW_LIMIT=3, USAGE_WINDOW_HOURS=24). The first accepted reservation starts both allowances; activity never extends the deadline. At expiry both renew; the next accepted use starts the next window. Historical lifetime reservations are excluded; failures release capacity and retries reacquire it. All retained reports, evidence, analytics, improvements and suggestions are available to every account.

For existing installations, stop the API and worker, review and apply the new single_free_experience migration, replace old FREE_/PRO_ allowance settings with RESUME_LIMIT and INTERVIEW_LIMIT, and restart both processes. Historical migrations remain unchanged; only the obsolete entitlement table is dropped. Do not reset the database or delete user data.

## Privacy, retention and security

PDF validation checks extension, declared MIME, magic bytes, size, page count, parsing, encryption and usable extracted text. Empty, corrupt, encrypted and scanned/image-only PDFs fail explicitly. OCR is deferred. Resume text is capped and common email/phone/link patterns removed, which is not full anonymization; names and other PII may remain. The UI discloses external processing.

Resume rubric: evidence/impact 30%, relevance 25%, structure 25%, readability 20%. Interview rubric: correctness/relevance 40%, reasoning/evidence 35%, text clarity/structure 25%. Scores are coaching judgments, not ATS guarantees or hiring predictions. Voice, body language and vocal confidence are never assessed from text. Evidence checks cannot prove every AI judgment correct.

Records remain until deleted. Resume deletion immediately hides the resume, cancels analysis and durably schedules deletion of its object, analyses, staged bytes, row and related processing jobs. Failed deletion is visible/retryable; operators must monitor exhausted deletion jobs. Historical interview reports retain their evaluation snapshot even if the contextual resume is deleted. Usage reservations keep metadata to prevent quota resets. Deletion cannot remove exported copies, already-issued links, database backups or external-provider retention exceptions; apply your Supabase backup retention and Groq Data Controls.

Resume AI output uses provider-side structural JSON validation plus full local Pydantic validation. Presentation cleanup removes blank/duplicate string-list entries and caps lists at the contract's bounds. Scores and required fields must still validate. Grounding tolerates case, whitespace, Unicode ligatures and typographic punctuation, then stores verbatim source spans; unsupported evidence/skills are omitted and an analysis with no supported evidence is rejected. No fuzzy claim matching or fabricated substitute feedback is used. Provider response-format errors, timeouts, permission errors, output truncation and rate limits have distinct safe messages. Raw provider errors/failed generations are never logged because they can contain resume text.

Account deletion is not exposed. Operators must finish deleting that account's Storage files before Auth deletion, because database cascades do not remove Storage objects. Auth deletion cascades application records.

Browser-readable tables have owner-read RLS; raw resume bytes and job payloads have no browser grants. Nested resources use composite owner foreign keys. Privileged backend queries explicitly constrain the verified owner; they do not inherit browser RLS. The private resume bucket has no permissive browser read/write policies. Files are exposed only through API-authorized short-lived URLs.

Keep secrets backend-only, use TLS, restrict CORS, and disable token/header/query logging at hosting ingress. Treat resumes and answers as untrusted JSON data under fixed system instructions; the AI has no tools, secret access or arbitrary execution capabilities.

## Automated verification

Read-only live configuration checks (values are never printed):

```powershell
.\backend\.venv\Scripts\python.exe scripts/check-setup.py
# Also make one synthetic Groq request once its real key is saved:
.\backend\.venv\Scripts\python.exe scripts/check-setup.py --provider-smoke
```

The checker detects unfilled example values, verifies matching public settings, checks real Auth token rejection, and checks schema/RLS/private Storage when backend credentials exist. It does not apply migrations or create accounts. Example credentials are rejected locally before any provider request.

```powershell
.\backend\.venv\Scripts\python.exe scripts/export-openapi.py
npx.cmd openapi-typescript contracts/openapi.json -o src/lib/api/generated.ts
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
.\backend\.venv\Scripts\python.exe scripts/check-secrets.py
```

For isolated SQL checks without Docker, terminal A:

```powershell
node scripts/test-db.mjs
```

Terminal B:

```powershell
$env:PYTHONPATH='backend'
$env:TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable'
.\backend\.venv\Scripts\python.exe -m pytest backend/tests -q
```

PGlite runs PostgreSQL migrations/RLS through psycopg, but its single-connection WASM engine cannot verify native transaction concurrency. CI uses native PostgreSQL and sets `TEST_DB_CONCURRENCY=1`. For local native tests, point `TEST_DATABASE_URL` to an **empty disposable native PostgreSQL database**, run `scripts/init-test-db.py`, set that concurrency flag, then pytest. Initializers create external Auth/Storage stubs; they are not real Supabase. Tests truncate synthetic Auth users and dependent records. **Never target a personal, staging, production or shared database.**

After backend tests finish, terminal B can start deterministic browser services:

```powershell
$env:TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable'
$env:MOCKMATE_TEST_HARNESS='1'
.\backend\.venv\Scripts\python.exe scripts/browser-test-server.py
```

Terminal C:

```powershell
$env:NEXT_PUBLIC_DEMO_MODE='false'
$env:NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:8011'
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='test-publishable'
$env:NEXT_PUBLIC_API_URL='http://127.0.0.1:8011'
$env:MOCKMATE_BROWSER_MODE='live'
$env:PLAYWRIGHT_CHANNEL='chrome' # installed Chrome, or npx.cmd playwright install chromium
npm.cmd run build
npm.cmd run test:e2e
```

The harness resets its two synthetic accounts. It exercises actual FastAPI business handlers, migrations, Supabase JS cookies and PostgreSQL writes with fake Auth and deterministic AI/Storage. It does not verify email delivery, real JWT/refresh infrastructure, hosted Storage or Groq. Never run it with real credentials.

Retained demo regressions:

```powershell
$env:NEXT_PUBLIC_DEMO_MODE='true'
Remove-Item Env:MOCKMATE_BROWSER_MODE -ErrorAction SilentlyContinue
$env:PLAYWRIGHT_CHANNEL='chrome'
npm.cmd run build
npm.cmd run test:e2e
```

Close test services/terminals, restore actual environment values and rebuild live mode afterward. Never serve a fake-Auth build as the real application.

## Repeatable real-service acceptance

Real development integration was verified on 10 November 2026; see `phase-2-verification.md`. With the real API, worker and frontend running, these opt-in commands create synthetic accounts and remove them afterward. They send only synthetic PDF/interview content to Groq and do not send verification/recovery email:

```powershell
.\backend\.venv\Scripts\python.exe -u scripts/live-smoke.py --run --browser
.\backend\.venv\Scripts\python.exe -u scripts/live-auth-smoke.py --run
```

Use only your development project. Browser checks require installed Chrome. The first script exercises real PDF processing, private downloads, text interviews, report persistence, account isolation and deletion. The second verifies actual confirmation/recovery tokens, the callback, browser reset form and password changes. Neither proves SMTP delivery to a real inbox. The owner must register their own account and check verification/recovery email; use custom SMTP for general recipients rather than relying on the restricted development sender.


See [Phase 4 acceptance and email setup](phase-4-acceptance.md) for the new migration, provider capacity, reset semantics and manual acceptance checklist.


The API, worker and frontend were restarted locally on 11 November 2026, with health/readiness/frontend HTTP 200 checks. This does not establish SMTP delivery or physical-device acceptance. Use the [manual acceptance record](phase-4-manual-acceptance.md) to record those results before closing Phase 4.


## Rigorous and responsive acceptance follow-up

See [the current follow-up](phase-4-followup-acceptance.md). New interview setup includes seniority; new reports use a versioned rigorous rubric without changing score weights or historical results. No additional database migration is required for this follow-up.

For isolated browser builds set `MOCKMATE_BROWSER_BUILD=1`; their generated output is `.test-deps/next-browser`, leaving the normal `.next` build available to a human tester. Use the same setting when starting that test server. `PLAYWRIGHT_ENGINE=firefox` or `webkit` with `RESPONSIVE_LAYOUT_ONLY=1` enables additional engine layout checks without physical media. These do not establish Safari/iOS or TV hardware support. Run backend database tests before starting the deterministic browser harness so its worker cannot consume backend-suite jobs.

`scripts/audit-auth-email.py` is read-only and sends no mail. A `SUPABASE_ACCESS_TOKEN` in the process environment allows inspection of the matching hosted Auth configuration; it is a management token, not a publishable/service key. Provider account capacity and authorized inbox delivery remain separate checks. Do not paste keys into chat.
