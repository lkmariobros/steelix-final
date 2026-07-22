-- REN (Real Estate Negotiator) number on public."user" (run once)

ALTER TABLE public."user"
  ADD COLUMN IF NOT EXISTS ren_number text;
