-- Agent Tier Enhancement Migration
-- This migration adds agent tier functionality to existing schema

-- Create agent_tier enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE agent_tier AS ENUM('advisor', 'sales_leader', 'team_leader', 'group_leader', 'supreme_leader');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add agent tier fields to user table if they don't exist
DO $$ BEGIN
    ALTER TABLE "user" ADD COLUMN "agent_tier" agent_tier DEFAULT 'advisor';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "user" ADD COLUMN "company_commission_split" integer DEFAULT 60;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "user" ADD COLUMN "tier_effective_date" timestamp DEFAULT now();
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "user" ADD COLUMN "tier_promoted_by" text;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Create agent_tier_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS "agent_tier_history" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "agent_id" text NOT NULL,
    "previous_tier" agent_tier,
    "new_tier" agent_tier NOT NULL,
    "effective_date" timestamp DEFAULT now() NOT NULL,
    "promoted_by" text,
    "reason" text,
    "performance_metrics" text,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create commission_audit_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS "commission_audit_log" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "transaction_id" uuid NOT NULL,
    "agent_id" text NOT NULL,
    "old_values" text,
    "new_values" text,
    "changed_by" text NOT NULL,
    "change_reason" text,
    "ip_address" text,
    "user_agent" text,
    "timestamp" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints if they don't exist
DO $$ BEGIN
    ALTER TABLE "agent_tier_history" ADD CONSTRAINT "agent_tier_history_agent_id_user_id_fk" 
    FOREIGN KEY ("agent_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "agent_tier_history" ADD CONSTRAINT "agent_tier_history_promoted_by_user_id_fk" 
    FOREIGN KEY ("promoted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "commission_audit_log" ADD CONSTRAINT "commission_audit_log_agent_id_user_id_fk" 
    FOREIGN KEY ("agent_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "commission_audit_log" ADD CONSTRAINT "commission_audit_log_changed_by_user_id_fk" 
    FOREIGN KEY ("changed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "user" ADD CONSTRAINT "user_tier_promoted_by_user_id_fk" 
    FOREIGN KEY ("tier_promoted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update existing users to have default agent tier if null
UPDATE "user" SET "agent_tier" = 'advisor' WHERE "agent_tier" IS NULL;
UPDATE "user" SET "company_commission_split" = 60 WHERE "company_commission_split" IS NULL;
UPDATE "user" SET "tier_effective_date" = now() WHERE "tier_effective_date" IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_agent_tier_history_agent_id" ON "agent_tier_history"("agent_id");
CREATE INDEX IF NOT EXISTS "idx_agent_tier_history_effective_date" ON "agent_tier_history"("effective_date");
CREATE INDEX IF NOT EXISTS "idx_commission_audit_log_agent_id" ON "commission_audit_log"("agent_id");
CREATE INDEX IF NOT EXISTS "idx_commission_audit_log_transaction_id" ON "commission_audit_log"("transaction_id");
CREATE INDEX IF NOT EXISTS "idx_commission_audit_log_timestamp" ON "commission_audit_log"("timestamp");
