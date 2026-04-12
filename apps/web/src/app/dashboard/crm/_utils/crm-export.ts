import { stageMap } from "@/app/admin/leads/_components/lead-constants";

export type CrmExportProspect = {
	id: string;
	name: string;
	email: string;
	phone: string;
	source: string;
	type: "tenant" | "buyer";
	property: string;
	projectName?: string | null;
	status: "active" | "inactive" | "pending";
	stage: string;
	leadType: "personal" | "company";
	tags: string | null;
	tagNames?: string[];
	lastContact: Date | string | null;
	nextContact: Date | string | null;
	agentName?: string | null;
	agentEmail?: string | null;
	createdAt: Date | string;
	updatedAt: Date | string;
};

function formatDateForExport(value: Date | string | null | undefined): string {
	if (!value) return "";
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return "";
	return d.toISOString().slice(0, 10);
}

function capitalizeForExport(value: string | null | undefined): string {
	if (!value) return "";
	return value.charAt(0).toUpperCase() + value.slice(1);
}

export function prospectsToExportRows(
	prospects: CrmExportProspect[],
): Record<string, string>[] {
	return prospects.map((p) => ({
		Name: p.name ?? "",
		Email: p.email ?? "",
		Phone: p.phone ?? "",
		Property: p.property ?? "",
		Project: p.projectName ?? "",
		Stage: stageMap[p.stage]?.label ?? p.stage ?? "",
		Status: capitalizeForExport(p.status),
		Agent: p.agentName ?? "Unassigned",
		"Agent Email": p.agentEmail ?? "",
		Type: capitalizeForExport(p.type),
		"Lead Type": capitalizeForExport(p.leadType),
		Source: p.source ?? "",
		Tags:
			(p.tagNames?.length ? p.tagNames.join("; ") : p.tags) ?? "",
		"Last Contact": formatDateForExport(p.lastContact),
		"Next Contact": formatDateForExport(p.nextContact),
		"Created At": formatDateForExport(p.createdAt),
		"Updated At": formatDateForExport(p.updatedAt),
	}));
}

export function exportProspectsToCsv(
	data: Record<string, string>[],
	filenameBase: string,
) {
	if (!data || data.length === 0) return;

	const headers = Object.keys(data[0] as Record<string, unknown>);
	const csvContent = [
		headers.join(","),
		...data.map((row) =>
			headers
				.map((header) => {
					const value = (row as Record<string, unknown>)[header];
					if (value === null || value === undefined) return "";
					const str = String(value);
					if (
						str.includes(",") ||
						str.includes('"') ||
						str.includes("\n") ||
						str.includes("\r")
					) {
						return `"${str.replace(/"/g, '""')}"`;
					}
					return str;
				})
				.join(","),
		),
	].join("\n");

	const blob = new Blob([csvContent], {
		type: "text/csv;charset=utf-8;",
	});
	const link = document.createElement("a");
	link.href = URL.createObjectURL(blob);
	link.download = `${filenameBase}_${new Date().toISOString().split("T")[0]}.csv`;
	link.click();
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export function exportProspectsToExcelHtml(
	data: Record<string, string>[],
	filenameBase: string,
) {
	if (!data || data.length === 0) return;

	const headers = Object.keys(data[0] as Record<string, unknown>);
	const thead = `<tr>${headers
		.map((h) => `<th>${escapeHtml(String(h))}</th>`)
		.join("")}</tr>`;

	const tbody = data
		.map((row) => {
			return `<tr>${headers
				.map((h) => {
					const value = (row as Record<string, unknown>)[h];
					return `<td>${escapeHtml(value === undefined || value === null ? "" : String(value))}</td>`;
				})
				.join("")}</tr>`;
		})
		.join("");

	const html = `<!DOCTYPE html>
<html>
	<head>
		<meta charset="utf-8" />
	</head>
	<body>
		<table>
			<thead>${thead}</thead>
			<tbody>${tbody}</tbody>
		</table>
	</body>
</html>`;

	const blob = new Blob([html], {
		type: "application/vnd.ms-excel;charset=utf-8;",
	});
	const link = document.createElement("a");
	link.href = URL.createObjectURL(blob);
	link.download = `${filenameBase}_${new Date().toISOString().split("T")[0]}.xls`;
	link.click();
}
