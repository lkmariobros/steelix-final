import { pool } from "./db";

const PROSPECT_INDEX_STATEMENTS = [
	`CREATE INDEX IF NOT EXISTS idx_prospects_created_at ON prospects (created_at DESC)`,
	`CREATE INDEX IF NOT EXISTS idx_prospects_status_updated_at ON prospects (status, updated_at)`,
	`CREATE INDEX IF NOT EXISTS idx_prospects_stage_created_at ON prospects (stage, created_at DESC)`,
] as const;

const TRANSACTION_QUEUE_INDEX =
	`CREATE INDEX IF NOT EXISTS idx_transactions_status_submitted_at ON transactions (status, submitted_at DESC)`;

let ensurePromise: Promise<void> | null = null;

/** Idempotently create prospect + queue indexes used by admin first paint. */
export async function ensureLeadListIndexes(): Promise<void> {
	if (!ensurePromise) {
		ensurePromise = (async () => {
			for (const statement of [
				...PROSPECT_INDEX_STATEMENTS,
				TRANSACTION_QUEUE_INDEX,
			]) {
				try {
					await pool.query(statement);
				} catch (e) {
					const msg = e instanceof Error ? e.message : String(e);
					console.warn(`⚠️ Could not ensure lead/queue index: ${msg}`);
				}
			}
		})().catch((e) => {
			ensurePromise = null;
			throw e;
		});
	}
	return ensurePromise;
}
