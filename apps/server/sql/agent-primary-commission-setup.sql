-- Per-agent primary market commission entitlement % (run once)

ALTER TABLE public."user"
  ADD COLUMN IF NOT EXISTS primary_commission_split integer DEFAULT 100;
