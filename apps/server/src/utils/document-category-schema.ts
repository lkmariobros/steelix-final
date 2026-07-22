import { pool } from "./db";

/** Secondary-market document categories for sales entry uploads. */
const DOCUMENT_CATEGORY_VALUES = [
	"booking_form",
	"receipt",
	"co_broke_letter",
	"tenancy_agreement",
	"spa",
] as const;

export const DOCUMENT_CATEGORY_SQL_PATCH = `
-- Secondary market document categories
${DOCUMENT_CATEGORY_VALUES.map(
	(v) => `ALTER TYPE document_category ADD VALUE IF NOT EXISTS '${v}';`,
).join("\n")}
`.trim();

let ensurePromise: Promise<void> | null = null;

/** Idempotently add new document_category enum values. */
export async function ensureDocumentCategoryEnumValues(): Promise<void> {
	if (!ensurePromise) {
		ensurePromise = (async () => {
			for (const value of DOCUMENT_CATEGORY_VALUES) {
				try {
					await pool.query(
						`ALTER TYPE document_category ADD VALUE IF NOT EXISTS '${value}'`,
					);
				} catch (e) {
					const msg = e instanceof Error ? e.message : String(e);
					if (/duplicate|already exists/i.test(msg)) continue;
					try {
						await pool.query(
							`ALTER TYPE document_category ADD VALUE '${value}'`,
						);
					} catch (inner) {
						const innerMsg =
							inner instanceof Error ? inner.message : String(inner);
						if (!/duplicate|already exists/i.test(innerMsg)) {
							console.warn(
								`⚠️ Could not add document_category value "${value}":`,
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
