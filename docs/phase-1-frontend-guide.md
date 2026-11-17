# Frontend guide

The original Phase 1 scope is superseded by the [current architecture](project-overview-and-architecture.md). Live mode connects the retained interface to Phase 2 services; the demo build uses explicit fixtures.

Shared components preserve the original themes, panels, charts, navigation, keyboard support and responsive layouts. Public routes cover the homepage, about, registration, login and password recovery. Workspace areas cover resumes, camera-on spoken interviews, dashboard/analytics, suggestions and account settings. /pricing redirects home.

Client state uses React for transient forms and Zustand for browser-local demo records. Validated persistence preserves profiles, preferences, resumes, sessions, answers and history, stripping retired fields on hydration. No passwords, PDF bytes, or media are persisted. Live accounts never import demo data.

Resume improvements, detailed reports and analytics are accessible to everyone. Demo setup enforces a single limit of 20 created sessions; server allowances apply separately in live mode. Existing reports remain available when limits are reached.

Run TypeScript, ESLint, production build and both browser modes as documented in phase-2-setup.md. Frontend tests cover route integrity, data compatibility, resume analysis/improvements, interviews/reports, account preferences, device previews, keyboard navigation and responsive layouts.
