import { pool } from "./db";

export const PROSPECT_NOTES_SQL_PATCH = `
-- Prospect notes: track edit time (run in Supabase SQL Editor if auto-bootstrap fails)
ALTER TABLE prospect_notes ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
`.trim();

let ensurePromise: Promise<void> | null = null;

export function isProspectNotesSchemaOutdatedError(err: unknown): boolean {
	const msg = err instanceof Error ? err.message : String(err);
	return /updated_at/i.test(msg) && /does not exist/i.test(msg);
}

export function prospectNotesSchemaOutdatedMessage(): string {
	return [
		"Database is missing the prospect_notes.updated_at column (needed to edit notes).",
		"Run this SQL in your database:",
		"",
		PROSPECT_NOTES_SQL_PATCH,
	].join("\n");
}

/** Idempotently add the updated_at column (safe on every startup). */
export async function ensureProspectNotesUpdatedAtColumn(): Promise<void> {
	if (!ensurePromise) {
		ensurePromise = pool
			.query(
				"ALTER TABLE prospect_notes ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()",
			)
			.then(() => undefined)
			.catch((e) => {
				ensurePromise = null;
				throw e;
			});
	}
	return ensurePromise;
}

/** Run DB patch once, then retry the operation (note update/edit). */
export async function withProspectNotesSchemaRetry<T>(
	operation: () => Promise<T>,
): Promise<T> {
	try {
		return await operation();
	} catch (e) {
		if (!isProspectNotesSchemaOutdatedError(e)) throw e;
		await ensureProspectNotesUpdatedAtColumn();
		try {
			return await operation();
		} catch (retryErr) {
			if (isProspectNotesSchemaOutdatedError(retryErr)) {
				throw new Error(prospectNotesSchemaOutdatedMessage());
			}
			throw retryErr;
		}
	}
}
