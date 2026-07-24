-- Ensure agent_edit_allowed exists on transactions (run once)

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS agent_edit_allowed boolean NOT NULL DEFAULT false;
