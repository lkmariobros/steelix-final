-- Extended agent profile fields on public."user" (run once)

ALTER TABLE public."user"
  ADD COLUMN IF NOT EXISTS nick_name text;

ALTER TABLE public."user"
  ADD COLUMN IF NOT EXISTS nric text;

ALTER TABLE public."user"
  ADD COLUMN IF NOT EXISTS ren_number text;

ALTER TABLE public."user"
  ADD COLUMN IF NOT EXISTS registration_fee text;

ALTER TABLE public."user"
  ADD COLUMN IF NOT EXISTS payment_method text;

ALTER TABLE public."user"
  ADD COLUMN IF NOT EXISTS address text;

ALTER TABLE public."user"
  ADD COLUMN IF NOT EXISTS marital_status text;

ALTER TABLE public."user"
  ADD COLUMN IF NOT EXISTS emergency_name text;

ALTER TABLE public."user"
  ADD COLUMN IF NOT EXISTS emergency_contact_no text;

ALTER TABLE public."user"
  ADD COLUMN IF NOT EXISTS emergency_relationship text;

ALTER TABLE public."user"
  ADD COLUMN IF NOT EXISTS bank_account_name text;

ALTER TABLE public."user"
  ADD COLUMN IF NOT EXISTS income_tax_no text;

ALTER TABLE public."user"
  ADD COLUMN IF NOT EXISTS onboarding_documents jsonb;

CREATE INDEX IF NOT EXISTS idx_user_nric
  ON public."user" (nric)
  WHERE nric IS NOT NULL;
