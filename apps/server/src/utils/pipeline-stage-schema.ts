import { pool } from "./db";

/** New pipeline_stage enum values introduced in lead-section feedback. */
const PIPELINE_STAGE_VALUES = [
	"first_follow_up",
	"second_follow_up",
	"third_follow_up",
	"fourth_follow_up",
	"need_consider",
] as const;

export const PIPELINE_STAGE_SQL_PATCH = `
-- Lead pipeline stages (run in Supabase SQL Editor if auto-bootstrap fails)
${PIPELINE_STAGE_VALUES.map(
	(v) => `ALTER TYPE pipeline_stage ADD VALUE IF NOT EXISTS '${v}';`,
).join("\n")}
`.trim();

let ensurePromise: Promise<void> | null = null;

export function isPipelineStageSchemaOutdatedError(err: unknown): boolean {
	const msg = err instanceof Error ? err.message : String(err);
	return (
		/invalid input value for enum pipeline_stage/i.test(msg) ||
		/enum pipeline_stage/i.test(msg)
	);
}

export function pipelineStageSchemaOutdatedMessage(): string {
	return [
		"Database is missing new lead pipeline stage values (first_follow_up, etc.).",
		"Run this SQL in your database:",
		"",
		PIPELINE_STAGE_SQL_PATCH,
	].join("\n");
}

/** Idempotently add new pipeline_stage enum values (safe on every startup). */
export async function ensurePipelineStageEnumValues(): Promise<void> {
	if (!ensurePromise) {
		ensurePromise = (async () => {
			for (const value of PIPELINE_STAGE_VALUES) {
				try {
					await pool.query(
						`ALTER TYPE pipeline_stage ADD VALUE IF NOT EXISTS '${value}'`,
					);
				} catch (e) {
					const msg = e instanceof Error ? e.message : String(e);
					if (/duplicate|already exists/i.test(msg)) continue;
					// Older Postgres without IF NOT EXISTS — try plain ADD VALUE
					try {
						await pool.query(`ALTER TYPE pipeline_stage ADD VALUE '${value}'`);
					} catch (inner) {
						const innerMsg =
							inner instanceof Error ? inner.message : String(inner);
						if (!/duplicate|already exists/i.test(innerMsg)) {
							console.warn(
								`⚠️ Could not add pipeline_stage value "${value}":`,
								innerMsg,
							);
						}
					}
				}
			}
		})().catch((e) => {
			ensurePromise = null;
			throw e;
		});
	}
	return ensurePromise;
}

/** Run DB patch once, then retry the operation (stage update / import). */
export async function withPipelineStageSchemaRetry<T>(
	operation: () => Promise<T>,
): Promise<T> {
	try {
		return await operation();
	} catch (e) {
		if (!isPipelineStageSchemaOutdatedError(e)) throw e;
		await ensurePipelineStageEnumValues();
		try {
			return await operation();
		} catch (retryErr) {
			if (isPipelineStageSchemaOutdatedError(retryErr)) {
				throw new Error(pipelineStageSchemaOutdatedMessage());
			}
			throw retryErr;
		}
	}
}
