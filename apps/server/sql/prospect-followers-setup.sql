-- Lead followers (sales leaders tracking team members' leads). Run once on your DB.

CREATE TABLE IF NOT EXISTS public.prospect_followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospect_followers_prospect_id
  ON public.prospect_followers (prospect_id);

CREATE INDEX IF NOT EXISTS idx_prospect_followers_user_id
  ON public.prospect_followers (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prospect_followers_unique
  ON public.prospect_followers (prospect_id, user_id);
