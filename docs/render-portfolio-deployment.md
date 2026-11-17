# Render portfolio deployment

Deploy two Free Web Services from this repository: a Docker API/worker service and a Node Next.js service. Supabase continues to own Auth, PostgreSQL and private storage. Groq remains the AI provider. Do not create a Render database or upload environment files to Git.

This is a low-traffic portfolio setup, not an always-on service. Free Render services sleep when idle; both services share the workspace free-instance allowance. Jobs and temporary-audio cleanup pause while the backend sleeps and resume when it wakes. Never promise background completion while the service is asleep.

## 1. Push deployment source

Commit `backend/app/render_start.py` and this guide, then push the intended branch. The existing Dockerfile copies the launcher with the rest of `backend/app`. It does not change ordinary local API/worker commands.

## 2. Backend: New > Web Service

- Repository: your Mockmate GitHub repository; branch: `main` (or the pushed deployment branch).
- Name: `mockmate-api` or another available name.
- Language/runtime: Docker.
- Root directory: leave blank (repository root).
- Dockerfile path: `backend/Dockerfile`.
- Docker build context: `.` (repository root).
- Instance: Free.
- Advanced > Docker Command: `python -m app.render_start`.
- Health check path: `/ready`.

The launcher supervises one API and one worker, listens on Render's `PORT`, stops both on shutdown, and exits unsuccessfully if either child exits unexpectedly. Render can then restart the service. Keep one web-service instance; do not add another separately deployed worker for this setup.

Set these server environment variables privately in Render, using the same configured development project/account unless intentionally switching:

```dotenv
DATABASE_URL=<hosted Supabase PostgreSQL connection URL>
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable key>
SUPABASE_SECRET_KEY=<server secret key>
GROQ_API_KEY=<Groq key>
GROQ_MODEL=openai/gpt-oss-20b
TRANSCRIPTION_MODEL=whisper-large-v3-turbo
RESUME_LIMIT=10
INTERVIEW_LIMIT=3
USAGE_WINDOW_HOURS=24
CORS_ORIGINS=["https://<actual-frontend-host>.onrender.com"]
PYTHONUNBUFFERED=1
```

Use configured model names if they differ; verify account availability. The rest of the settings retain code defaults. Keep `PYTHONPATH` from the Dockerfile. Render supplies `PORT`; do not copy the frontend's `NEXT_PUBLIC_` settings into this service unnecessarily.

For `DATABASE_URL`, use a hosted URL, never localhost. If the direct connection is unreachable from Render, obtain the Supabase **session pooler** connection string from Connect; use its actual host, port and username and correctly URL-encode the password. Preserve TLS requirements. Do not apply migrations automatically on each service boot. Review/apply missing migrations explicitly to the intended database before starting updated services.

You can initially set CORS to the intended frontend origin, then replace it with the actual URL after frontend creation. After deployment verify `/health` and `/ready`. Health proves a running API; readiness also checks configuration, database and worker heartbeat, not successful AI inference or inbox delivery.

## 3. Frontend: New > Web Service

- Same repository and branch.
- Name: `mockmate` or another available name.
- Language/runtime: Node.
- Root directory: blank (repository root).
- Build command: `npm ci && npm run build`.
- Start command: `npm run start -- --hostname 0.0.0.0 --port $PORT`.
- Instance: Free.

Use a Node Web Service, not a Static Site: this frontend needs server-side authentication/session handling.

```dotenv
NODE_VERSION=24
NEXT_PUBLIC_SUPABASE_URL=https://<same-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<same publishable key>
NEXT_PUBLIC_API_URL=https://<actual-backend-host>.onrender.com
NEXT_PUBLIC_DEMO_MODE=false
```

The API URL is the deployed backend's base URL, without `/api` or `/api/v1`, and is not Groq's URL. Never put the database URL, Groq key or Supabase secret key in the frontend service. Public variables are set at build time; changing them requires a rebuild.

## 4. Connect origins and authentication

1. Copy the actual frontend URL into backend `CORS_ORIGINS` as a JSON array, with no trailing slash, and redeploy/restart the backend.
2. In the matching Supabase project's Auth URL configuration, set Site URL to the frontend origin and allow the exact frontend `/auth/callback` and `/auth/callback?next=/reset-password` destinations used by this app. Preserve local development URLs if still needed.
3. Keep confirmation mandatory and verify actual SMTP delivery. Hosting the application does not provision an email sender or lift provider restrictions. Supabase handles authentication email; this design does not send SMTP directly from Render.

## 5. Verify the deployed portfolio

Open `/ready` on the backend and allow a cold start before testing the frontend. Verify sign-in, one non-sensitive PDF analysis, camera/microphone entry, spoken answer transcription, submission, saved report and refresh. Confirm jobs are processed by the deployed worker rather than a local worker. Stop local workers during that acceptance check only when no local job is being processed.

Do not close a local worker in the middle of a real job just to test deployment. A completed provider smoke alone is not a deployed interview acceptance pass. Confirm private file and cross-account protections and do not publish a shared account containing personal data. Keep API keys in the backend only.

Free-host limitations: startup delay, idle suspension, finite shared hours, bandwidth/build limits and shared Groq capacity. Supabase Free may also pause on low activity. A walkthrough video is useful as a portfolio fallback. No hosted resources, secrets, migrations or Git push are created by adding these files.

References: [Next.js on Render](https://render.com/docs/deploy-nextjs-app), [Docker on Render](https://render.com/docs/docker), [Free instance limits](https://render.com/docs/free).
