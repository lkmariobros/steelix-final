CREATE TYPE "public"."trigger_type" AS ENUM('contains', 'equals', 'starts_with', 'regex');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('tenant', 'owner');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('meeting', 'training', 'announcement', 'holiday', 'deadline', 'other');--> statement-breakpoint
CREATE TYPE "public"."priority_level" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."lead_type" AS ENUM('personal', 'company');--> statement-breakpoint
CREATE TYPE "public"."pipeline_stage" AS ENUM('prospect', 'outreach', 'discovery', 'proposal', 'negotiation', 'closed_won', 'closed_lost');--> statement-breakpoint
CREATE TYPE "public"."prospect_status" AS ENUM('active', 'inactive', 'pending');--> statement-breakpoint
CREATE TYPE "public"."prospect_type" AS ENUM('tenant', 'buyer');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('sent', 'delivered', 'read', 'failed', 'pending');--> statement-breakpoint
CREATE TABLE "leadership_bonus_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"downline_agent_id" text NOT NULL,
	"upline_agent_id" text NOT NULL,
	"upline_tier" "agent_tier" NOT NULL,
	"original_commission_amount" numeric(15, 2) NOT NULL,
	"company_share_amount" numeric(15, 2) NOT NULL,
	"leadership_bonus_rate" integer NOT NULL,
	"leadership_bonus_amount" numeric(15, 2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tier_commission_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tier" "agent_tier" NOT NULL,
	"commission_split" integer NOT NULL,
	"leadership_bonus_rate" integer DEFAULT 0 NOT NULL,
	"requirements" jsonb NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_from" timestamp DEFAULT now() NOT NULL,
	"effective_to" timestamp,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tier_commission_config_tier_unique" UNIQUE("tier")
);
--> statement-breakpoint
CREATE TABLE "tier_config_change_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_id" uuid,
	"tier" "agent_tier" NOT NULL,
	"change_type" text NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"changed_by" text NOT NULL,
	"change_reason" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auto_reply_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"conversation_id" text,
	"message_id" text,
	"triggered_at" timestamp DEFAULT now() NOT NULL,
	"executed_at" timestamp,
	"matched_keyword" text,
	"original_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auto_reply_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger" jsonb NOT NULL,
	"response" text NOT NULL,
	"message_owner" text NOT NULL,
	"status" "user_status" NOT NULL,
	"log_count" integer DEFAULT 0 NOT NULL,
	"agent_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"priority" "priority_level" DEFAULT 'normal',
	"created_by" text NOT NULL,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"event_type" "event_type" DEFAULT 'meeting' NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"location" text,
	"priority" "priority_level" DEFAULT 'normal',
	"is_all_day" boolean DEFAULT false NOT NULL,
	"created_by" text NOT NULL,
	"assigned_to_agent_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "crm_tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "prospect_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"content" text NOT NULL,
	"agent_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prospect_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"source" text NOT NULL,
	"type" "prospect_type" NOT NULL,
	"property" text NOT NULL,
	"status" "prospect_status" NOT NULL,
	"stage" "pipeline_stage" DEFAULT 'prospect' NOT NULL,
	"lead_type" "lead_type" DEFAULT 'personal' NOT NULL,
	"tags" text,
	"last_contact" timestamp,
	"next_contact" timestamp,
	"agent_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kapso_contact_id" text NOT NULL,
	"contact_name" text,
	"contact_phone" text NOT NULL,
	"assigned_agent_id" text,
	"prospect_id" uuid,
	"last_message" text,
	"last_message_at" timestamp,
	"unread_count" text DEFAULT '0' NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_conversations_kapso_contact_id_unique" UNIQUE("kapso_contact_id")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kapso_message_id" text,
	"conversation_id" uuid NOT NULL,
	"content" text NOT NULL,
	"direction" "message_direction" NOT NULL,
	"status" "message_status" DEFAULT 'pending' NOT NULL,
	"agent_id" text,
	"is_auto_reply" boolean DEFAULT false NOT NULL,
	"auto_reply_rule_id" uuid,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_messages_kapso_message_id_unique" UNIQUE("kapso_message_id")
);
--> statement-breakpoint
ALTER TABLE "agent_goals" ALTER COLUMN "target_value" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "agent_goals" ALTER COLUMN "current_value" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "agent_goals" ALTER COLUMN "current_value" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "company_commission_split" SET DEFAULT 70;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "recruited_by" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "recruited_at" timestamp;--> statement-breakpoint
ALTER TABLE "leadership_bonus_payments" ADD CONSTRAINT "leadership_bonus_payments_downline_agent_id_user_id_fk" FOREIGN KEY ("downline_agent_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leadership_bonus_payments" ADD CONSTRAINT "leadership_bonus_payments_upline_agent_id_user_id_fk" FOREIGN KEY ("upline_agent_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tier_commission_config" ADD CONSTRAINT "tier_commission_config_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tier_commission_config" ADD CONSTRAINT "tier_commission_config_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tier_config_change_log" ADD CONSTRAINT "tier_config_change_log_config_id_tier_commission_config_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."tier_commission_config"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tier_config_change_log" ADD CONSTRAINT "tier_config_change_log_changed_by_user_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_reply_logs" ADD CONSTRAINT "auto_reply_logs_rule_id_auto_reply_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."auto_reply_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_reply_rules" ADD CONSTRAINT "auto_reply_rules_agent_id_user_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_assigned_to_agent_id_user_id_fk" FOREIGN KEY ("assigned_to_agent_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tags" ADD CONSTRAINT "crm_tags_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_notes" ADD CONSTRAINT "prospect_notes_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_notes" ADD CONSTRAINT "prospect_notes_agent_id_user_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_tags" ADD CONSTRAINT "prospect_tags_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_tags" ADD CONSTRAINT "prospect_tags_tag_id_crm_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."crm_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_agent_id_user_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_assigned_agent_id_user_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_conversation_id_whatsapp_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."whatsapp_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_agent_id_user_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_leadership_bonus_transaction_id" ON "leadership_bonus_payments" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_leadership_bonus_downline_agent_id" ON "leadership_bonus_payments" USING btree ("downline_agent_id");--> statement-breakpoint
CREATE INDEX "idx_leadership_bonus_upline_agent_id" ON "leadership_bonus_payments" USING btree ("upline_agent_id");--> statement-breakpoint
CREATE INDEX "idx_leadership_bonus_status" ON "leadership_bonus_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_tier_commission_config_tier" ON "tier_commission_config" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "idx_tier_commission_config_is_active" ON "tier_commission_config" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_tier_config_change_log_config_id" ON "tier_config_change_log" USING btree ("config_id");--> statement-breakpoint
CREATE INDEX "idx_tier_config_change_log_tier" ON "tier_config_change_log" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "idx_tier_config_change_log_timestamp" ON "tier_config_change_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_auto_reply_logs_rule_id" ON "auto_reply_logs" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "idx_auto_reply_logs_triggered_at" ON "auto_reply_logs" USING btree ("triggered_at");--> statement-breakpoint
CREATE INDEX "idx_auto_reply_rules_agent_id" ON "auto_reply_rules" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_auto_reply_rules_status" ON "auto_reply_rules" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_auto_reply_rules_message_owner" ON "auto_reply_rules" USING btree ("message_owner");--> statement-breakpoint
CREATE INDEX "idx_announcements_created_by" ON "announcements" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_announcements_is_active" ON "announcements" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_announcements_is_pinned" ON "announcements" USING btree ("is_pinned");--> statement-breakpoint
CREATE INDEX "idx_announcements_expires_at" ON "announcements" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_calendar_events_start_date" ON "calendar_events" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "idx_calendar_events_created_by" ON "calendar_events" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_calendar_events_assigned_to" ON "calendar_events" USING btree ("assigned_to_agent_id");--> statement-breakpoint
CREATE INDEX "idx_calendar_events_is_active" ON "calendar_events" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_crm_tags_name" ON "crm_tags" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_crm_tags_created_by" ON "crm_tags" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_prospect_notes_prospect_id" ON "prospect_notes" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "idx_prospect_notes_agent_id" ON "prospect_notes" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_prospect_notes_created_at" ON "prospect_notes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_prospect_tags_prospect_id" ON "prospect_tags" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "idx_prospect_tags_tag_id" ON "prospect_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "idx_prospect_tags_unique" ON "prospect_tags" USING btree ("prospect_id","tag_id");--> statement-breakpoint
CREATE INDEX "idx_prospects_agent_id" ON "prospects" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_prospects_email" ON "prospects" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_prospects_status" ON "prospects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_prospects_stage" ON "prospects" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "idx_prospects_type" ON "prospects" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_prospects_property" ON "prospects" USING btree ("property");--> statement-breakpoint
CREATE INDEX "idx_prospects_lead_type" ON "prospects" USING btree ("lead_type");--> statement-breakpoint
CREATE INDEX "idx_whatsapp_conv_kapso_contact_id" ON "whatsapp_conversations" USING btree ("kapso_contact_id");--> statement-breakpoint
CREATE INDEX "idx_whatsapp_conv_contact_phone" ON "whatsapp_conversations" USING btree ("contact_phone");--> statement-breakpoint
CREATE INDEX "idx_whatsapp_conv_assigned_agent_id" ON "whatsapp_conversations" USING btree ("assigned_agent_id");--> statement-breakpoint
CREATE INDEX "idx_whatsapp_conv_prospect_id" ON "whatsapp_conversations" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "idx_whatsapp_messages_conversation_id" ON "whatsapp_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_whatsapp_messages_kapso_message_id" ON "whatsapp_messages" USING btree ("kapso_message_id");--> statement-breakpoint
CREATE INDEX "idx_whatsapp_messages_sent_at" ON "whatsapp_messages" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "idx_user_recruited_by" ON "user" USING btree ("recruited_by");--> statement-breakpoint
CREATE INDEX "idx_user_agent_tier" ON "user" USING btree ("agent_tier");