-- eRecruitment links + applications

DO $$ BEGIN
  CREATE TYPE erecruitment_application_status AS ENUM (
    'pending_review',
    'approved',
    'rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.erecruitment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  recruiter_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  recruiter_name text NOT NULL,
  invitee_name text,
  invitee_email text,
  is_used boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_erecruitment_links_token ON public.erecruitment_links(token);
CREATE INDEX IF NOT EXISTS idx_erecruitment_links_recruiter_id ON public.erecruitment_links(recruiter_id);

CREATE TABLE IF NOT EXISTS public.erecruitment_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.erecruitment_links(id) ON DELETE CASCADE,
  recruiter_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  recruiter_name text NOT NULL,
  status erecruitment_application_status NOT NULL DEFAULT 'pending_review',
  full_name text NOT NULL,
  nick_name text,
  nric text NOT NULL,
  email text NOT NULL,
  registration_fee text,
  payment_method text,
  address text,
  contact_no text,
  marital_status text,
  emergency_name text,
  emergency_contact_no text,
  emergency_relationship text,
  bank_name text,
  bank_account_no text,
  bank_account_name text,
  income_tax_no text,
  documents jsonb,
  accepted_company_policy boolean NOT NULL DEFAULT false,
  accepted_nda boolean NOT NULL DEFAULT false,
  reviewed_by text REFERENCES public."user"(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_user_id text REFERENCES public."user"(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_erecruitment_applications_status ON public.erecruitment_applications(status);
CREATE INDEX IF NOT EXISTS idx_erecruitment_applications_link_id ON public.erecruitment_applications(link_id);
CREATE INDEX IF NOT EXISTS idx_erecruitment_applications_recruiter_id ON public.erecruitment_applications(recruiter_id);
