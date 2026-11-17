-- Optional external image checks: store metadata only, never camera image bytes.
ALTER TABLE public.interview_sessions ADD COLUMN vision_state jsonb NOT NULL DEFAULT '{}';
CREATE TABLE public.interview_vision_checks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 session_id uuid NOT NULL, idempotency_key text NOT NULL, sha256 text NOT NULL,
 status text NOT NULL DEFAULT 'processing' CHECK(status IN ('processing','completed','unavailable')),
 result text CHECK(result IN ('visible','not_visible','uncertain')), model text NOT NULL,
 observed_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now(), checked_at timestamptz,
 error_code text, episode_id uuid, phase text CHECK(phase IN ('start','recovered')),
 UNIQUE(session_id,idempotency_key),
 FOREIGN KEY(session_id,user_id) REFERENCES public.interview_sessions(id,user_id) ON DELETE CASCADE
);
CREATE INDEX vision_checks_session ON public.interview_vision_checks(session_id,user_id,received_at);
CREATE INDEX vision_checks_budget ON public.interview_vision_checks(received_at);
CREATE TABLE public.vision_provider_limits (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), blocked_until timestamptz,
 requests timestamptz[] NOT NULL DEFAULT '{}'
);
INSERT INTO public.vision_provider_limits(id) VALUES(true);
ALTER TABLE public.interview_vision_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vision_provider_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.interview_vision_checks,public.vision_provider_limits FROM anon,authenticated;
GRANT ALL ON public.interview_vision_checks,public.vision_provider_limits TO service_role;
