"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	RiCheckLine,
	RiCloseLine,
	RiDownloadLine,
	RiFileUploadLine,
	RiLoader4Line,
	RiErrorWarningLine,
} from "@remixicon/react";
import { parseCsvToRecords } from "@/app/admin/leads/_utils/parse-csv";

type LeadFieldKey =
	| "name"
	| "phone"
	| "email"
	| "source"
	| "notes"
	| "categories"
	| "stage"
	| "status"
	| "type"
	| "property"
	| "project"
	| "lastContact"
	| "nextContact"
	| "follower"
	| "skip";

const FIELD_OPTIONS: Array<{ key: LeadFieldKey; label: string }> = [
	{ key: "name", label: "Name" },
	{ key: "phone", label: "Phone" },
	{ key: "email", label: "Email" },
	{ key: "source", label: "Source" },
	{ key: "notes", label: "Notes" },
	{ key: "categories", label: "Categories" },
	{ key: "stage", label: "Lead Stage" },
	{ key: "status", label: "Status" },
	{ key: "type", label: "Type" },
	{ key: "property", label: "Property" },
	{ key: "project", label: "Project" },
	{ key: "lastContact", label: "Last Contact" },
	{ key: "nextContact", label: "Next Contact" },
	{ key: "follower", label: "Follower" },
	{ key: "skip", label: "Skip column" },
];

function displayCsvColumnName(header: string): string {
	const n = header.trim().toLowerCase();
	if (n === "tags" || n === "tag") return "Categories";
	return header;
}

function fieldLabel(key: LeadFieldKey): string {
	return FIELD_OPTIONS.find((o) => o.key === key)?.label ?? key;
}

function firstNonEmptySample(values: string[]) {
	return values.find((v) => String(v ?? "").trim() !== "") ?? "";
}

function rowsToResultCsv(
	lines: Array<{
		lineNo: number;
		identifier: string;
		object: string;
		kind: string;
		message?: string;
	}>,
) {
	const headers = ["Line No.", "Identifier", "Object", "Type", "Message"];
	const escape = (v: unknown) => {
		const s = v === null || v === undefined ? "" : String(v);
		if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
		return s;
	};
	return [
		headers.join(","),
		...lines.map((l) =>
			[l.lineNo, l.identifier, l.object, l.kind, l.message ?? ""]
				.map(escape)
				.join(","),
		),
	].join("\n");
}

export type AgentCrmImportMode = "personal_assigned" | "company_unclaimed";

/**
 * Agent import dialog with the same Upload → Map → Review → Results UX as Admin Import Leads.
 * Wired to `trpc.crm.importCsv` (agent-safe).
 */
export function ImportLeadsDialog({
	open,
	onOpenChange,
	importMode,
	onImported,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	importMode: AgentCrmImportMode;
	onImported: () => void;
}) {
	const queryClient = useQueryClient();
	const fileRef = useRef<HTMLInputElement>(null);
	const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
	const [fileName, setFileName] = useState<string | null>(null);
	const [parseError, setParseError] = useState<string | null>(null);
	const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
	const [columnMap, setColumnMap] = useState<Record<string, LeadFieldKey>>({});
	const [skipEmptyByField, setSkipEmptyByField] = useState<
		Record<Exclude<LeadFieldKey, "skip">, boolean>
	>({
		name: true,
		phone: true,
		email: true,
		source: true,
		notes: true,
		categories: true,
		stage: true,
		status: true,
		type: true,
		property: true,
		project: true,
		lastContact: true,
		nextContact: true,
		follower: true,
	});
	const [importResult, setImportResult] = useState<
		| null
		| {
				total: number;
				success: number;
				created: number;
				updated: number;
				error: number;
				warning: number;
				skippedInvalid: number;
				lines: Array<{
					lineNo: number;
					identifier: string;
					object: string;
					kind: "created" | "updated" | "error" | "warning";
					message?: string;
				}>;
		  }
	>(null);

	const importMutation = trpc.crm.importCsv.useMutation({
		onSuccess: (result) => {
			const lines: Array<{
				lineNo: number;
				identifier: string;
				object: string;
				kind: "created" | "updated" | "error" | "warning";
				message?: string;
			}> = [];

			for (const w of result.warnings) {
				lines.push({
					lineNo: w.rowIndex ?? 0,
					identifier: "",
					object: "lead",
					kind: "warning",
					message: w.message,
				});
			}
			for (const e of result.errors) {
				lines.push({
					lineNo: e.rowIndex ?? 0,
					identifier: "",
					object: "lead",
					kind: "error",
					message: e.message,
				});
			}

			setImportResult({
				total: rawRows.length,
				success: result.created,
				created: result.created,
				updated: 0,
				error: result.errors.length,
				warning: result.warnings.length,
				skippedInvalid: result.skippedInvalid ?? 0,
				lines,
			});
			setStep(4);

			const parts = [
				`${result.created} created`,
				result.skippedDuplicate
					? `${result.skippedDuplicate} skipped (duplicate)`
					: null,
				result.skippedInvalid
					? `${result.skippedInvalid} skipped (invalid)`
					: null,
			].filter(Boolean);
			toast.success(`Import finished: ${parts.join(" · ")}`);
			void queryClient.invalidateQueries({ queryKey: [["crm"]] });
			onImported();
		},
		onError: (e) => toast.error(e.message),
	});

	const handleClose = () => {
		onOpenChange(false);
		setRawRows([]);
		setFileName(null);
		setParseError(null);
		setStep(1);
		setColumnMap({});
		setImportResult(null);
		if (fileRef.current) fileRef.current.value = "";
	};

	const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		setParseError(null);
		setRawRows([]);
		setFileName(null);
		setImportResult(null);
		setStep(1);
		if (!file) return;
		if (!/\.csv$/i.test(file.name)) {
			setParseError("Please choose a .csv file.");
			return;
		}
		try {
			const text = await file.text();
			const parsed = parseCsvToRecords(text);
			if (parsed.length === 0) {
				setParseError("No data rows found after the header row.");
				return;
			}
			setRawRows(parsed);
			setFileName(file.name);

			// Seed mapping: best-effort auto-map common header names
			const headers = Object.keys(parsed[0] ?? {});
			const seed: Record<string, LeadFieldKey> = {};
			for (const h of headers) {
				const n = h.toLowerCase().trim();
				if (n === "name" || n.includes("full name")) seed[h] = "name";
				else if (n === "phone" || n.includes("mobile")) seed[h] = "phone";
				else if (n === "email" || n.includes("e-mail")) seed[h] = "email";
				else if (n === "source") seed[h] = "source";
				else if (n === "notes" || n.includes("remark")) seed[h] = "notes";
				else if (
					n === "tags" ||
					n === "tag" ||
					n.includes("category") ||
					n.includes("categories")
				)
					seed[h] = "categories";
				else if (n === "stage") seed[h] = "stage";
				else if (n === "status") seed[h] = "status";
				else if (n === "type") seed[h] = "type";
				else if (n === "property") seed[h] = "property";
				else if (n === "project" || n.includes("project name")) seed[h] = "project";
				else if (n.includes("last contact")) seed[h] = "lastContact";
				else if (n.includes("next contact")) seed[h] = "nextContact";
				else if (
					n.includes("follower") ||
					n === "contact owner" ||
					n === "contactowner" ||
					n.includes("contact owner")
				)
					seed[h] = "follower";
				else seed[h] = "skip";
			}
			setColumnMap(seed);
			setStep(2);
		} catch {
			setParseError("Could not read that file.");
		}
	};

	const headers = useMemo(() => {
		const first = rawRows[0];
		return first ? Object.keys(first) : [];
	}, [rawRows]);

	const mappingWarnings = useMemo(() => {
		if (headers.length === 0) return [];
		const used = new Map<LeadFieldKey, string[]>();
		for (const h of headers) {
			const f = columnMap[h] ?? "skip";
			used.set(f, [...(used.get(f) ?? []), h]);
		}

		const warnings: string[] = [];
		const required: LeadFieldKey[] = ["name", "phone"];
		for (const r of required) {
			if ((used.get(r)?.length ?? 0) === 0) {
				warnings.push(`Missing mapping for required field: ${fieldLabel(r)}`);
			}
		}
		for (const [k, cols] of used.entries()) {
			if (k !== "skip" && cols.length > 1) {
				warnings.push(
					`Field “${fieldLabel(k)}” mapped multiple times: ${cols.map(displayCsvColumnName).join(", ")}`,
				);
			}
		}
		return warnings;
	}, [headers, columnMap]);

	const mappedRows = useMemo(() => {
		if (rawRows.length === 0) return [];
		const out: Record<string, string>[] = [];
		for (const r of rawRows) {
			const next: Record<string, string> = {};
			for (const h of headers) {
				const field = columnMap[h] ?? "skip";
				if (field === "skip") continue;
				const rawVal = r[h] ?? "";
				const v = String(rawVal ?? "").trim();
				const skipEmpty = skipEmptyByField[field];
				if (skipEmpty && v === "") continue;

				// Map to the CRM importer’s expected headers
				if (field === "name") next["Name"] = v;
				else if (field === "phone") next["Phone"] = v;
				else if (field === "email") next["Email"] = v;
				else if (field === "source") next["Source"] = v;
				else if (field === "notes") next["Notes"] = v;
				else if (field === "categories") next["Categories"] = v;
				else if (field === "stage") next["Stage"] = v;
				else if (field === "status") next["Status"] = v;
				else if (field === "type") next["Type"] = v;
				else if (field === "property") next["Property"] = v;
				else if (field === "project") next["Project"] = v;
				else if (field === "lastContact") next["Last Contact"] = v;
				else if (field === "nextContact") next["Next Contact"] = v;
				else if (field === "follower") next["Follower"] = v;
			}
			out.push(next);
		}
		return out;
	}, [rawRows, headers, columnMap, skipEmptyByField]);

	const previewRows = useMemo(() => mappedRows.slice(0, 5), [mappedRows]);

	const handleImport = () => {
		if (mappedRows.length === 0 || importMutation.isPending) return;
		importMutation.mutate({ rows: mappedRows, mode: importMode });
	};

	const requiredMissing = useMemo(() => {
		const required = ["Name", "Phone"];
		if (mappedRows.length === 0) return required;
		const keys = new Set(Object.keys(mappedRows[0] ?? {}));
		return required.filter((k) => !keys.has(k));
	}, [mappedRows]);

	const stepLabel =
		importMode === "personal_assigned"
			? "My Leads (personal leads assigned to you)"
			: "Company Leads (unclaimed pool)";

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				if (!v) handleClose();
			}}
		>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<RiFileUploadLine className="size-5 text-green-600" aria-hidden />
						Import leads
					</DialogTitle>
					<DialogDescription>
						Upload a CSV, map columns, review, then import. Imports as:{" "}
						<strong>{stepLabel}</strong>.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-3">
					<Progress value={step === 1 ? 25 : step === 2 ? 50 : step === 3 ? 75 : 100} />

					<Tabs value={String(step)} onValueChange={(v) => setStep(Number(v) as 1 | 2 | 3 | 4)}>
						<TabsList className="grid w-full grid-cols-4">
							<TabsTrigger value="1">Upload</TabsTrigger>
							<TabsTrigger value="2" disabled={!fileName}>
								Mapping
							</TabsTrigger>
							<TabsTrigger value="3" disabled={mappedRows.length === 0}>
								Review
							</TabsTrigger>
							<TabsTrigger value="4" disabled={!importResult}>
								Results
							</TabsTrigger>
						</TabsList>

						<TabsContent value="1" className="space-y-3">
							<input
								ref={fileRef}
								type="file"
								accept=".csv,text/csv"
								className="sr-only"
								onChange={onPickFile}
							/>
							<div className="flex flex-wrap items-center gap-2">
								<Button
									type="button"
									variant="outline"
									onClick={() => fileRef.current?.click()}
									disabled={importMutation.isPending}
								>
									Choose file…
								</Button>
								{fileName && (
									<span className="text-muted-foreground text-sm">{fileName}</span>
								)}
							</div>
							{parseError && <p className="text-destructive text-sm">{parseError}</p>}
							{rawRows.length > 0 && !parseError && (
								<p className="text-muted-foreground text-sm">
									<strong className="text-foreground">{rawRows.length}</strong>{" "}
									rows loaded. Continue to Mapping.
								</p>
							)}
						</TabsContent>

						<TabsContent value="2" className="space-y-3">
							{mappingWarnings.length > 0 && (
								<div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-amber-800 text-sm dark:text-amber-200">
									<div className="flex items-start gap-2">
										<RiErrorWarningLine className="mt-0.5 size-4 shrink-0" />
										<div>
											<p className="font-medium">Mapping warnings</p>
											<ul className="mt-1 list-inside list-disc">
												{mappingWarnings.slice(0, 6).map((w) => (
													<li key={w}>{w}</li>
												))}
											</ul>
										</div>
									</div>
								</div>
							)}

							<div className="overflow-x-auto rounded-lg border">
								<table className="w-full min-w-[720px] text-sm">
									<thead className="border-b bg-muted/40 text-left text-muted-foreground text-xs">
										<tr>
											<th className="px-3 py-2 font-medium">CSV column</th>
											<th className="px-3 py-2 font-medium">Sample</th>
											<th className="px-3 py-2 font-medium">Map to</th>
											<th className="px-3 py-2 font-medium">Skip empty</th>
										</tr>
									</thead>
									<tbody>
										{headers.map((h) => {
											const sample = firstNonEmptySample(
												rawRows.slice(0, 20).map((r) => String(r[h] ?? "")),
											);
											const mapped = columnMap[h] ?? "skip";
											const skipEmpty =
												mapped === "skip" ? false : skipEmptyByField[mapped];
											return (
												<tr key={h} className="border-b last:border-0">
													<td className="px-3 py-2 font-medium">
														{displayCsvColumnName(h)}
													</td>
													<td className="px-3 py-2 text-muted-foreground">{sample || "—"}</td>
													<td className="px-3 py-2">
														<Select
															value={mapped}
															onValueChange={(v) =>
																setColumnMap((p) => ({ ...p, [h]: v as LeadFieldKey }))
															}
														>
															<SelectTrigger className="h-8 w-[200px] text-xs">
																<SelectValue />
															</SelectTrigger>
															<SelectContent>
																{FIELD_OPTIONS.map((o) => (
																	<SelectItem key={o.key} value={o.key}>
																		{o.label}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
													</td>
													<td className="px-3 py-2">
														<Button
															type="button"
															variant={skipEmpty ? "secondary" : "outline"}
															size="sm"
															className="h-7"
															disabled={mapped === "skip"}
															onClick={() => {
																if (mapped === "skip") return;
																setSkipEmptyByField((p) => ({
																	...p,
																	[mapped]: !p[mapped],
																}));
															}}
														>
															{skipEmpty ? (
																<>
																	<RiCheckLine className="mr-1 size-3.5" />
																	On
																</>
															) : (
																<>
																	<RiCloseLine className="mr-1 size-3.5" />
																	Off
																</>
															)}
														</Button>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</TabsContent>

						<TabsContent value="3" className="space-y-3">
							{rawRows.length === 0 ? (
								<p className="text-muted-foreground text-sm">
									Upload a CSV to continue.
								</p>
							) : (
								<div className="space-y-3">
									{requiredMissing.length > 0 && (
										<div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive text-sm">
											Missing required fields: {requiredMissing.join(", ")}.
											Please go back to Mapping.
										</div>
									)}

									<div className="flex items-start justify-between gap-3">
										<div>
											<p className="font-medium text-sm">
												Step 3 — Review &amp; import
											</p>
											<p className="text-muted-foreground text-xs">
												Preview the first 5 mapped rows.
											</p>
										</div>
										<div className="text-muted-foreground text-xs">
											Importing:{" "}
											<span className="font-medium text-foreground">
												{mappedRows.length}
											</span>{" "}
											row{mappedRows.length === 1 ? "" : "s"}
										</div>
									</div>

									<div className="overflow-x-auto rounded-md border">
										<table className="min-w-[720px] w-full text-left text-sm">
											<thead className="border-b bg-muted/30">
												<tr>
													<th className="px-3 py-2 font-medium text-xs">#</th>
													{Object.keys(previewRows[0] ?? {}).map((k) => (
														<th
															key={k}
															className="px-3 py-2 font-medium text-xs"
														>
															{k}
														</th>
													))}
												</tr>
											</thead>
											<tbody>
												{previewRows.length === 0 ? (
													<tr>
														<td
															colSpan={999}
															className="px-3 py-6 text-center text-muted-foreground text-sm"
														>
															No preview rows (check your mapping).
														</td>
													</tr>
												) : (
													previewRows.map((r, idx) => (
														<tr
															key={idx}
															className="border-b last:border-b-0"
														>
															<td className="px-3 py-2 text-muted-foreground text-xs">
																{idx + 1}
															</td>
															{Object.keys(previewRows[0] ?? {}).map((k) => (
																<td key={k} className="px-3 py-2 text-xs">
																	{String(r[k] ?? "") || "—"}
																</td>
															))}
														</tr>
													))
												)}
											</tbody>
										</table>
									</div>
								</div>
							)}
						</TabsContent>

						<TabsContent value="4" className="space-y-3">
							{importResult ? (
								<>
									<div className="grid gap-3 sm:grid-cols-4">
										<div className="rounded-lg border bg-muted/30 p-3">
											<p className="text-muted-foreground text-xs">Total</p>
											<p className="font-semibold text-xl">{importResult.total}</p>
										</div>
										<div className="rounded-lg border bg-green-50/50 p-3 dark:bg-green-950/20">
											<p className="text-muted-foreground text-xs">Created</p>
											<p className="font-semibold text-xl">{importResult.created}</p>
										</div>
										<div className="rounded-lg border bg-amber-50/50 p-3 dark:bg-amber-950/20">
											<p className="text-muted-foreground text-xs">Warnings</p>
											<p className="font-semibold text-xl">{importResult.warning}</p>
										</div>
										<div className="rounded-lg border border-red-200 bg-red-50/50 p-3 dark:border-red-900/40 dark:bg-red-950/20">
											<p className="text-muted-foreground text-xs">Errors</p>
											<p className="font-semibold text-xl">{importResult.error}</p>
										</div>
									</div>

									<div className="flex flex-wrap items-center justify-between gap-2">
										<p className="text-muted-foreground text-sm">
											Download a CSV of warnings/errors for review.
										</p>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => {
												const csv = rowsToResultCsv(importResult.lines);
												const blob = new Blob([csv], {
													type: "text/csv;charset=utf-8;",
												});
												const url = URL.createObjectURL(blob);
												const a = document.createElement("a");
												a.href = url;
												a.download = "import-results.csv";
												a.click();
												URL.revokeObjectURL(url);
											}}
										>
											<RiDownloadLine className="mr-1 size-4" />
											Download results
										</Button>
									</div>
								</>
							) : (
								<p className="text-muted-foreground text-sm">No results yet.</p>
							)}
						</TabsContent>
					</Tabs>
				</div>

				<DialogFooter className="gap-2">
					<Button type="button" variant="outline" onClick={handleClose}>
						{step === 4 ? "Close" : "Cancel"}
					</Button>
					{step === 1 && (
						<Button
							type="button"
							disabled={rawRows.length === 0 || !!parseError}
							onClick={() => setStep(2)}
						>
							Next
						</Button>
					)}
					{step === 2 && (
						<Button
							type="button"
							disabled={mappedRows.length === 0}
							onClick={() => setStep(3)}
						>
							Review
						</Button>
					)}
					{step === 3 && (
						<Button
							type="button"
							className="bg-green-600 hover:bg-green-700"
							disabled={
								mappedRows.length === 0 ||
								requiredMissing.length > 0 ||
								importMutation.isPending
							}
							onClick={handleImport}
						>
							{importMutation.isPending ? (
								<>
									<RiLoader4Line className="mr-1.5 size-4 animate-spin" />
									Importing…
								</>
							) : (
								"Import"
							)}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

