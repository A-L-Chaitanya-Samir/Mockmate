# Mockmate product refinement

## Product scope

The current product has four areas: Resume Analysis, AI Interview Practice, AI Coding Rounds, and Suggestions & Advice. The existing navy/blue tokens, shared shell, forms, charts, dialog primitives, and interview workflow are retained.

Learning Hub and standalone Job Matching were removed, including their route files, feature components, mock data/services, state actions, and UI links. Old URLs return the normal 404; the application does not link to them. The existing coding route now hosts the gated coding-interview workflow. Analytics remains a supporting **detailed interview performance** view linked from AI Interviews, not a primary product module.

## Two plans, one access policy

`src/config/plans.ts` owns the two prices, descriptions, benefits, comparison rows, feature capabilities, and interview quotas:

- Free — ₹0: basic resume analysis and suggestions, three created interview sessions, basic reports, career suggestions, and dashboard access.
- Mockmate Pro — ₹299: all Free features, twenty created interview sessions, coding rounds, advanced resume recommendations, and detailed performance feedback.

There is no confirmed billing interval, so no monthly or annual price is presented. Quotas count created sessions in this browser, including unfinished sessions. Seed sample history is excluded. Existing sessions can be resumed and reports read after a quota is reached. These are configurable demo limits, not production billing rules.

`hasFeature` is the pure policy function. `useFeatureAccess` binds it to the persisted demo plan. `FeatureGate` prevents restricted feature components from mounting for Free visitors. `UpgradePrompt` and `UpgradeButton` provide a consistent, explicitly simulated upgrade dialog. The store checks the interview allowance when adding a newly created session, preventing simultaneous UI starts from reserving more slots than allowed. Coding saves also check the central capability.

Pro is enabled through **Upgrade to Pro → Enable Pro demo**. No gateway, card form, charge, renewal, or subscription is created. Settings → Demo account switches back to Free with an explanatory confirmation. Downgrading preserves existing data while hiding Pro features. A running coding timer continues while access is locked.

Frontend checks are UX gates, not authorization. A user can edit Local Storage or application JavaScript. The server must verify real identity, plan status, and entitlements in Phase 2.

## Coding-round workflow

1. Open `/dashboard/coding`. Free sees an upgrade screen; Pro sees setup or its latest saved round.
2. Choose a predefined question set and starting language. Acknowledge the visible interview rules.
3. `codingService.create` returns a typed round with a local ID, cloned starter drafts, timestamp, and configured duration.
4. The left problem panel shows the statement and constraints. The center contains the editor and output/test-case panels. The right panel contains scripted interviewer follow-ups and integrity events. The top bar shows timer, language, and status.
5. Type a solution, switch languages without losing drafts, and optionally explain follow-up answers. Drafts and explanations are saved in this browser.
6. **Run demo** returns explicitly simulated text. **Submit solution** asks for confirmation, then displays fixed feedback for correctness, approach, complexity, and problem-solving. No arbitrary code is executed or transmitted.
7. Completion stops the timer and integrity monitoring. Submitted feedback survives reload and contributes to Pro coding suggestions. Ending without submission keeps the draft/log but produces no evaluation. A new round can be started afterward.

The timer derives from the round start timestamp, so navigating away or refreshing does not restart it. At expiry, editing pauses and the user can submit the current draft or end the round. Completed timers use the completion timestamp.

## Editor choice

The existing native textarea editor was retained: no new dependency is needed. It supports ordinary typing, code selection, deletion, native undo/redo, and keyboard focus navigation. Spaces provide indentation; Tab moves focus rather than trapping keyboard users. It intentionally has no IDE syntax highlighting or arbitrary execution engine. A future richer editor can replace `RoundEditor` while keeping the typed draft and event contracts.

## Integrity event design

`useCodingIntegrity` records neutral, typed events. `createIntegrityEvent` is the client DTO boundary for a future authenticated event sink. `IntegrityPanel` shows cumulative count, recent events, timestamps, and status. Configuration owns the review threshold and stored-log cap. The latest eight events are shown; up to the configured maximum are retained, and the total count remains cumulative.

During an active coding round:

- CSS disables ordinary selection and drag selection of the problem text.
- Copy and cut events inside the environment are canceled and recorded. Code selection and Delete/Backspace still work.
- Editor paste, dropped content, and supported paste-related `beforeinput` events are canceled and recorded.
- The context menu is canceled only within the coding environment.
- `visibilitychange` records hidden tabs. A delayed visible-window blur records a window losing focus, avoiding the common double count of one tab switch.
- Returning to the page displays a reminder to review the log. After the configured event threshold, the status suggests review without declaring misconduct.

Listeners and timers are cleaned up on unmount or round completion. Async save operations read the latest round to avoid overwriting events that arrived while a mock service was pending. Integrity counts do not alter sample evaluations, lock the user out, or trigger disqualification.

These restrictions cannot reliably stop screenshots, external cameras/devices, developer tools, programmatic value changes, modified JavaScript, or every clipboard path. Browser visibility also cannot prove why focus changed. Accessibility tools and ordinary interruptions can trigger events. There is no real proctoring or trusted evidence collection in Phase 1.

## Suggestions & Advice

`buildSuggestions` combines prewritten recommendations with the latest resume fixture, latest interview summary, and Pro coding evaluation. Every recommendation shows its source. Categories cover resume impact, interview structure, communication, technical reasoning, and Pro coding feedback. Links lead directly to relevant practice or resume actions. No course catalog, lessons, enrollment, or completion tracker remains.

The dashboard shows resume score, total interviews, average interview score, coding access/status, recent interview activity, four quick actions, and improvement suggestions. Free sees a Pro-exclusive coding card; Pro gets a direct coding-round action.

## Persistence compatibility

The existing `mockmate-demo-v1` storage key is preserved. Its merge schema accepts older profiles and interview/resume records, defaults a missing or invalid plan to Free, initializes missing coding rounds, and strips retired course-completion fields. No password, email, media, PDF bytes, or payment information is stored. Coding drafts, reasoning, and integrity events are local demo data; use non-sensitive content and reset them in Settings when finished.

## Phase 2 boundaries

Replace mock services with FastAPI contracts and implement authenticated subscription verification and usage enforcement. Add payment handling only after defining actual billing rules. Coding submissions need isolated, resource-limited execution with server validation. AI question generation, follow-up generation, and evaluation must run through trusted backend services. Integrity events need authenticated round IDs, trusted receipt timestamps, retention controls, explicit review procedures, and protection against duplicate/tampered submissions. Frontend event handlers must remain transparent about what they can observe.

## Verification

Run `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`, and the Playwright suite. The browser suite uses a separate production server on port 3100 so an existing local development server is not reused. It checks both plans, retired routes, six-link navigation, pricing comparison, interview quotas, plan persistence/migration, ordinary editing/undo, clipboard restrictions, integrity warnings, mock coding submission, advice categories, and responsive layouts alongside the retained authentication/resume/interview tests.

Verified on 8 November 2026:

- Strict TypeScript check: passed.
- ESLint with zero warnings: passed.
- Production Webpack build: passed. Removed modules are absent from the route manifest, and Suggestions & Advice is included.
- Production browser suite: 18 tests passed. The route sweep checked browser console/JavaScript errors and every local navigation destination.
- Coding round responsive checks: 390, 768, 1024, and 1680 pixels. Existing interview-room responsive checks were retained.
- Native clipboard tests confirmed editor paste cancellation, copy cancellation, preserved clipboard content, and context-menu event recording. Visibility-change events were simulated deterministically to verify the listener and persistent event log.

No new package dependency was introduced. The QA screenshot `docs/screenshots/coding-round-pro.png` shows the Pro round; existing dashboard/interview screenshots were refreshed by the browser suite. The original design-reference files were not modified.
