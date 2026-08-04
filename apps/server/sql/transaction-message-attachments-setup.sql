-- Attachments on transaction messages (agent edit requests / add document)
-- Run once in Supabase SQL Editor if uploads on Messages / Requests fail with missing column.

ALTER TABLE public.transaction_messages
  ADD COLUMN IF NOT EXISTS attachments jsonb;
