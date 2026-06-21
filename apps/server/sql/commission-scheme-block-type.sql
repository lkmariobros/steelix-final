ALTER TABLE public.commission_schemes
  ADD COLUMN IF NOT EXISTS block_type text;

CREATE INDEX IF NOT EXISTS idx_commission_schemes_block_type
  ON public.commission_schemes(block_type);
