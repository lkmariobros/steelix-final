import { pool } from "./db";

const TRANSACTION_INDEX_STATEMENTS = [
	`CREATE INDEX IF NOT EXISTS idx_transactions_agent_id ON transactions (agent_id)`,
	`CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions (status)`,
	`CREATE INDEX IF NOT EXISTS idx_transactions_case_no ON transactions (case_no)`,
	`CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions (created_at)`,
	`CREATE INDEX IF NOT EXISTS idx_transactions_booking_date ON transactions (booking_date)`,
	`CREATE INDEX IF NOT EXISTS idx_transactions_submitted_at ON transactions (submitted_at)`,
	`CREATE INDEX IF NOT EXISTS idx_transactions_market_type ON transactions (market_type)`,
	`CREATE INDEX IF NOT EXISTS idx_transactions_transaction_type ON transactions (transaction_type)`,
	`CREATE INDEX IF NOT EXISTS idx_transactions_agent_status ON transactions (agent_id, status)`,
	`CREATE INDEX IF NOT EXISTS idx_transactions_pending_edit ON transactions (pending_edit_request)`,
] as const;

let ensurePromise: Promise<void> | null = null;

/** Idempotently create list/filter indexes on transactions. */
export async function ensureTransactionListIndexes(): Promise<void> {
	if (!ensurePromise) {
		ensurePromise = (async () => {
			for (const statement of TRANSACTION_INDEX_STATEMENTS) {
				try {
					await pool.query(statement);
				} catch (e) {
					const msg = e instanceof Error ? e.message : String(e);
					console.warn(`⚠️ Could not ensure transaction index: ${msg}`);
				}
			}
		})().catch((e) => {
			ensurePromise = null;
			throw e;
		});
	}
	return ensurePromise;
}
