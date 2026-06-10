import { eq, sql } from "drizzle-orm";
import { crmTags } from "../models/crm";
import { db } from "../utils/db";

const IMPORT_MAX_ROWS = 500;

function pickTagNameFromRow(row: Record<string, string>): string {
	const lowerMap = new Map<string, string>();
	for (const [k, v] of Object.entries(row)) {
		lowerMap.set(k.toLowerCase().trim(), String(v ?? "").trim());
	}
	for (const alias of ["tags", "tag", "tag name", "tagname", "name"]) {
		const val = lowerMap.get(alias);
		if (val) return val;
	}
	for (const v of Object.values(row)) {
		const t = String(v ?? "").trim();
		if (t) return t;
	}
	return "";
}

export type TagImportLineResult = {
	lineNo: number;
	name: string;
	kind: "created" | "skipped" | "error";
	message?: string;
};

export type TagImportSummary = {
	total: number;
	created: number;
	skipped: number;
	error: number;
	lines: TagImportLineResult[];
};

/**
 * Bulk import CRM tags from parsed CSV rows.
 * One tag name per row. Duplicates (in file or DB, case-insensitive) are skipped.
 */
export async function importTagsBulkAdmin(
	rows: Record<string, string>[],
	actorId: string,
): Promise<TagImportSummary> {
	if (rows.length > IMPORT_MAX_ROWS) {
		throw new Error(`Import is limited to ${IMPORT_MAX_ROWS} tags per batch.`);
	}

	const lines: TagImportLineResult[] = [];
	let created = 0;
	let skipped = 0;
	let error = 0;
	const seenInFile = new Set<string>();

	for (let i = 0; i < rows.length; i++) {
		const rowNum = i + 1;
		const name = pickTagNameFromRow(rows[i]);

		if (!name) {
			error++;
			lines.push({
				lineNo: rowNum,
				name: "(empty)",
				kind: "error",
				message: "Missing tag name.",
			});
			continue;
		}

		const norm = name.toLowerCase();
		if (seenInFile.has(norm)) {
			skipped++;
			lines.push({
				lineNo: rowNum,
				name,
				kind: "skipped",
				message: "Duplicate tag name in this file.",
			});
			continue;
		}
		seenInFile.add(norm);

		const [existing] = await db
			.select({ id: crmTags.id })
			.from(crmTags)
			.where(sql`lower(trim(${crmTags.name})) = ${norm}`)
			.limit(1);

		if (existing) {
			skipped++;
			lines.push({
				lineNo: rowNum,
				name,
				kind: "skipped",
				message: "Tag already exists.",
			});
			continue;
		}

		try {
			await db.insert(crmTags).values({ name, createdBy: actorId });
			created++;
			lines.push({ lineNo: rowNum, name, kind: "created" });
		} catch (e) {
			error++;
			lines.push({
				lineNo: rowNum,
				name,
				kind: "error",
				message: e instanceof Error ? e.message : "Failed to create tag",
			});
		}
	}

	return {
		total: rows.length,
		created,
		skipped,
		error,
		lines,
	};
}
