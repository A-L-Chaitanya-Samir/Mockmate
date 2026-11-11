-- Existing config.mode='Text' and historical reports remain unchanged.
ALTER TABLE public.interview_sessions ADD COLUMN device_check jsonb;
ALTER TABLE public.interview_sessions ADD COLUMN observation_config jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.interview_sessions ADD COLUMN integrity_snapshot jsonb;
ALTER TABLE public.interview_sessions ADD COLUMN observation_gaps integer NOT NULL DEFAULT 0;
ALTER TABLE public.answers ADD COLUMN modality text NOT NULL DEFAULT 'text' CHECK(modality IN ('text','spoken'));
ALTER TABLE public.answers ADD COLUMN transcription_id uuid;
ALTER TABLE public.answers ADD COLUMN original_transcript text;
ALTER TABLE public.answers ADD COLUMN user_corrected boolean NOT NULL DEFAULT false;
ALTER TABLE public.jobs DROP CONSTRAINT jobs_kind_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_kind_check CHECK(kind IN ('resume','questions','response','evaluate','delete_resume','transcribe'));
CREATE TABLE public.transcriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 session_id uuid NOT NULL, question_id uuid NOT NULL, idempotency_key text NOT NULL,
 sha256 text NOT NULL, audio_bytes bytea, duration_seconds double precision NOT NULL CHECK(duration_seconds BETWEEN 1 AND 121),
 model text NOT NULL, original_text text, error text,
 status text NOT NULL DEFAULT 'processing' CHECK(status IN ('processing','ready','failed','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '1 hour',
 UNIQUE(session_id,idempotency_key), UNIQUE(id,session_id,question_id,user_id),
 FOREIGN KEY(question_id,session_id,user_id) REFERENCES public.questions(id,session_id,user_id) ON DELETE CASCADE
);
ALTER TABLE public.answers ADD CONSTRAINT answer_transcription_owner FOREIGN KEY(transcription_id,session_id,question_id,user_id)
 REFERENCES public.transcriptions(id,session_id,question_id,user_id);
CREATE TABLE public.interview_observations (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 session_id uuid NOT NULL, episode_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('no_face','multiple_faces','camera_unavailable','microphone_unavailable','tab_hidden','focus_lost','detection_unavailable','coverage_gap')),
 phase text NOT NULL CHECK(phase IN ('start','recovered')), observed_at timestamptz NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(), duration_ms integer CHECK(duration_ms BETWEEN 0 AND 86400000),
 UNIQUE(session_id,episode_id,phase),
 FOREIGN KEY(session_id,user_id) REFERENCES public.interview_sessions(id,user_id) ON DELETE CASCADE
);
CREATE INDEX observations_session ON public.interview_observations(session_id,user_id,received_at);
CREATE INDEX transcriptions_cleanup ON public.transcriptions(expires_at) WHERE audio_bytes IS NOT NULL;
ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.transcriptions,public.interview_observations FROM anon,authenticated;
-- Raw audio and observation ingestion are accessible only through the authenticated API.
GRANT ALL ON public.transcriptions,public.interview_observations TO service_role;
