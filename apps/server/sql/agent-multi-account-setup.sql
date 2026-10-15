-- Multiple agent accounts per email (run once; the server also applies this on startup)

ALTER TABLE public."user" DROP CONSTRAINT IF EXISTS user_email_unique;
DROP INDEX IF EXISTS public.user_email_unique;

CREATE INDEX IF NOT EXISTS idx_user_email_lower
  ON public."user" (lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS user_agent_code_unique
  ON public."user" (upper(agent_code))
  WHERE agent_code IS NOT NULL AND agent_code <> '';

CREATE TABLE IF NOT EXISTS public.portal_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Rollback (only if no email is shared by two accounts):
-- ALTER TABLE public."user" ADD CONSTRAINT user_email_unique UNIQUE (email);
