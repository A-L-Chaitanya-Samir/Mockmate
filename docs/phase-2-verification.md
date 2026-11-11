# Phase 2 verification - 10 November 2026

> Current interview behavior is documented in [camera-on spoken practice](spoken-interviews.md). That phase supersedes earlier text-first limitations; historical verification below remains a record of its original scope.

## Real development integration: passed

The owner's new Supabase development project is configured through ignored local environment files. Its migration was applied with the locked Supabase CLI after a dry run and project-match check. No production deployment, paid upgrade or billing change occurred. The unrelated inactive project exposed by the connector was not changed.

Verified against the actual services:

- Supabase accepted the publishable and server keys. Email/password signup and mandatory confirmation are enabled; invalid tokens are rejected.
- PostgreSQL connection works with TLS. A malformed URI was repaired by URL-encoding the existing password, without displaying it.
- All 12 application tables exist with RLS; the private resume bucket exists. The database security advisor returned no findings.
- A real Groq structured-output smoke passed using the configured openai/gpt-oss-20b model. No fallback provider or paid plan was enabled.
- The full real-service journey passed 31 checks: two synthetic Auth accounts, login, profile isolation, missing/invalid token rejection, PDF validation/upload, Groq analysis grounded in extracted text, durable processing, private signed download, direct cross-account Storage rejection, configured generated questions, saved answers, contextual response, saved evaluation/history, refresh tokens, idempotent upload/create/answer/complete, and one report with two resource reservations.
- Real Chrome journeys verified report persistence after refresh and in a separate browser context, logout/account switching isolation, and layouts at 390/768/1440 widths.
- Resume deletion through the actual API and separate worker removed the private object and related records. All synthetic test users and files were removed.
- Real signup confirmation tokens blocked login until confirmed. Real recovery tokens passed through the Next.js callback and browser reset form; the new password worked and the old password was rejected. Admin-generated links were used without sending email.
- Both local confirmation/recovery redirect destinations were accepted by the project; its default Auth destination is the local app.
- Eight simultaneous native PostgreSQL reservation requests accepted exactly three and rejected five, verifying the Free ceiling.
- An actual worker restart reclaimed an expired lease for a synthetic deletion job, advanced its attempt count, and deleted the private object and row. The synthetic account was removed.

Resume evidence validation rejected one provider attempt before retrying successfully. The instructions were clarified to require verbatim evidence/skill substrings; validation remains enforced. Failed provider output was never substituted with a sample result.

## Regression checks

- Backend: 33 passed, 1 skipped on the isolated PostgreSQL/WASM regression engine. The skipped test requires native concurrency; the separate real native check described above passed. A third-party Starlette/httpx test-client deprecation warning remains.
- TypeScript and ESLint passed. Production builds passed with live configuration; the explicit demo build had previously passed.
- Four deterministic live-mode browser regressions and all 18 retained demo regressions passed previously, including input-derived PDF flow, settings/preferences, keyboard navigation, media cleanup and responsive layouts.
- FastAPI/Pydantic OpenAPI and generated frontend types match; contract drift is tested.
- Secret scanning covers tracked/non-ignored files and compares actual backend environment secret values against static browser bundles. It passed. Keys/passwords/tokens were not printed or committed.

The real acceptance scripts are opt-in development tools: scripts/live-smoke.py and scripts/live-auth-smoke.py. They generate synthetic accounts/content and clean up their own data. Do not run destructive test-database fixtures against the real development database.

## Resume failure follow-up

A real uploaded PDF exposed Groq `json_validate_failed` responses: generated skill lists exceeded the presentation bound and feedback contained an empty item. The file itself parsed correctly. The adapter now requests low reasoning effort with a bounded 4096-token budget, uses a provider-compatible structural schema for resume analysis, and applies blank/deduplicate/list-limit cleanup before full local schema validation. Numeric limits and required content remain validated. Evidence/skills must match normalized source text; stored quotes are verbatim source spans. Failed generation bodies remain private.

The saved upload was retried successfully through the durable worker. Verification found one analysis, one consumed reservation, cleared errors, and all displayed quotes supported by the PDF. Focused tests cover the reproduced list/blank case, safe provider error classification, output truncation, word-boundary skill matching and normalized-but-verbatim evidence. The full isolated backend suite passed 33 tests with one native-concurrency-only skip; the real native concurrency check above remains valid.

## Remaining owner check

Email delivery itself has not been tested. Register your own account at the local app, open the verification email, then check Forgot password. Supabase's default sender restricts recipients/rates; configure custom SMTP before allowing general/public registrations. No SMTP account, domain or paid service was provisioned automatically.

GitHub Actions configuration is present, but remote CI execution has not been observed in this task. Docker-local Supabase was not exercised; the real hosted development project was tested instead.

The current product scope supersedes the earlier expansion roadmap. Live mode supports resume coaching and text interviews; the demo uses explicit fixtures. Core Phase 2 screens never silently fall back to fixture results. See product-simplification.md for the latest checks.


## Phase 4 successor

Daily allowance, email delivery, browser/device acceptance and scoring evaluation evidence are recorded in [Phase 4 acceptance](phase-4-acceptance.md). Earlier lifetime-limit and physical acceptance statements above are historical, not the current reset policy.
