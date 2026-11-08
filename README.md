# Mockmate

A complete Phase 1 career-readiness frontend built with Next.js App Router, React, TypeScript, Tailwind CSS, shadcn-style Radix UI components, Recharts, React Hook Form, Zod, and Zustand.

The product focuses on **Resume Analysis, AI Interview Practice, AI Coding Rounds, and Suggestions & Advice**.

**This is a frontend portfolio demo.** AI feedback, resume analysis, password recovery, coding questions, and coding output are predefined simulations. There is no backend, production authentication, real AI, code execution, media recording, or file upload.

## Free and Pro

Exactly two plans: **Free — ₹0** and **Mockmate Pro — ₹299**, with no billing interval specified. Free includes basic resume analysis, basic interview reports, suggestions, and three created demo interview sessions. Pro includes twenty sessions, full coding rounds, advanced resume recommendations, and detailed feedback. Sample history does not consume the quota.

`src/config/plans.ts` is the source of truth for prices, benefits, capabilities, and quotas. `useFeatureAccess` and `FeatureGate` apply these capabilities consistently. The upgrade dialog explicitly enables a local Pro demo without payment. Settings → Demo account can switch back to Free.

## Run locally

Use Node.js 20.9 or newer (Node 24 was used during implementation).

```sh
npm ci
npm run dev
```

On Windows PowerShell, if execution policy blocks npm’s `.ps1` launcher, use `npm.cmd ci` and `npm.cmd run dev`. No execution-policy change is necessary.

Open http://localhost:3000. Click **Explore the demo** or **Continue with demo account**. All dashboard routes are intentionally accessible for portfolio review; demo sign-in is a UX simulation, not an access-control boundary.

```sh
npm run typecheck
npm run lint
npm run build
npm start
```

## Browser tests

```sh
npx playwright install chromium
npm run test:e2e
```

The test configuration starts a dedicated production server on port 3100. Run `npm run build` first. Set `PLAYWRIGHT_BASE_URL` to explicitly reuse another server. To use installed Chrome on Windows: `$env:PLAYWRIGHT_CHANNEL='chrome'; npm.cmd run test:e2e`.

Study [the frontend guide](docs/phase-1-frontend-guide.md) for architecture, route map, data flow, theme tokens, and Phase 2 integration. [The checklist](docs/phase-1-checklist.md) records scope and verification.

## Persistence and privacy

The versioned `mockmate-demo-v1` Local Storage key contains demo profile/preferences, plan selection, typed interview answers, resume metadata with sample analyses, coding drafts, follow-up answers, and integrity logs. Older saves default to Free, preserve relevant progress, and discard retired course-completion data. The theme uses the `theme` key. Email, passwords, PDF bytes, camera video, and microphone audio are never persisted. Use fictional, non-sensitive practice content. Settings → Demo account → Reset demo data restores Free and the sample workspace.

## Coding-round safeguards

Active rounds disable ordinary problem-text selection, copy/cut and context-menu actions inside the environment, and pastes/drops into the editor. Native typing, code selection, deletion, undo, and focus navigation remain available. Tab visibility and window focus changes are logged locally with neutral warnings. The review threshold and timer are configurable in `src/config/coding.ts`.

These controls are deterrents, not tamper-proof security. They cannot reliably prevent screenshots, external devices, developer tools, modified local state, or all clipboard workarounds. Events cause no automatic accusation or score penalty. Phase 2 needs authenticated subscription verification, trusted event recording, server validation, and isolated code execution.

See [the product refinement guide](docs/product-scope-refinement.md) for the updated workflows, removals, and access architecture.

The original `docs/design-reference/` images remain untouched. All UI uses the **Mockmate** product name. The starting workspace had no Git metadata or remote; no GitHub push or deployment has been performed.
