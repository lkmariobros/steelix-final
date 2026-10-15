import { pool } from "./db";

/**
 * One person may hold several agent accounts (e.g. an old Agent ID re-created for
 * historical cases), so emails are no longer unique. Agent IDs become the unique
 * sign-in key instead.
 */
const DROP_EMAIL_UNIQUE_STATEMENTS = [
	`ALTER TABLE public."user" DROP CONSTRAINT IF EXISTS user_email_unique`,
	"DROP INDEX IF EXISTS public.user_email_unique",
] as const;

const SUPPORT_STATEMENTS = [
	`CREATE INDEX IF NOT EXISTS idx_user_email_lower ON public."user" (lower(email))`,
	`CREATE UNIQUE INDEX IF NOT EXISTS user_agent_code_unique ON public."user" (upper(agent_code)) WHERE agent_code IS NOT NULL AND agent_code <> ''`,
	`CREATE TABLE IF NOT EXISTS public.portal_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
)`,
] as const;

let ensurePromise: Promise<{ sharedEmailReady: boolean }> | null = null;

/** Idempotently allow shared emails, enforce unique Agent IDs, and create portal_settings. */
export async function ensureAgentAccountSchema(): Promise<{
	sharedEmailReady: boolean;
}> {
	if (!ensurePromise) {
		ensurePromise = (async () => {
			let sharedEmailReady = true;
			for (const statement of DROP_EMAIL_UNIQUE_STATEMENTS) {
				try {
					await pool.query(statement);
				} catch (e) {
					sharedEmailReady = false;
					const msg = e instanceof Error ? e.message : String(e);
					console.warn(`⚠️ Could not relax user email uniqueness: ${msg}`);
				}
			}
			for (const statement of SUPPORT_STATEMENTS) {
				try {
					await pool.query(statement);
				} catch (e) {
					const msg = e instanceof Error ? e.message : String(e);
					console.warn(`⚠️ Could not ensure agent account schema: ${msg}`);
				}
			}
			if (!sharedEmailReady) {
				ensurePromise = null;
			}
			return { sharedEmailReady };
		})().catch((e) => {
			ensurePromise = null;
			throw e;
		});
	}
	return ensurePromise;
}
