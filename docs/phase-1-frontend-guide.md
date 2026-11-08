# Learning the Mockmate frontend

This guide explains the shared frontend foundation. For the current four-area product scope, Free/Pro capabilities, coding-round integrity handling, and Phase 2 boundaries, also read [the product refinement guide](product-scope-refinement.md).

## 1. The architecture

Mockmate is a frontend-only product simulation. Routes choose a view; feature components implement behavior; services supply typed data; the shared store remembers demo progress. The UI does not know how a future backend will generate an analysis.

For example, the resume page imports `ResumeWorkspace`. That feature calls `resumeService.analyze()`. The service currently returns a copy of `mockResume` after a delay. A future implementation can call FastAPI without changing the result component.

The stack uses Next.js App Router and strict TypeScript, React, Tailwind v4, Lucide, Recharts, React Hook Form, Zod, Zustand, next-themes, and Sonner. The checked-in UI primitives follow shadcn/ui’s copy-and-own approach with Radix primitives, `cva`, `Slot`, and `cn`; they are customizable source files rather than a black-box component package. Dialogs, tabs, and tooltips use Radix for accessible keyboard behavior.

## 2. Folder structure

```text
src/
  app/
    (public)/             Marketing and mock authentication routes
    (workspace)/dashboard/ Dashboard routes and shared layout
    interview-room/       Focused interview experience
    globals.css           Design tokens and shared component styling
    layout.tsx            Root metadata, providers, and skip link
    error.tsx             Recoverable client error boundary
    not-found.tsx         Friendly unknown-route fallback
  components/
    ui/                   Owned shadcn-style primitives
    app-shell.tsx         Responsive application frame
    charts.tsx            Responsive Recharts visualizations
    providers.tsx         Theme, tooltips, toasts, persistence hydration
  features/
    auth/                 Validated mock account flows
    dashboard/            Metrics, analytics, and history
    marketing/            Public product narrative and two-plan pricing
    resume/               File validation, sample analysis, improvements
    suggestions/          Unified recommendations and career advice
    interview/            Setup, room, report, and history entry points
    coding/               Pro coding interviews, inert editor, integrity panel
    settings/             Profile, preferences, theme, and reset
  config/                 Central plan capabilities and coding-round settings
  constants/              Application navigation
  data/                   Typed sample questions, scores, and coding fixtures
  hooks/                  Hydration and local media lifecycle
  lib/                    Shared formatting and class helpers
  services/               Mock transport and feature service contracts
  stores/                 Versioned persisted demo state
  types/                  Shared domain interfaces
tests/                    End-to-end browser tests
docs/design-reference/    Original supplied references, preserved
```

## 3. Next.js App Router

Each `page.tsx` becomes a URL. A `layout.tsx` wraps its child routes without duplicating the shell on every page. Parentheses create route groups: `(public)` organizes files but is omitted from the URL. Square brackets create dynamic segments: `[interviewId]` accepts an identifier.

In current Next.js, route `params` and `searchParams` are promises. The server route awaits them and passes a plain string into its client feature. This keeps framework-specific parameter handling out of the room’s business logic.

`loading.tsx` supplies a dashboard skeleton while route content is prepared. `error.tsx` lets the user retry unexpected failures. `not-found.tsx` catches unknown URLs. Feature-specific empty states handle missing local sessions without throwing an error.

## 4. Components and props

A component is a reusable function that returns UI. Props are inputs. `Progress` receives `value` and `label`; it does not fetch scores or know whether it appears on a resume or analytics page. `Button` accepts styling variants and uses `asChild` when a link needs button styling while retaining link semantics.

Prefer data-down and events-up: a parent owns meaningful state, sends values to children, and passes callbacks when children need to request a change. Shared primitives should not import feature services.

## 5. Server and client components

App Router files are server components by default. Small route files and marketing content stay server components. A file starts with `"use client"` when it needs React state, event handlers, Local Storage, chart measurement, or browser media APIs.

The root layout can render client providers around server-rendered children. Adding a provider does not force every child source module to become a client module. Keep client boundaries near interactive functionality. This limits the amount of JavaScript shipped for static content.

## 6. State management

There are three scopes:

- React `useState`: open dialogs, editor drafts, selected filters, simulated request status, current form results.
- React Hook Form: input values, validation messages, submission state, and dirty fields.
- Zustand: profile, preferences, interview sessions/history, resume metadata, plan selection, coding drafts, follow-ups, and integrity events shared across routes.

The store is justified because ending an interview changes both history and dashboard metrics. Putting every form field in Zustand would create unnecessary global coupling. Mock authentication records a boolean and demo profile only; it offers no security and does not gate the dashboard.

## 7. Hooks and browser lifecycles

`useEffect` connects React to external systems such as timers and media streams. Always clean up timers and tracks when the component unmounts. `useRef` holds a stream, DOM video element, or latest timer snapshot without making that value the source of a render.

`useDevices` requests camera and microphone access only after a click. Video is muted and local. Microphone access is represented as a device state, with no transcription or audio processing. Tracks stop when disabled, on interview end, and when leaving the room. Pending device requests that resolve after unmount stop their tracks immediately.

`useHydrated` uses `useSyncExternalStore` to distinguish server rendering from browser rendering. This prevents browser-only charts and persisted-session views from producing mismatched initial HTML. The providers rehydrate the store after mount.

`useDemoReady` waits for Zustand’s persistence hydration specifically. Setup and settings forms mount only after saved preferences load. This matters because React Hook Form reads `defaultValues` at initialization; merely changing a prop later does not reset a form. `demo-storage.ts` handles corrupt JSON, unavailable storage, and quota failures without breaking the demo.

## 8. Mock data and services

`src/data/mock-data.ts` is the source of fixtures. Questions vary by interview type; role, difficulty, language, duration, and mode are saved as context. These configuration values do not cause personalized AI generation.

`mockRequest<T>` imitates latency and returns a structured clone. Cloning helps avoid accidentally mutating the shared fixture. Services expose promises so callers can use loading states and `try/catch` just as they will with a real network service.

Every result surface labels simulated values. There is no answer scoring algorithm. The fixed report score is illustrative; old sample history has varied fixture scores. Suggestions are prewritten recommendations with their mock source shown. Free costs ₹0 and Pro is displayed at ₹299 without a billing interval. Upgrades only switch local demo access; there is no checkout.

## 9. Interview workflow

1. `/dashboard/interview/setup` validates the configuration with Zod and React Hook Form.
2. `interviewService.create` generates a `demo-` UUID and returns a session.
3. `saveSession` stores the session, then the router opens `/interview-room/[interviewId]`.
4. The room selects the predefined question bank for the interview type. Answers update the local session and persisted store.
5. A timer counts active room seconds. It persists every five seconds and on unmount. Time away from the room is paused, intentionally. At zero, the UI prompts the user to wrap up; it does not automatically discard an answer or force navigation.
6. Next question requires a short typed answer and returns a scripted acknowledgment. The final question opens the end confirmation.
7. Ending stops media tracks, simulates report preparation, marks the session complete, and adds its summary to history.
8. The report displays fixture scores, the user’s typed answers, and prewritten question guidance. It can export a clearly labeled JSON demo report.

Session IDs are local identifiers, not server resources. Opening a new session’s URL on another device shows a helpful missing-session state. Completed reports are available in their originating browser. Seed sample reports are available everywhere.

## 10. Routing and navigation

Public: `/`, `/about`, `/pricing`, `/login`, `/register`, `/forgot-password`.

Workspace: `/dashboard`, `/dashboard/resume`, `/dashboard/resume/analyze`, `/dashboard/resume/improve`, `/dashboard/interview`, `/dashboard/interview/setup`, `/dashboard/analytics`, `/dashboard/coding`, `/dashboard/suggestions`, `/dashboard/settings`.

Dynamic: `/interview-room/[interviewId]` and `/dashboard/interview/[interviewId]/report`.

`next/link` handles navigation. `useRouter().push()` is used after actions such as creating a session or logging out. The central navigation array controls sidebar links, icons, and active states. Dynamic room URLs highlight Interview Practice.

## 11. Form validation

Zod describes valid data. `zodResolver` bridges that schema into React Hook Form. `handleSubmit` runs the callback only after the schema accepts the input. Fields show inline errors, and React Hook Form focuses the first invalid field on submission.

Authentication validates email format, an invented eight-character demo password, registration name, and acknowledgment. Email and password are discarded. Setup restricts enum choices and supported duration values. Profile changes validate names, roles, and bio length.

PDF selection checks extension, MIME type, empty files, and a five-megabyte limit. This is UX validation, not a security boundary. The PDF is not parsed or sent anywhere. `URL.createObjectURL` creates a temporary local preview link; its URL is revoked when replaced or unmounted.

## 12. Local Storage

Zustand’s persist middleware stores JSON under `mockmate-demo-v1`. The schema is versioned. It rehydrates after mount so the server never reads `window`. Stored data is validated before merging; malformed content falls back to defaults.

Local Storage is synchronous, browser-specific, and not confidential. It is unsuitable for credentials or real tokens. This demo stores typed answers, so use fictional content. A production app should define retention and server access controls explicitly.

Settings can reset demo progress. Logout ends only the simulated login and preserves practice data. Appearance is handled by next-themes with a separate `theme` key. Device streams, PDF bytes, and resume-improvement drafts are not saved. Coding drafts, follow-up answers, integrity events, and the selected demo plan are persisted.

## 13. Connecting FastAPI in Phase 2

Keep `InterviewSession`, `ResumeAnalysis`, `InterviewReport`, `CodingRound`, and `CodingEvaluation` as explicit API contracts or generate their equivalents from an OpenAPI schema. Replace the mock service implementation at the service boundary:

```ts
// Phase 2 sketch only — not executed in Phase 1.
async function analyzeResume(file: File): Promise<ResumeAnalysis> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${apiBaseUrl}/resumes/analyze`, {
    method: "POST",
    body: form,
    // Supply the real authenticated session using the chosen auth strategy.
  });
  if (!response.ok) throw new Error("Resume analysis failed");
  return resumeAnalysisSchema.parse(await response.json());
}
```

Centralize base URL, timeout/cancellation, safe error mapping, authentication, and response validation. Move real progress/history to PostgreSQL instead of assuming Local Storage is the source of truth. Use Supabase Auth for real identity; only the server should call OpenAI with private credentials. Resume files should use an authenticated upload flow and deliberate storage policies.

Do not treat the demo login as authorization. Add real route/session handling and backend permission checks together in Phase 2. No backend, auth SDK integration, real requests, keys, or credentials are included now.

## 14. Running and verifying

```sh
npm ci
npm run dev
npm run typecheck
npm run lint
npm run build
npm start
```

For automated browser checks, build first, install the Playwright Chromium browser, then run `npm run test:e2e`. The tests exercise routes, form errors, local persistence, demo workflows, and mobile overflow. See the checklist for actual results from this implementation session.

## 15. What to study first

Start with a small vertical slice rather than reading every file:

1. `src/app/(workspace)/dashboard/page.tsx` — see how a route chooses a feature.
2. `src/components/ui/primitives.tsx` — understand props and reusable UI.
3. `src/features/interview/interview-setup.tsx` — follow form validation into a service.
4. `src/services/mock-services.ts` and `src/types/index.ts` — inspect data contracts.
5. `src/stores/demo-store.ts` — understand how data survives navigation and refresh.
6. `src/features/interview/interview-room.tsx` — follow session updates, timer cleanup, and completion.
7. `src/features/interview/interview-report.tsx` — see saved data become a report.
8. `src/app/globals.css` — explore how shared tokens give the product its identity.

Try changing a mock question, adding a new suggestion category, introducing a new button variant, or adding a validated profile field. Then trace every affected type, component, and stored value. A useful exercise is replacing just one mock service with a local JSON fixture while preserving its promise contract.

## Design system and responsive behavior

The dark theme translates the supplied reference into navy backgrounds, restrained blue emphasis, fine borders, and a clear hierarchy. No reference screenshot is used as rendered UI. The interviewer uses an original CSS/SVG brand motif instead of implying a real human video feed.

Color tokens include background, secondary background, sidebar, surface, elevated surface, input, primary, hover, soft accent, foreground, muted, subtle, border, success, warning, and error. Light mode overrides the same roles. Primary action text remains white; dark text is never placed on a dark blue action. Typography, radius, shadow, base spacing, sidebar width, header height, and maximum content widths also have tokens.

The sidebar is fixed on desktop and can collapse. On mobile it becomes an explicit navigation drawer with a dismissible backdrop. The interview room forms three visual columns on wide screens: application sidebar, conversation, and performance. At tablet sizes, performance moves below the conversation. Mobile stacks sections, compacts controls, and allows performance to collapse.

`SidebarContent` shares the same navigation content between desktop and mobile. The desktop sidebar scrolls on short displays, keeping logout reachable. The mobile drawer uses a Radix dialog to trap focus, support Escape, and restore focus to its trigger.

Charts use responsive containers and explicit parent heights. Tables scroll within their own container. Buttons have visible focus states; dialogs trap focus and support Escape; tabs support keyboard navigation; icon actions have accessible names. Reduced-motion preferences disable transitions and waveform animation.

To change the theme, edit semantic CSS variables in `:root` and `.dark`, not individual feature colors. Add reusable patterns in `components/ui` and shared CSS classes, and use Tailwind utilities for composition. Repeated product content belongs in typed data rather than copied JSX.

## Intentional limitations

- No backend, secure authentication, email delivery, payments, AI inference, ATS parsing, real matching, or arbitrary code execution.
- Voice/video modes offer device states and local preview, with typed answers only.
- Fixed fixture scores and feedback cannot assess actual career readiness.
- Interview and coding-round progress are browser-local. Clearing storage removes personal demo progress.
- Resume file metadata is persisted; PDF contents are not retained or uploaded.
- Editor drafts and job/improvement inputs are temporary; settings and interview answers persist.
- The supplied workspace was not a Git checkout. Publishing or pushing requires an actual remote and is outside this local implementation.

## Verification notes

The production scripts explicitly use Next.js’s supported Webpack option. Turbopack’s PostCSS worker could not connect on this Windows host, including outside the sandbox; the Webpack production build completed successfully.

The runtime dependency audit found zero advisories. The full audit reported eight moderate advisories in the development-only ESLint → TypeScript ESLint → minimatch chain (GHSA-g3hv-75wg-m249). The audit tool proposed downgrading eslint-config-next across a major version. That forced downgrade was not applied. Recheck the dev-tool advisory chain when updating dependencies; ESLint 9 is also deprecated upstream but remains compatible with the installed Next.js lint preset.

See `docs/phase-1-checklist.md` for commands and the final browser results. Screenshots in `docs/screenshots` are QA captures, not application assets.

Helpful primary references: [Next.js App Router installation](https://nextjs.org/docs/app/getting-started/installation), [shadcn/ui manual installation](https://ui.shadcn.com/docs/installation/manual), and [shadcn/ui with Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4).
