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
import { parseCsvToRecords } from "../_utils/parse-csv";

type LeadFieldKey =
	| "name"
	| "phone"
	| "email"
	| "source"
	| "notes"
	| "tags"
	| "agent"
	| "skip";

const FIELD_OPTIONS: Array<{ key: LeadFieldKey; label: string }> = [
	{ key: "name", label: "Name" },
	{ key: "phone", label: "Phone" },
	{ key: "email", label: "Email" },
	{ key: "source", label: "Source" },
	{ key: "notes", label: "Notes" },
	{ key: "tags", label: "Tags" },
	{ key: "agent", label: "Assigned Agent" },
	{ key: "skip", label: "Skip column" },
];

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
			[
				l.lineNo,
				l.identifier,
				l.object,
				l.kind,
				l.message ?? "",
			]
				.map(escape)
				.join(","),
		),
	].join("\n");
}

export function ImportLeadsDialog({
	open,
	onOpenChange,
	onImported,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
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
		tags: true,
		agent: true,
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

	const importMutation = trpc.adminLeads.importCsv.useMutation({
		onSuccess: (result) => {
			setImportResult(result);
			setStep(4);

			const parts = [
				`${result.created} created`,
				`${result.updated} updated`,
				result.warning ? `${result.warning} warning` : null,
				result.error ? `${result.error} error` : null,
			].filter(Boolean);
			toast.success(`Import finished: ${parts.join(" · ")}`);
			void queryClient.invalidateQueries({ queryKey: [["adminLeads"]] });
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
				else if (n === "tags" || n.includes("tag")) seed[h] = "tags";
				else if (n.includes("agent")) seed[h] = "agent";
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
				warnings.push(`Missing mapping for required field: ${r}`);
			}
		}
		for (const [k, cols] of used.entries()) {
			if (k !== "skip" && cols.length > 1) {
				warnings.push(`Field “${k}” mapped multiple times: ${cols.join(", ")}`);
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

				// Apply per-field skip-empty rule
				const skipEmpty = skipEmptyByField[field];
				if (skipEmpty && v === "") continue;

				// Map to server import aliases
				if (field === "agent") next["Assigned Agent"] = v;
				else next[field] = v;
			}
			out.push(next);
		}
		return out;
	}, [rawRows, headers, columnMap, skipEmptyByField]);

	const previewRows = useMemo(() => mappedRows.slice(0, 5), [mappedRows]);

	const handleImport = () => {
		if (mappedRows.length === 0 || importMutation.isPending) return;
		if (mappingWarnings.some((w) => w.toLowerCase().includes("missing mapping"))) {
			toast.error("Please map Name and Phone before importing.");
			return;
		}
		importMutation.mutate({ rows: mappedRows });
	};

	const progressValue = step === 1 ? 25 : step === 2 ? 50 : step === 3 ? 75 : 100;

	const downloadResults = () => {
		if (!importResult) return;
		const csv = rowsToResultCsv(importResult.lines);
		const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
		const link = document.createElement("a");
		link.href = URL.createObjectURL(blob);
		link.download = `lead_import_results_${new Date().toISOString().split("T")[0]}.csv`;
		link.click();
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				if (!v) handleClose();
			}}
		>
			<DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
				<DialogHeader className="border-b px-6 py-4 text-left">
					<DialogTitle className="flex items-center gap-2 text-lg">
						<RiFileUploadLine className="size-5 text-primary" aria-hidden />
						Import leads
					</DialogTitle>
					<DialogDescription className="text-left text-sm leading-relaxed">
						Upload a CSV, map columns, review, then import. Leads are{" "}
						<strong>upserted by phone</strong> (existing phone → Updated).
					</DialogDescription>
				</DialogHeader>

				{/* Scrollable body */}
				<div className="min-h-0 flex-1 overflow-y-auto">
					<div className="space-y-3 px-6 py-4">
						<div className="flex items-center justify-between gap-3">
							<div className="min-w-0 flex-1">
								<Progress value={progressValue} />
								<div className="mt-1.5 flex items-center justify-between text-muted-foreground text-xs">
									<span className={step >= 1 ? "text-foreground" : ""}>
										1) Upload
									</span>
									<span className={step >= 2 ? "text-foreground" : ""}>
										2) Map
									</span>
									<span className={step >= 3 ? "text-foreground" : ""}>
										3) Review
									</span>
									<span className={step >= 4 ? "text-foreground" : ""}>
										4) Results
									</span>
								</div>
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-9"
								onClick={() => {
									setRawRows([]);
									setParseError(null);
									setFileName(null);
									setImportResult(null);
									setStep(1);
									setColumnMap({});
									if (fileRef.current) fileRef.current.value = "";
									fileRef.current?.click();
								}}
								disabled={importMutation.isPending}
							>
								Choose file…
							</Button>
						</div>

						<input
							ref={fileRef}
							type="file"
							accept=".csv,text/csv"
							className="sr-only"
							onChange={onPickFile}
						/>

						{fileName ? (
							<div className="flex flex-wrap items-center gap-2 text-sm">
								<span className="font-medium">{fileName}</span>
								<span className="text-muted-foreground">
									· {rawRows.length} row{rawRows.length === 1 ? "" : "s"}
								</span>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-7 px-2 text-xs"
									onClick={() => {
										setRawRows([]);
										setFileName(null);
										setParseError(null);
										setImportResult(null);
										setStep(1);
										setColumnMap({});
										if (fileRef.current) fileRef.current.value = "";
									}}
								>
									<RiCloseLine className="mr-1 size-3.5" />
									Remove
								</Button>
							</div>
						) : null}

						{parseError ? (
							<p className="text-destructive text-sm">{parseError}</p>
						) : null}
					</div>

					<div className="border-t">
						<Tabs value={String(step)} onValueChange={() => {}}>
						<TabsList className="mx-6 mt-4">
							<TabsTrigger value="1" disabled>
								Upload
							</TabsTrigger>
							<TabsTrigger value="2" disabled>
								Mapping
							</TabsTrigger>
							<TabsTrigger value="3" disabled>
								Review
							</TabsTrigger>
							<TabsTrigger value="4" disabled>
								Results
							</TabsTrigger>
						</TabsList>

						<TabsContent value="1" className="px-6 py-4">
							<div className="rounded-md border bg-muted/20 p-4 text-sm">
								<p className="font-medium">Step 1 — Upload CSV</p>
								<p className="mt-1 text-muted-foreground text-sm">
									Once uploaded, you’ll map columns to lead fields and preview the
									first 5 rows before importing.
								</p>
							</div>
						</TabsContent>

						<TabsContent value="2" className="px-6 py-4">
							{rawRows.length === 0 ? (
								<p className="text-muted-foreground text-sm">
									Upload a CSV to continue.
								</p>
							) : (
								<div className="space-y-3">
									<div className="flex items-start justify-between gap-3">
										<div>
											<p className="font-medium text-sm">
												Step 2 — Column mapping
											</p>
											<p className="text-muted-foreground text-xs">
												Map each CSV column to a lead field (or skip it).
											</p>
										</div>
										{mappingWarnings.length > 0 ? (
											<div className="flex items-center gap-1.5 text-amber-600 text-xs">
												<RiErrorWarningLine className="size-4" />
												{mappingWarnings.length} warning
												{mappingWarnings.length === 1 ? "" : "s"}
											</div>
										) : (
											<div className="flex items-center gap-1.5 text-emerald-600 text-xs">
												<RiCheckLine className="size-4" />
												Ready
											</div>
										)}
									</div>

									{mappingWarnings.length > 0 ? (
										<div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 text-xs dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200">
											<ul className="list-disc space-y-1 pl-4">
												{mappingWarnings.slice(0, 6).map((w) => (
													<li key={w}>{w}</li>
												))}
											</ul>
										</div>
									) : null}

									<div className="overflow-x-auto rounded-md border">
										<table className="min-w-[720px] w-full text-left text-sm">
											<thead className="border-b bg-muted/30">
												<tr>
													<th className="px-3 py-2 font-medium text-xs">
														Column in file
													</th>
													<th className="px-3 py-2 font-medium text-xs">
														Sample value
													</th>
													<th className="px-3 py-2 font-medium text-xs">
														Mapped to
													</th>
													<th className="px-3 py-2 font-medium text-xs">
														Skip empty
													</th>
												</tr>
											</thead>
											<tbody>
												{headers.map((h) => {
													const samples = rawRows
														.slice(0, 20)
														.map((r) => String(r[h] ?? ""));
													const sample = firstNonEmptySample(samples);
													const mapped = columnMap[h] ?? "skip";
													const showSkipEmpty =
														mapped !== "skip" && mapped !== "name" && mapped !== "phone";
													return (
														<tr key={h} className="border-b last:border-b-0">
															<td className="px-3 py-2 font-medium text-xs">{h}</td>
															<td className="px-3 py-2 text-muted-foreground text-xs">
																{sample || "—"}
															</td>
															<td className="px-3 py-2">
																<Select
																	value={mapped}
																	onValueChange={(v) =>
																		setColumnMap((p) => ({
																			...p,
																			[h]: v as LeadFieldKey,
																		}))
																	}
																>
																	<SelectTrigger className="h-8 w-[200px] text-xs">
																		<SelectValue />
																	</SelectTrigger>
																	<SelectContent>
																		{FIELD_OPTIONS.map((opt) => (
																			<SelectItem
																				key={opt.key}
																				value={opt.key}
																				className="text-xs"
																			>
																				{opt.label}
																			</SelectItem>
																		))}
																	</SelectContent>
																</Select>
															</td>
															<td className="px-3 py-2 text-xs">
																{showSkipEmpty ? (
																	<button
																		type="button"
																		onClick={() =>
																			setSkipEmptyByField((p) => ({
																				...p,
																				[mapped]: !p[mapped],
																			}))
																		}
																		className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs"
																	>
																		<span
																			className={[
																				"inline-block size-2 rounded-full",
																				skipEmptyByField[mapped]
																					? "bg-emerald-500"
																					: "bg-gray-300 dark:bg-gray-700",
																			].join(" ")}
																		/>
																		{skipEmptyByField[mapped] ? "Yes" : "No"}
																	</button>
																) : (
																	<span className="text-muted-foreground">—</span>
																)}
															</td>
														</tr>
													);
												})}
											</tbody>
										</table>
									</div>
								</div>
							)}
						</TabsContent>

						<TabsContent value="3" className="px-6 py-4">
							{rawRows.length === 0 ? (
								<p className="text-muted-foreground text-sm">
									Upload a CSV to continue.
								</p>
							) : (
								<div className="space-y-3">
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
														<th key={k} className="px-3 py-2 font-medium text-xs">
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
														<tr key={idx} className="border-b last:border-b-0">
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

						<TabsContent value="4" className="px-6 py-4">
							{importResult ? (
								<div className="space-y-3">
									<p className="font-medium text-sm">
										Step 4 — Import stats
									</p>
									<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
										<div className="rounded-md border bg-muted/20 p-3">
											<p className="text-muted-foreground text-xs">Total</p>
											<p className="font-semibold text-lg">{importResult.total}</p>
										</div>
										<div className="rounded-md border bg-muted/20 p-3">
											<p className="text-muted-foreground text-xs">Success</p>
											<p className="font-semibold text-lg">{importResult.success}</p>
										</div>
										<div className="rounded-md border bg-muted/20 p-3">
											<p className="text-muted-foreground text-xs">Created</p>
											<p className="font-semibold text-lg">{importResult.created}</p>
										</div>
										<div className="rounded-md border bg-muted/20 p-3">
											<p className="text-muted-foreground text-xs">Updated</p>
											<p className="font-semibold text-lg">{importResult.updated}</p>
										</div>
										<div className="rounded-md border bg-muted/20 p-3">
											<p className="text-muted-foreground text-xs">
												Error / Warning
											</p>
											<p className="font-semibold text-lg">
												{importResult.error} / {importResult.warning}
											</p>
										</div>
									</div>

									<div className="flex items-center justify-between gap-2">
										<p className="text-muted-foreground text-xs">
											Showing {Math.min(importResult.lines.length, 200)} of{" "}
											{importResult.lines.length} line results.
										</p>
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="h-8"
											onClick={downloadResults}
										>
											<RiDownloadLine className="mr-1 size-4" />
											Download results CSV
										</Button>
									</div>

									<div className="overflow-x-auto rounded-md border">
										<table className="min-w-[720px] w-full text-left text-sm">
											<thead className="border-b bg-muted/30">
												<tr>
													<th className="px-3 py-2 font-medium text-xs">Line</th>
													<th className="px-3 py-2 font-medium text-xs">
														Identifier
													</th>
													<th className="px-3 py-2 font-medium text-xs">Object</th>
													<th className="px-3 py-2 font-medium text-xs">Type</th>
													<th className="px-3 py-2 font-medium text-xs">Message</th>
												</tr>
											</thead>
											<tbody>
												{importResult.lines.slice(0, 200).map((l) => (
													<tr key={`${l.lineNo}-${l.kind}`} className="border-b last:border-b-0">
														<td className="px-3 py-2 text-muted-foreground text-xs">
															{l.lineNo}
														</td>
														<td className="px-3 py-2 text-xs">{l.identifier}</td>
														<td className="px-3 py-2 text-xs">{l.object}</td>
														<td className="px-3 py-2 text-xs">
															<span
																className={[
																	"inline-flex rounded-full px-2 py-0.5 font-medium text-xs",
																	l.kind === "created"
																		? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
																		: l.kind === "updated"
																			? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
																			: l.kind === "warning"
																				? "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
																				: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300",
																].join(" ")}
															>
																{l.kind}
															</span>
														</td>
														<td className="px-3 py-2 text-muted-foreground text-xs">
															{l.message ?? "—"}
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</div>
							) : (
								<p className="text-muted-foreground text-sm">
									No import results yet.
								</p>
							)}
						</TabsContent>
						</Tabs>
					</div>
				</div>

				{/* Sticky footer actions */}
				<DialogFooter className="sticky bottom-0 gap-2 border-t bg-background/95 px-6 py-4 backdrop-blur sm:justify-end">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={handleClose}
						disabled={importMutation.isPending}
					>
						{step === 4 ? "Close" : "Cancel"}
					</Button>
					{step >= 2 && step <= 3 ? (
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={importMutation.isPending}
							onClick={() => setStep((s) => (s === 2 ? 1 : 2))}
						>
							Back
						</Button>
					) : null}
					<Button
						type="button"
						size="sm"
						onClick={() => {
							if (step === 2) setStep(3);
							else if (step === 3) handleImport();
							else if (step === 4) {
								handleClose();
							}
						}}
						disabled={
							rawRows.length === 0 ||
							!!parseError ||
							importMutation.isPending ||
							(step === 3 && mappedRows.length === 0) ||
							(step === 2 &&
								mappingWarnings.some((w) =>
									w.toLowerCase().includes("missing mapping"),
								))
						}
						className="min-w-[120px]"
					>
						{importMutation.isPending ? (
							<>
								<RiLoader4Line className="mr-1.5 size-4 animate-spin" />
								Importing…
							</>
						) : (
							(step === 2 ? "Continue" : step === 3 ? "Import" : "Done")
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
