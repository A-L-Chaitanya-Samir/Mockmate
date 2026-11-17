# Single free product scope — 10 November 2026

> Current interview behavior is documented in [camera-on spoken practice](spoken-interviews.md). That phase supersedes earlier text-first limitations; historical verification below remains a record of its original scope.

This scope supersedes earlier expansion and monetization roadmaps. Mockmate supports authentication/account settings, private resume upload and coaching/history, AI text-interview setup/sessions/answers/saved reports, dashboard analytics, and suggestions/advice.

## Removed and preserved

Removed the coding route, editor, setup, simulated execution/evaluation, fixtures, integrity hooks, types, services, configuration, dashboard shortcuts, suggestions, and screenshot. Retired coding URLs return the normal not-found page, including while signed out. Removed the sidebar promotional card from the shared desktop/mobile sidebar and its CSS. Actual interview setup, sessions, history, reports and their links remain.

Removed pricing presentations, upgrade dialogs/buttons, badges, paid-feature gates, demo plan switching, operator plan-switch script, and backend plan selection. `/pricing` redirects home and is absent from navigation. Resume improvements, detailed reports/exports, analytics and advice are available to everyone. There were no payment integrations or coding-only backend routes/tables/dependencies. Shared dependencies remain in use; the dependency inventory was refreshed.

Authentication, account ownership checks, RLS, private resume storage/signed downloads, provider input/output validation, evidence checks, durable jobs, retry/lease fencing, immutable answers, server interview deadlines, idempotency and request rate limits are preserved. Live results remain backed by saved data and real AI integrations; demo results remain explicitly simulated.

## Migration review

`supabase/migrations/20261110101649_single_free_experience.sql` contains one transaction dropping only `public.entitlements`, without CASCADE. The historical Phase 2 migration is unchanged. The retired table has only account ID, plan label and creation time; no retained table references it. Profiles, usage reservations, resumes/analyses, interviews/questions/answers/reports, jobs and account identities are unchanged. No storage objects or bucket policies are modified.

`npm run test:migrations` applies the historical schema, seeds both previous account variants with private resumes, analyses, completed interviews, answers/reports, consumed usage and jobs, snapshots retained rows, then applies the new migration. It asserts byte-equivalent retained values, an absent entitlement table, a private resume bucket and enabled RLS. CI runs this upgrade test as well as fresh-schema backend tests.

For an existing installation, stop the API and worker, apply the reviewed new migration through the normal migration workflow, then restart updated services. Configure `RESUME_LIMIT` (default 20) and `INTERVIEW_LIMIT` (default 3), replacing obsolete FREE_/PRO_ allowance variables. The application no longer reads plan metadata. Ordinary limits count account-lifetime reservations; deletion does not reset successful usage. Profile-row locking serializes reservations. The existing 120 authenticated requests per user per minute limit remains.

The migration is prepared and verified locally; this change does not apply schema changes to a hosted account or deploy services.

## Browser data compatibility

The `mockmate-demo-v1` key and version remain stable. Zod strips obsolete properties; persistence writes an allowlist of retained profile, preferences, resume metadata/analysis, sessions/answers and history. Hydration immediately rewrites old saves with those fields, preventing retired data from returning on later saves. Tests cover both previous account labels, malformed retired drafts, saved answers, resume history, profile/preferences and corrupt-state recovery. Passwords, PDF bytes and media remain unpersisted.

The demo has one allowance of 20 created text sessions per browser. Sample history does not consume it. Reaching that limit preserves access to saved sessions, complete feedback and report exports.

## Verification

- TypeScript, ESLint and production builds in demo and live modes pass.
- Backend: 34 passed, 1 skipped using isolated PGlite PostgreSQL with deterministic AI/Storage adapters. The skipped multi-connection concurrency test requires native PostgreSQL; CI retains it with `TEST_DB_CONCURRENCY=1`.
- Migration upgrade test passes with populated legacy accounts and retained rows/RLS/private storage assertions.
- Browser suites use installed Edge through Playwright: 14 demo checks and 5 live-harness checks. Coverage includes navigation, responsive layouts, desktop/mobile sidebar removal, retired-route 404s, pricing redirect, data hydration, account isolation, resume analysis/improvements/history/export/deletion, interviews/answers/reports/refresh, settings, ordinary usage limits and ungated full report exports.
- Generated OpenAPI contracts match the backend; secret/static-bundle scanning and diff whitespace checks pass.

Live browser verification uses actual application handlers and the durable worker with local Auth, AI and Storage adapters. Real-provider processing code is preserved, but no fresh hosted Supabase/Groq acceptance run or email-delivery check was performed for this simplification. A pre-existing Starlette/httpx test-client deprecation warning remains. Initial sandbox filesystem/network restrictions and missing bundled Chromium were resolved by running checks outside the sandbox with installed Edge.


Phase 4 supersedes the lifetime allowance: 10 resume analyses and 3 video interviews share a fixed, renewable 24-hour window. See [Phase 4](phase-4-acceptance.md).
