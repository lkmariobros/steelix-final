-- Finance: Commissions Approval / Payout enhancements (23–24 Nov 2026 feedback)
-- Safe to re-run.

-- Allow company-share tracking rows without a payee agent
ALTER TABLE commission_payouts
	ALTER COLUMN payee_agent_id DROP NOT NULL;

ALTER TABLE commission_payouts
	ADD COLUMN IF NOT EXISTS share_percent numeric(7, 4),
	ADD COLUMN IF NOT EXISTS share_label text,
	ADD COLUMN IF NOT EXISTS is_company_share boolean NOT NULL DEFAULT false,
	ADD COLUMN IF NOT EXISTS paid_amount numeric(14, 2) NOT NULL DEFAULT 0;

-- cancelled = rejected on Approval (distinct from voided/recall)
DO $$
BEGIN
	ALTER TYPE commission_payout_status ADD VALUE IF NOT EXISTS 'cancelled';
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

-- Multi agent payments against a payout row
CREATE TABLE IF NOT EXISTS commission_payout_payments (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	payout_id uuid NOT NULL REFERENCES commission_payouts(id) ON DELETE CASCADE,
	payment_date timestamptz NOT NULL,
	amount numeric(14, 2) NOT NULL,
	receipt_url text,
	note text,
	created_by text REFERENCES "user"(id),
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_payout_payments_payout
	ON commission_payout_payments(payout_id);

-- Leadership bonus: approved status + paid tracking for Payout page
ALTER TABLE leadership_bonus_payments
	ADD COLUMN IF NOT EXISTS paid_amount numeric(14, 2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS leadership_bonus_payment_items (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	leadership_bonus_payment_id uuid NOT NULL REFERENCES leadership_bonus_payments(id) ON DELETE CASCADE,
	payment_date timestamptz NOT NULL,
	amount numeric(14, 2) NOT NULL,
	receipt_url text,
	note text,
	created_by text REFERENCES "user"(id),
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lb_payment_items_parent
	ON leadership_bonus_payment_items(leadership_bonus_payment_id);
