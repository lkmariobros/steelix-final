-- Agent edit-request fields on transactions (run once on your DB)

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS pending_edit_request boolean NOT NULL DEFAULT false;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS request_item text;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS request_submitted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_transactions_pending_edit_request
  ON public.transactions (pending_edit_request)
  WHERE pending_edit_request = true;
