CREATE TYPE "public"."document_category" AS ENUM('contract', 'identification', 'financial', 'miscellaneous');--> statement-breakpoint
CREATE TABLE "transaction_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" bigint NOT NULL,
	"storage_path" text NOT NULL,
	"public_url" text,
	"document_category" "document_category" NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT "user_tier_promoted_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "transaction_documents" ADD CONSTRAINT "transaction_documents_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_transaction_documents_transaction_id" ON "transaction_documents" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_transaction_documents_user_id" ON "transaction_documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_transaction_documents_category" ON "transaction_documents" USING btree ("document_category");