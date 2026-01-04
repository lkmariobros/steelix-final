-- Migration: Leadership Bonus System
-- Description: Adds support for New Leadership Plan commission structure with Leadership Bonus

-- Add recruited_by field to user table for upline tracking
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "recruited_by" TEXT;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "recruited_at" TIMESTAMP;

-- Create index for recruited_by lookups
CREATE INDEX IF NOT EXISTS "idx_user_recruited_by" ON "user" ("recruited_by");
CREATE INDEX IF NOT EXISTS "idx_user_agent_tier" ON "user" ("agent_tier");

-- Create tier_commission_config table for configurable tier settings
CREATE TABLE IF NOT EXISTS "tier_commission_config" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tier" agent_tier NOT NULL UNIQUE,
  "commission_split" INTEGER NOT NULL,
  "leadership_bonus_rate" INTEGER NOT NULL DEFAULT 0,
  "requirements" JSONB NOT NULL,
  "display_name" TEXT NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "effective_from" TIMESTAMP NOT NULL DEFAULT NOW(),
  "effective_to" TIMESTAMP,
  "created_by" TEXT REFERENCES "user"("id"),
  "updated_by" TEXT REFERENCES "user"("id"),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_tier_commission_config_tier" ON "tier_commission_config" ("tier");
CREATE INDEX IF NOT EXISTS "idx_tier_commission_config_is_active" ON "tier_commission_config" ("is_active");

-- Create leadership_bonus_payments table for tracking bonus payments
CREATE TABLE IF NOT EXISTS "leadership_bonus_payments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "transaction_id" UUID NOT NULL,
  "downline_agent_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "upline_agent_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "upline_tier" agent_tier NOT NULL,
  "original_commission_amount" DECIMAL(15, 2) NOT NULL,
  "company_share_amount" DECIMAL(15, 2) NOT NULL,
  "leadership_bonus_rate" INTEGER NOT NULL,
  "leadership_bonus_amount" DECIMAL(15, 2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "paid_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_leadership_bonus_transaction_id" ON "leadership_bonus_payments" ("transaction_id");
CREATE INDEX IF NOT EXISTS "idx_leadership_bonus_downline_agent_id" ON "leadership_bonus_payments" ("downline_agent_id");
CREATE INDEX IF NOT EXISTS "idx_leadership_bonus_upline_agent_id" ON "leadership_bonus_payments" ("upline_agent_id");
CREATE INDEX IF NOT EXISTS "idx_leadership_bonus_status" ON "leadership_bonus_payments" ("status");

-- Create tier_config_change_log for audit trail
CREATE TABLE IF NOT EXISTS "tier_config_change_log" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "config_id" UUID REFERENCES "tier_commission_config"("id"),
  "tier" agent_tier NOT NULL,
  "change_type" TEXT NOT NULL,
  "old_values" JSONB,
  "new_values" JSONB,
  "changed_by" TEXT NOT NULL REFERENCES "user"("id"),
  "change_reason" TEXT,
  "timestamp" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_tier_config_change_log_config_id" ON "tier_config_change_log" ("config_id");
CREATE INDEX IF NOT EXISTS "idx_tier_config_change_log_tier" ON "tier_config_change_log" ("tier");
CREATE INDEX IF NOT EXISTS "idx_tier_config_change_log_timestamp" ON "tier_config_change_log" ("timestamp");

-- Insert default tier configurations based on New Leadership Plan
INSERT INTO "tier_commission_config" ("tier", "commission_split", "leadership_bonus_rate", "requirements", "display_name", "description")
VALUES 
  ('advisor', 70, 0, '{"monthlySales": 0, "teamMembers": 0}', 'Advisor', 'Entry level agent'),
  ('sales_leader', 80, 7, '{"monthlySales": 2, "teamMembers": 0}', 'Sales Leader', '2+ monthly sales'),
  ('team_leader', 83, 5, '{"monthlySales": 3, "teamMembers": 3}', 'Team Leader', '3+ sales, 3+ team members'),
  ('group_leader', 85, 8, '{"monthlySales": 5, "teamMembers": 5}', 'Group Leader', '5+ sales, 5+ team members'),
  ('supreme_leader', 85, 6, '{"monthlySales": 8, "teamMembers": 10}', 'Supreme Leader', '8+ sales, 10+ team members')
ON CONFLICT ("tier") DO UPDATE SET
  "commission_split" = EXCLUDED."commission_split",
  "leadership_bonus_rate" = EXCLUDED."leadership_bonus_rate",
  "requirements" = EXCLUDED."requirements",
  "display_name" = EXCLUDED."display_name",
  "description" = EXCLUDED."description",
  "updated_at" = NOW();

-- Update existing users to have the new commission split based on their tier
UPDATE "user" SET "company_commission_split" = 70 WHERE "agent_tier" = 'advisor' AND "company_commission_split" != 70;
UPDATE "user" SET "company_commission_split" = 80 WHERE "agent_tier" = 'sales_leader' AND "company_commission_split" != 80;
UPDATE "user" SET "company_commission_split" = 83 WHERE "agent_tier" = 'team_leader' AND "company_commission_split" != 83;
UPDATE "user" SET "company_commission_split" = 85 WHERE "agent_tier" = 'group_leader' AND "company_commission_split" != 85;
UPDATE "user" SET "company_commission_split" = 85 WHERE "agent_tier" = 'supreme_leader' AND "company_commission_split" != 85;

