import { gte, lt } from "drizzle-orm";
import { portalRecordLog } from "../models/portal-record-log";
import { db, pool } from "../utils/db";

export const RECORD_LOG_RETENTION_DAYS = 365;

export type RecordLogCategory = "configuration" | "transaction";

export type RecordLogAction =
	| "tier_config_create"
	| "tier_config_update"
	| "create"
	| "save_draft"
	| "update"
	| "upload_document"
	| "submit";

export type WriteRecordLogInput = {
	category: RecordLogCategory;
	action: RecordLogAction;
	summary: string;
	actorId: string;
	actorRole?: string | null;
	entityType?: string | null;
	entityId?: string | null;
	caseNo?: string | null;
	detail?: string | null;
	metadata?: Record<string, unknown> | null;
};

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS public.portal_record_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  action text NOT NULL,
  summary text NOT NULL,
  actor_id text NOT NULL REFERENCES public."user"(id),
  actor_role text,
  entity_type text,
  entity_id text,
  case_no text,
  detail text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portal_record_log_category ON public.portal_record_log (category);
CREATE INDEX IF NOT EXISTS idx_portal_record_log_action ON public.portal_record_log (action);
CREATE INDEX IF NOT EXISTS idx_portal_record_log_actor ON public.portal_record_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_portal_record_log_entity ON public.portal_record_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_portal_record_log_created_at ON public.portal_record_log (created_at);
`.trim();

let ensurePromise: Promise<void> | null = null;

/** Idempotently create portal_record_log table + indexes. */
export async function ensurePortalRecordLogTable(): Promise<void> {
	if (!ensurePromise) {
		ensurePromise = (async () => {
			await pool.query(CREATE_TABLE_SQL);
		})().catch((e) => {
			ensurePromise = null;
			throw e;
		});
	}
	return ensurePromise;
}

/** Record a portal audit event. Failures are logged but never fail the main action. */
export async function writeRecordLog(
	input: WriteRecordLogInput,
): Promise<void> {
	try {
		await ensurePortalRecordLogTable();
		await db.insert(portalRecordLog).values({
			category: input.category,
			action: input.action,
			summary: input.summary,
			actorId: input.actorId,
			actorRole: input.actorRole ?? null,
			entityType: input.entityType ?? null,
			entityId: input.entityId ?? null,
			caseNo: input.caseNo ?? null,
			detail: input.detail ?? null,
			metadata: input.metadata ?? null,
		});
	} catch (e) {
		console.warn(
			"[record-log] failed to write entry:",
			e instanceof Error ? e.message : e,
		);
	}
}

export function recordLogRetentionCutoff(now = new Date()): Date {
	const cutoff = new Date(now);
	cutoff.setUTCDate(cutoff.getUTCDate() - RECORD_LOG_RETENTION_DAYS);
	return cutoff;
}

/**
 * Delete record-log rows older than 365 days.
 * Also purges legacy tier_config_change_log by the same policy.
 */
export async function purgeExpiredRecordLogs(): Promise<{
	portalDeleted: number;
	tierConfigDeleted: number;
}> {
	await ensurePortalRecordLogTable();
	const cutoff = recordLogRetentionCutoff();

	const deletedPortal = await db
		.delete(portalRecordLog)
		.where(lt(portalRecordLog.createdAt, cutoff))
		.returning({ id: portalRecordLog.id });

	let tierConfigDeleted = 0;
	try {
		const result = await pool.query(
			`DELETE FROM public.tier_config_change_log WHERE timestamp < $1`,
			[cutoff],
		);
		tierConfigDeleted = result.rowCount ?? 0;
	} catch (e) {
		console.warn(
			"[record-log] tier_config_change_log purge skipped:",
			e instanceof Error ? e.message : e,
		);
	}

	return {
		portalDeleted: deletedPortal.length,
		tierConfigDeleted,
	};
}

/** Drizzle condition: only rows within the 365-day retention window. */
export function withinRecordLogRetention() {
	return gte(portalRecordLog.createdAt, recordLogRetentionCutoff());
}
