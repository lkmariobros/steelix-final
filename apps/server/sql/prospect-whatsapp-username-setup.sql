-- WhatsApp username support for leads/prospects
-- Run once in Supabase SQL Editor

ALTER TABLE public.prospects
  ALTER COLUMN phone SET DEFAULT '';

ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS whatsapp_username text;

-- Unique WhatsApp username when present (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS prospects_whatsapp_username_unique_ci
  ON public.prospects (lower(whatsapp_username))
  WHERE whatsapp_username IS NOT NULL
    AND btrim(whatsapp_username) <> '';

COMMENT ON COLUMN public.prospects.whatsapp_username IS
  'Fallback lead identity when phone is unavailable (WhatsApp username).';
