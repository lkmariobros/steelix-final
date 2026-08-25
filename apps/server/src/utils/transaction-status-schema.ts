import { pool } from "./db";

/** New transaction_status enum values to ensure at runtime. */
const TRANSACTION_STATUS_VALUES_TO_ENSURE = ["void", "revoke", "converted"] as const;

export const TRANSACTION_STATUS_SQL_PATCH = `
-- Transaction status enum values
${TRANSACTION_STATUS_VALUES_TO_ENSURE.map(
	(v) => `ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS '${v}';`,
).join("\n")}
`.trim();

let ensurePromise: Promise<void> | null = null;

/** Idempotently add new transaction_status enum values (e.g. void). */
export async function ensureTransactionStatusEnumValues(): Promise<void> {
	if (!ensurePromise) {
		ensurePromise = (async () => {
			for (const value of TRANSACTION_STATUS_VALUES_TO_ENSURE) {
				try {
					await pool.query(
						`ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS '${value}'`,
					);
				} catch (e) {
					const msg = e instanceof Error ? e.message : String(e);
					if (/duplicate|already exists/i.test(msg)) continue;
					try {
						await pool.query(
							`ALTER TYPE transaction_status ADD VALUE '${value}'`,
						);
					} catch (inner) {
						const innerMsg =
							inner instanceof Error ? inner.message : String(inner);
						if (!/duplicate|already exists/i.test(innerMsg)) {
							console.warn(
								`⚠️ Could not add transaction_status value "${value}":`,
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
