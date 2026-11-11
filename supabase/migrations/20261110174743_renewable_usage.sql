-- Existing lifetime history remains unchanged and is never imported into daily windows.
BEGIN;
CREATE TABLE public.usage_windows (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 CHECK(ends_at > starts_at), UNIQUE(id,user_id)
);
CREATE INDEX usage_windows_account ON public.usage_windows(user_id,ends_at DESC);
CREATE TABLE public.usage_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 window_id uuid NOT NULL,
 resource_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('resume','interview')),
 state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','consumed','released')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), settled_at timestamptz,
 FOREIGN KEY(window_id,user_id) REFERENCES public.usage_windows(id,user_id) ON DELETE CASCADE
);
CREATE INDEX usage_attempts_window ON public.usage_attempts(window_id,kind,state);
CREATE UNIQUE INDEX usage_attempts_active_resource ON public.usage_attempts(user_id,resource_id) WHERE state!='released';
ALTER TABLE public.usage_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.usage_windows,public.usage_attempts FROM PUBLIC,anon,authenticated;
COMMIT;
