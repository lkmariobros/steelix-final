/**
 * When the DB is behind Drizzle schema, Postgres returns undefined_column (42703).
 * Embed a copy-paste patch so operators can fix Supabase without hunting the chat history.
 */
export const TRANSACTIONS_TABLE_SQL_PATCH = `
-- Align public.transactions with apps/server/src/models/transactions.ts

-- transaction_status enum values (Prompt 05)
DO $$ BEGIN
  ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'pending';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'verified';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'commission_released';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'cancelled';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS case_no text;
CREATE UNIQUE INDEX IF NOT EXISTS transactions_case_no_key ON public.transactions (case_no) WHERE case_no IS NOT NULL;

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS team_leader_agent_id text REFERENCES public."user"(id);

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS booking_date timestamp;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS project_name text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS unit_no text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS block_listing_id uuid;

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS commission_scheme_snapshot jsonb;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS commission_breakdown jsonb;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS commission_override_agent_net numeric(12,2);

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS pending_edit_request boolean NOT NULL DEFAULT false;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS request_item text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS request_submitted_at timestamptz;
`.trim();

export function isTransactionsSchemaOutdatedError(err: unknown): boolean {
	const msg = err instanceof Error ? err.message : String(err);
	const code =
		err && typeof err === "object" && "code" in err
			? String((err as { code?: string }).code)
			: "";
	// Postgres undefined_column
	if (code === "42703") return true;
	return (
		msg.includes("42703") ||
		/column .*does not exist/i.test(msg) ||
		/undefined_column/i.test(msg)
	);
}

export function transactionsSchemaOutdatedMessage(): string {
	return [
		"Database schema is missing columns on public.transactions (case_no, team_leader_agent_id, booking_date, project_name, unit_no, block_listing_id, commission_* jsonb columns, etc.).",
		"Run this SQL in Supabase SQL Editor:",
		"",
		TRANSACTIONS_TABLE_SQL_PATCH,
	].join("\n");
}
