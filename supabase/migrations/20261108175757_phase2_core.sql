-- Single migration authority. Application connections are privileged; API ownership
-- checks are mandatory in addition to these browser-facing read-only RLS policies.
CREATE TABLE public.profiles (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
 data jsonb NOT NULL DEFAULT '{"name":"New member","role":"","bio":"","notifications":true,"reminders":true}',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(id=user_id)
);
CREATE TABLE public.entitlements (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 plan text NOT NULL DEFAULT 'free' CHECK(plan IN ('free','pro')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.usage_reservations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('resume','interview')), idempotency_key text NOT NULL,
 resource_id uuid NOT NULL, state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','consumed','released')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,idempotency_key)
);
CREATE TABLE public.resumes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 filename text NOT NULL, storage_path text NOT NULL UNIQUE, sha256 text NOT NULL, target_role text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'processing' CHECK(status IN ('processing','ready','failed','deleting')),
 pdf_bytes bytea, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,user_id),
 CHECK(storage_path=user_id::text || '/' || id::text || '.pdf')
);
CREATE TABLE public.resume_analyses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 resume_id uuid NOT NULL, version int NOT NULL CHECK(version>0), result jsonb NOT NULL,
 model text NOT NULL, rubric_version text NOT NULL DEFAULT 'resume-v1', prompt_version text NOT NULL DEFAULT 'phase2-v1',
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(resume_id,version),
 FOREIGN KEY(resume_id,user_id) REFERENCES public.resumes(id,user_id) ON DELETE CASCADE
);
CREATE TABLE public.interview_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 config jsonb NOT NULL, status text NOT NULL DEFAULT 'generating' CHECK(status IN ('generating','active','evaluating','completed','failed')),
 deadline timestamptz, completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,user_id)
);
CREATE TABLE public.questions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 session_id uuid NOT NULL, position int NOT NULL CHECK(position BETWEEN 0 AND 5), prompt text NOT NULL, topic text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(session_id,position), UNIQUE(id,user_id), UNIQUE(id,session_id,user_id),
 FOREIGN KEY(session_id,user_id) REFERENCES public.interview_sessions(id,user_id) ON DELETE CASCADE
);
CREATE TABLE public.answers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 session_id uuid NOT NULL, question_id uuid NOT NULL UNIQUE, text text NOT NULL CHECK(length(text) BETWEEN 10 AND 6000),
 response jsonb, idempotency_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(session_id,idempotency_key),
 FOREIGN KEY(question_id,session_id,user_id) REFERENCES public.questions(id,session_id,user_id) ON DELETE CASCADE
);
CREATE TABLE public.interview_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 session_id uuid NOT NULL UNIQUE, result jsonb NOT NULL, model text NOT NULL,
 rubric_version text NOT NULL DEFAULT 'text-v1', prompt_version text NOT NULL DEFAULT 'phase2-v1', created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(session_id,user_id) REFERENCES public.interview_sessions(id,user_id) ON DELETE CASCADE
);
CREATE TABLE public.jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 resource_id uuid NOT NULL, kind text NOT NULL CHECK(kind IN ('resume','questions','response','evaluate','delete_resume')),
 idempotency_key text NOT NULL, payload jsonb NOT NULL DEFAULT '{}',
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','succeeded','failed','cancelled')),
 error text, attempts int NOT NULL DEFAULT 0, retry_count int NOT NULL DEFAULT 0,
 available_at timestamptz NOT NULL DEFAULT now(), lease_until timestamptz, lease_token uuid,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,idempotency_key)
);
CREATE TABLE public.worker_heartbeats(id uuid PRIMARY KEY,seen_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.api_rate_limits(
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 minute timestamptz NOT NULL, count int NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id,minute)
);
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_rate_limits FROM anon,authenticated;
CREATE INDEX jobs_claim ON public.jobs(status,available_at,lease_until);
CREATE INDEX reservations_owner ON public.usage_reservations(user_id,kind,state);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['profiles','entitlements','usage_reservations','resumes','resume_analyses','interview_sessions','questions','answers','interview_reports','jobs'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY owner_read ON public.%I FOR SELECT TO authenticated USING ((select auth.uid())=user_id)',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
  -- Backend DTOs are the only access path for raw resume bytes and job payloads.
  IF t NOT IN ('resumes','jobs') THEN EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t); END IF;
  EXECUTE format('CREATE INDEX ON public.%I(user_id,created_at)',t);
 END LOOP;
END $$;
ALTER TABLE public.worker_heartbeats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.worker_heartbeats FROM anon,authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('resumes','resumes',false,5242880,ARRAY['application/pdf']) ON CONFLICT(id) DO UPDATE SET public=false;
-- No direct browser writes; the API validates and the worker uploads server-side.
-- Browser lacks raw resumes SELECT; file downloads use an API-authorized 60s URL.
-- No permissive policies means private bucket requests fail closed for browser roles.
