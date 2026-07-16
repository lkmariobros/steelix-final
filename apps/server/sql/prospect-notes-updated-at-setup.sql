-- Prospect notes: track edit time so agents can edit/delete their own notes. Run once on your DB.
-- (The server also applies this automatically on startup; this is a fallback if auto-bootstrap fails.)

ALTER TABLE public.prospect_notes
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
