-- Retire the obsolete plan selector only. No usage history or user records change.
-- No coding tables exist in the Phase 2 schema. Do not alter historical migrations.
BEGIN;
DROP TABLE public.entitlements;
COMMIT;
