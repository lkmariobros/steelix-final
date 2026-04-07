/**
 * Minimal RFC-style CSV line parser (handles quoted commas and doubled quotes).
 */
export function parseCsvLine(line: string): string[] {
	const result: string[] = [];
	let cur = "";
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const c = line[i];
		if (c === '"') {
			if (inQuotes && line[i + 1] === '"') {
				cur += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
			}
		} else if (c === "," && !inQuotes) {
			result.push(cur.trim());
			cur = "";
		} else {
			cur += c;
		}
	}
	result.push(cur.trim());
	return result;
}

/**
 * First row = headers; following rows become objects keyed by header names.
 * Skips completely empty rows.
 */
export function parseCsvToRecords(text: string): Record<string, string>[] {
	const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
	if (lines.length === 0) return [];
	const headers = parseCsvLine(lines[0]).map((h) => h.trim());
	const out: Record<string, string>[] = [];
	for (let i = 1; i < lines.length; i++) {
		const cells = parseCsvLine(lines[i]);
		const row: Record<string, string> = {};
		for (let j = 0; j < headers.length; j++) {
			row[headers[j]] = cells[j] ?? "";
		}
		const hasAny = Object.values(row).some((v) => String(v).trim() !== "");
		if (hasAny) out.push(row);
	}
	return out;
}
