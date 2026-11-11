# Phase 4 follow-up: rigorous interviews and responsive acceptance

> Latest revision: [remaining quality work and acceptance limits](phase-4-quality-closure.md) supersedes earlier grading/version and verification status where noted. Historical results below remain dated evidence.

Evidence date: 11 November 2026. This supplements the [original acceptance record](phase-4-acceptance.md) and [manual checklist](phase-4-manual-acceptance.md). It does not turn unperformed provider/device checks into passes.

## Changes

New interview creation accepts an explicit Intern/Junior/Mid-level/Senior selection; existing configuration JSON without it defaults to Mid-level for new requests. The UI remains Video-only. The question policy `interview-depth-v1` specifies four distinct role-appropriate questions, different Easy/Medium/Hard scopes, realistic scenarios, explicit requested aspects, no coding tasks/trivia, and targeted follow-ups that probe weak reasoning or deepen sound answers. Resume claims remain unverified. Duplicate prompts differing only by punctuation/case are rejected. Successful question/follow-up jobs retain the policy version in backend job metadata.

New reports use `transcript-v3-rigorous` and prompt version `interview-grading-v3`. Correctness/relevance 40%, reasoning/evidence 35%, and clarity/structure 25%, half-up rounding and inclusion of unanswered questions are unchanged. Full marks remain possible; there is no score multiplier, ceiling or forced failure rate. Factual errors, missing requested mechanisms and unjustified claims reduce the relevant criteria; concise correct explanations and valid alternatives can receive full credit. Seniority/difficulty calibrate the actual question, not hidden requirements. Camera/phone/focus configuration is removed from grading input. Submitted nonresponsive text cannot be labeled an absent answer. Stored historical reports are read without recalculation and retain their versions.

The sample scenario, essential expectations, excellent/competent/borderline/weak/incorrect/off-topic/filler/transcription-error/unanswered answers and authored anchors are versioned in [calibration-v2.json](../backend/app/ai/calibration-v2.json). Authored anchors are not real-model outputs. [Policy tests](../backend/tests/test_interview_policy.py) verify scoring arithmetic/order for those anchors, full credit, seniority bounds, duplicate rejection and observation isolation.

A stopped local worker and the heartbeat path exposed a reliability weakness: a database error while writing its heartbeat could terminate the process outside its retry handler. Heartbeat/maintenance now run inside that handler, retry after five seconds and resume processing. [Recovery test](../backend/tests/test_worker_recovery.py) injects a failed connection and verifies recovery. The allowance banner now lives inside main content so a fixed desktop sidebar cannot cover it. New and historical transcript reports both show calculated coverage; reports display their rubric version.

No new migration is required: seniority is saved in the existing session configuration JSON and policy versions in existing job/report fields. No historical migration or stored report was rewritten. Creation-key retries normalize the new default seniority when comparing older stored configurations, preserving the original resource and single allowance charge; changing seniority still conflicts. No production deployment or Git push is authorized by this follow-up.

## Responsive layout and accessibility scope

Changes use rem-based typography with a bounded fluid root scale for ultrawide/TV-sized viewports, sensible content maximums, shrinkable grid/flex children, wrapped controls and long text, 44px mobile controls, 16px mobile form inputs, visible focus outlines, constrained media, scalable chart labels/heights with full accessible score summaries, short-landscape handling and small-screen form/navigation adjustments. There is no whole-page transform/zoom scaling. Text/primary-button color tokens were adjusted for normal-text contrast on both themes. Reduced-motion rules remain in place.

The new [responsive tests](../tests/responsive.spec.ts) check public/auth, dashboard, analytics, resume screens, interview setup/history, settings/suggestions, saved reports, device checks and the interview room at widths **320, 360, 390, 430, 600, 768, 820, 1024, 1280, 1440, 1920, 2560 and 3840**, plus 844×390 landscape. Checks cover page overflow, visible headings, form/control bounds, mobile target height, drawer focus trapping/return, and 200% text reflow. Token contrast checks cover normal text roles on background/surface/elevated and primary buttons; they are not a complete WCAG audit.

Recorded desktop test engines: Chrome **157.0.8103.39**, Playwright Firefox **159.0**, Playwright WebKit **27.2**, on Windows. Each recorded live layout matrix covered at least 210 route/viewport combinations; exact route counts are retained in the JSON evidence. Chrome includes labeled fake interview media; Firefox/WebKit runs were layout-only and did not acquire media. Representative phone/4K screenshots were inspected. Final run results and metadata are recorded separately with the commands below.

This establishes desktop browser-engine layout coverage and viewport emulation. It does **not** establish physical Android/iPhone/iPad behavior, actual Safari/macOS behavior, smart-TV codecs/WASM/device APIs, TV remote navigation or a full screen-reader audit. A Playwright WebKit run on Windows is not a Safari/iPhone hardware test. Existing permission/detector/codec guidance blocks unsupported spoken entry rather than silently changing to text practice. Long-text/empty/error/quota behavior also retains its existing regression coverage; the viewport matrix is not a claim that every possible application state was exercised at every size.

Ignored screenshots/JSON metadata: `.test-deps/responsive-live-chromium`, `.test-deps/responsive-live-firefox`, `.test-deps/responsive-live-webkit`, and `.test-deps/responsive-demo-chromium`. These artifacts contain deterministic data/fake media only. Automated build output can be isolated with `MOCKMATE_BROWSER_BUILD=1`, so tests do not replace the running normal `.next` build. Next.js adds the corresponding generated type directories to tsconfig; the normal build regenerates next-env references before handoff.

## Real-model scoring evaluation

[Raw safe evidence](rigorous-evaluation-results.jsonl) is append-only and contains synthetic content, model/rubric identifiers, timestamps, scores and feedback. The bounded runner [rigorous-evaluation.py](../scripts/rigorous-evaluation.py) stops on provider errors and spaces batches; it makes no real-user calls. Prior [v2 results](phase-4-grading-results.jsonl) remain preserved.

Initial observations with the new rubric: excellent 88, competent 95, borderline 66, weak 34, incorrect 11, off-topic 0, filler 0, transcription errors 88, unanswered 0. These are variable model judgments, not regression targets. Strong/competent responses clearly exceeded incorrect/filler responses, but the excellent/competent ordering was not stable across separate batches. Both answers cover the core scenario; a label alone does not mandate a higher score.

Review found real quality issues: an initial response demanded unasked isolation levels/external side effects, and submitted filler was called unanswered. Scope calibration was made explicit and nonresponsive wording is now enforced for submitted answers. One subsequent batch was rejected for missing evidence; the failure was retained and no invalid report was accepted. A bounded retry produced excellent 88, filler 4 and transcription-error 83. Its feedback also misattributed the other answer's “role back” wording to the excellent answer. That remains a known model feedback-attribution limitation, especially in a synthetic batch repeating the same question. Do not represent this tiny set as calibrated hiring accuracy or claim all feedback is error-free. Further evaluation should compare equivalent answers consistently and inspect attribution without imposing arbitrary score cuts.

The generated-question sample covered API design, database transactions, production error diagnosis and performance trade-offs; the follow-up to a shallow transaction answer requested concrete failure/rollback verification. These were real-provider samples, not a broad benchmark of roles/seniority/difficulties. No personality/emotion/vocal-confidence inference appeared in the reviewed samples; deterministic input isolation also passed.

## Email configuration and delivery

Read-only setup checks passed matching frontend/backend project/key configuration, email/password signup, mandatory confirmation, rejection of invalid Auth tokens, matching database, current tables/RLS and private resume storage. No SMTP/provider or management credentials were present in the project environment. The connected Supabase plugin still targets another inactive project and was not modified.

The repeatable [email audit](../scripts/audit-auth-email.py) reports public facts separately from hosted SMTP configuration, provider capacity and actual inbox delivery. With management access it reads only the matching project's hosted Auth settings, never prints SMTP passwords and never sends mail. It currently returns an incomplete-setup result because matching management access is unavailable. No authorized inbox has been supplied; no email was sent. The actual configured provider, activation, sender verification, recipient restrictions, provider quotas, hosted hourly limit and production redirect allowlist remain unverified.

Official Supabase [SMTP](https://supabase.com/docs/guides/auth/auth-smtp) and [rate-limit](https://supabase.com/docs/guides/auth/rate-limits) documentation was rechecked; no relevant SMTP breaking entry appeared in the changelog index. Brevo's [published free allowance](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan) remains 300 sends/day, a researched option rather than verified account capacity. Preserve a suitable existing provider if configured. The proposed budget remains 50 verification + 100 resend + 100 recovery + 50 spare, subject to actual provider settings. The [existing setup steps](phase-4-acceptance.md#email-delivery-configuration-still-required) distinguish provider activation, hosted limits/URLs and application changes. Keep confirmation mandatory; never impose a 50-account cutoff or purchase billing/domain services for acceptance.

## Consenting physical acceptance

The tester explicitly authorized physical microphone audio transmission to Groq, local camera checks and separate optional image transmission, and confirmed readiness. A real-device run with no fake-device flags enumerated two cameras/four microphone inputs, opened a live microphone track and ran the real local detector on five camera frames. Tracks were stopped; no full video or saved sample was created by that availability check.

The initial guided helper had an automation timeout before reaching the interview. A subsequent run recorded one audio-upload request and one optional image-check request, but no submitted answer or completed report. The tester explicitly reported that transcription worked and the window closed itself. The helper's earlier resume-page wait—not an asserted product crash—caused premature closure. This is limited physical-transcription evidence, not an end-to-end pass. Failed/incomplete runs and tester confirmation remain in [physical evidence](physical-acceptance-results.jsonl).

The helper was corrected to select a non-sensitive sample PDF, then observe passively while the tester controls analysis, setup, devices, recording, transcript submission and completion. Temporary accounts are admin-confirmed synthetic accounts: they do not verify inbox delivery. No traces, saved audio or retained camera images are produced by the helper. It counts successful requests without logging answer/transcript content and checks refresh/a second browser context only after a completed report. Temporary private files and the account are removed afterward. A 30-minute safety timeout closes unattended capture. Run it only with a ready consenting tester:

```powershell
backend/.venv/Scripts/python.exe scripts/guided-physical.py --consent-audio-camera
```

The final passive guided run completed at 10:09:04 UTC on 11 November: **six accepted audio uploads, six accepted answer submissions, six optional image-check requests, saved-report refresh and a second signed-in browser context all succeeded**. The Realtek microphone and integrated-camera tracks were both `ended` afterward. The temporary account/private test files were removed. The tester reported that face and phone detection worked smoothly. This establishes the positive physical spoken journey and limited positive-scene observation evidence; it does not establish calibrated detection accuracy or all adverse scenarios.

Real face-absence/recovery thresholds, multiple consenting faces, negative/ambiguous phone scenes, pending-request consent withdrawal, controlled optional-provider failure and all adverse physical audio/device conditions remain distinct checks. Do not mark them passed from a smooth positive journey alone.

Remaining real face/multiple-face/phone scene accuracy, consent withdrawal with a pending real image request, adverse physical audio/device conditions and physical mobile/Safari/TV behavior must be recorded from actual results. A prior successful reference-image test or a fake-device regression does not close them. Any additional person in a camera scene needs their own consent. Treat phone/focus changes as observations, separate from answer scores.

## Verification commands and closure

Backend tests must run with the deterministic browser harness stopped: its background worker can otherwise consume test-suite jobs and corrupt test isolation. An overlapping local attempt exposed this mistake; it was stopped and backend tests were rerun cleanly. Browser suites use a fresh test harness afterward. This was test-run interference, not an application acceptance pass/fail to conceal.

```powershell
# Isolated database, then backend tests with no browser harness against that database:
node scripts/test-db.mjs
$env:PYTHONPATH='backend'
$env:TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/postgres'
backend/.venv/Scripts/python.exe -m pytest backend/tests -q

# Start scripts/browser-test-server.py only after backend tests finish.
# Build the deterministic live frontend with MOCKMATE_BROWSER_BUILD=1 and the
# test Auth/API settings from the setup guide; run Chrome live regressions.
# Optional layout-only engines:
$env:PLAYWRIGHT_ENGINE='firefox' # or webkit
$env:RESPONSIVE_LAYOUT_ONLY='1'
npx playwright test tests/responsive.spec.ts
```

The previous GitHub commit `59a7b14` passed native CI (82 backend, 15 demo, 17 live tests). This follow-up is local and has not been pushed. Final local verification: **86 backend tests passed, 3 native-only tests skipped; 19 live Chrome tests passed; 17 demo/product/visual tests passed**. Firefox and WebKit responsive/contrast suites each passed (2 tests per engine). The demo suite preceded the final chart-size refinement; the final live suite and both engine layout runs include it. ESLint, TypeScript, OpenAPI consistency, migration-preservation checks, secret scanning and production builds passed. The backend retains one existing Starlette/httpx deprecation warning. [Responsive evidence](responsive-acceptance-results.json) retains exact route/viewport matrices and engine versions. Restart/readiness results are recorded below. Overall Phase 4 remains partially accepted until actual email settings/delivery, the remaining observation/adverse-condition checks and intended physical device scope have evidence. The positive desktop physical journey is now verified, while actual inbox delivery remains open. Model feedback limitations above must remain disclosed.

Restart verified on 11 November 2026: the final normal production build is serving at `http://127.0.0.1:3000` (HTTP 200); API `/health` and `/ready` on port 8000 both returned HTTP 200. A fresh worker process remains running with no startup error. Temporary browser harness/database processes were stopped. No Git commit, push or deployment was performed.
