"use client";

import type React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
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
import { RiFileUploadLine, RiLoader4Line } from "@remixicon/react";
import { Progress } from "@/components/ui/progress";
import { parseCsvToRecords } from "@/app/admin/leads/_utils/parse-csv";
import { PIPELINE_STAGES } from "@/app/admin/leads/_components/lead-constants";

export type CrmImportMode = "personal_assigned" | "company_unclaimed";

const STAGE_CODES = PIPELINE_STAGES.map((s) => s.value).join(", ");

function FieldRow({
	header,
	required,
	aliases,
	notes,
}: {
	header: string;
	required?: boolean;
	aliases?: string;
	notes: React.ReactNode;
}) {
	return (
		<div className="border-b border-border/60 py-2 last:border-b-0">
			<div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
				<span className="font-medium text-foreground">{header}</span>
				{required && (
					<span className="text-[10px] font-medium uppercase tracking-wide text-green-600 dark:text-green-500">
						Required
					</span>
				)}
				{aliases && (
					<span className="text-muted-foreground text-[11px]">
						(aliases: {aliases})
					</span>
				)}
			</div>
			<div className="mt-0.5 text-muted-foreground text-xs leading-snug">
				{notes}
			</div>
		</div>
	);
}

export function CrmImportDialog({
	open,
	onOpenChange,
	importMode,
	onImported,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	importMode: CrmImportMode;
	onImported: () => void;
}) {
	const queryClient = useQueryClient();
	const fileRef = useRef<HTMLInputElement>(null);
	const [rows, setRows] = useState<Record<string, string>[]>([]);
	const [fileName, setFileName] = useState<string | null>(null);
	const [parseError, setParseError] = useState<string | null>(null);
	const [step, setStep] = useState<1 | 2 | 3>(1); // 1 Upload, 2 Review, 3 Results
	const [lastResult, setLastResult] = useState<null | {
		created: number;
		skippedDuplicate: number;
		skippedInvalid: number;
		warnings: number;
		errors: number;
	}>(null);

	const modeLabel =
		importMode === "personal_assigned"
			? "My Leads (assigned to you)"
			: "Company pool (unclaimed company leads)";

	const importMutation = trpc.crm.importCsv.useMutation({
		onSuccess: (result) => {
			setLastResult({
				created: result.created,
				skippedDuplicate: result.skippedDuplicate ?? 0,
				skippedInvalid: result.skippedInvalid ?? 0,
				warnings: result.warnings.length,
				errors: result.errors.length,
			});
			setStep(3);
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
			if (result.warnings.length > 0) {
				const preview = result.warnings
					.slice(0, 4)
					.map((w) => `Row ${w.rowIndex}: ${w.message}`)
					.join("\n");
				toast.message(
					`${result.warnings.length} row(s) had category warnings`,
					{
						description:
							preview + (result.warnings.length > 4 ? "\n…" : ""),
					},
				);
			}
			if (result.errors.length > 0) {
				const preview = result.errors
					.slice(0, 6)
					.map((e) => `Row ${e.rowIndex}: ${e.message}`)
					.join("\n");
				toast.warning(
					`${result.errors.length} row(s) had validation issues`,
					{
						description:
							preview + (result.errors.length > 6 ? "\n…" : ""),
					},
				);
			}
			void queryClient.invalidateQueries({ queryKey: [["crm"]] });
			onImported();
		},
		onError: (e) => toast.error(e.message),
	});

	const handleClose = () => {
		onOpenChange(false);
		setRows([]);
		setFileName(null);
		setParseError(null);
		setStep(1);
		setLastResult(null);
		if (fileRef.current) fileRef.current.value = "";
	};

	const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		setParseError(null);
		setRows([]);
		setFileName(null);
		setLastResult(null);
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
			setRows(parsed);
			setFileName(file.name);
			setStep(2);
		} catch {
			setParseError("Could not read that file.");
		}
	};

	const handleImport = () => {
		if (rows.length === 0 || importMutation.isPending) return;
		importMutation.mutate({ rows, mode: importMode });
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				if (!v) handleClose();
			}}
		>
			<DialogContent className="flex max-h-[min(90vh,720px)] w-[calc(100vw-1.5rem)] min-h-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
				<DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
					<DialogTitle className="flex items-center gap-2 text-lg">
						<RiFileUploadLine className="size-5 text-green-600" aria-hidden />
						Import prospects (CSV)
					</DialogTitle>
					<DialogDescription className="text-left text-sm leading-relaxed">
						First row must be the header with column names below (matching an
						export from Admin or CRM works). Column names are{" "}
						<strong>case-insensitive</strong>. Duplicates (email or phone already
						in the system) are skipped. Imports as:{" "}
						<strong>{modeLabel}</strong>.
					</DialogDescription>
				</DialogHeader>

				<div className="shrink-0 border-b bg-muted/10 px-6 py-3">
					<div className="flex items-center justify-between text-xs text-muted-foreground">
						<span className={step === 1 ? "font-medium text-foreground" : ""}>
							1) Upload
						</span>
						<span className={step === 2 ? "font-medium text-foreground" : ""}>
							2) Review
						</span>
						<span className={step === 3 ? "font-medium text-foreground" : ""}>
							3) Results
						</span>
					</div>
					<Progress
						value={step === 1 ? 25 : step === 2 ? 65 : 100}
						className="mt-2 h-2"
					/>
				</div>

				<div
					className={[
						"min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-4",
						/* Minimal scrollbar (Firefox + WebKit) */
						"[scrollbar-gutter:stable]",
						"[scrollbar-width:thin]",
						"[scrollbar-color:hsl(var(--border))_transparent]",
						"[&::-webkit-scrollbar]:w-1.5",
						"[&::-webkit-scrollbar-track]:bg-transparent",
						"[&::-webkit-scrollbar-thumb]:rounded-full",
						"[&::-webkit-scrollbar-thumb]:bg-border/70",
						"hover:[&::-webkit-scrollbar-thumb]:bg-border",
					].join(" ")}
				>
					<div className="space-y-4">
						{step === 3 && lastResult ? (
							<div className="rounded-lg border border-border/80 bg-muted/25 px-4 py-3 text-sm">
								<p className="font-medium text-foreground">Import results</p>
								<ul className="mt-2 grid gap-1 text-muted-foreground">
									<li>
										<strong className="text-foreground">{lastResult.created}</strong>{" "}
										created
									</li>
									<li>
										<strong className="text-foreground">
											{lastResult.skippedDuplicate}
										</strong>{" "}
										skipped (duplicate)
									</li>
									<li>
										<strong className="text-foreground">
											{lastResult.skippedInvalid}
										</strong>{" "}
										skipped (invalid)
									</li>
									<li>
										<strong className="text-foreground">{lastResult.warnings}</strong>{" "}
										warnings
									</li>
									<li>
										<strong className="text-foreground">{lastResult.errors}</strong>{" "}
										errors
									</li>
								</ul>
								<p className="mt-2 text-muted-foreground text-xs">
									Close this dialog and refresh the list if you don’t see new rows
									immediately.
								</p>
							</div>
						) : null}

						<div className="rounded-lg border border-border/80 bg-muted/25 px-3 py-2.5">
							<p className="mb-2 font-medium text-foreground text-sm">
								CSV columns (exactly what the importer reads)
							</p>
							<div>
								<FieldRow
									header="Name"
									required
									notes="Full name. Minimum 2 characters."
								/>
								<FieldRow
									header="Email"
									required
									aliases="Contact Email"
									notes="Valid email address. Use column header “Email” or “Contact Email”."
								/>
								<FieldRow
									header="Phone"
									required
									aliases="Contact Phone"
									notes="At least 8 characters after cleaning. Digits, spaces, +, -, ( ) only. Use “Phone” or “Contact Phone”."
								/>
								<FieldRow
									header="Property"
									notes="Property interest or label. If empty, “—” is stored."
								/>
								<FieldRow
									header="Project"
									aliases="Project Name"
									notes="Optional. Must match an existing CRM project name exactly (case-insensitive) to link the project; otherwise left blank."
								/>
								<FieldRow
									header="Stage"
									notes={
										<>
											<p>
												Pipeline stage. Use the same labels as an export (e.g.
												“New Lead”, “Follow Up For Appt.”) or one of the codes
												below. Empty defaults to{" "}
												<code className="rounded bg-muted px-1 py-px text-[11px]">
													new_lead
												</code>
												.
											</p>
											<pre className="mt-1.5 whitespace-pre-wrap break-all rounded-md bg-muted/80 p-2 font-mono text-[10px] leading-tight text-muted-foreground">
												{STAGE_CODES}
											</pre>
										</>
									}
								/>
								<FieldRow
									header="Status"
									notes="active, inactive, or pending (any common capitalization). Empty defaults to active."
								/>
								<FieldRow
									header="Type"
									notes="Prospect type: tenant or buyer (owner is treated as buyer). Empty defaults to buyer."
								/>
								<FieldRow
									header="Source"
									notes="e.g. Website, Referral. If empty, “CSV import” is used."
								/>
								<FieldRow
									header="Categories"
									notes="Ignored on agent import. An admin assigns categories from Lead Categories after import."
								/>
								<FieldRow
									header="Last Contact"
									aliases="last contact"
									notes="Optional date. Prefer YYYY-MM-DD or ISO date; other formats may work if the browser can parse them."
								/>
								<FieldRow
									header="Next Contact"
									aliases="next contact"
									notes="Optional date; same format as Last Contact."
								/>
							</div>
						</div>

						<div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs leading-relaxed dark:border-amber-500/25 dark:bg-amber-500/10">
							<p className="font-medium text-foreground">Agent import rules</p>
							<ul className="mt-1.5 list-inside list-disc space-y-1 text-muted-foreground">
								<li>
									<strong>Agent</strong>, <strong>Agent Email</strong>, and{" "}
									<strong>Lead Type</strong> columns are{" "}
									<strong>not applied</strong> — assignment follows your tab (
									{modeLabel}).
								</li>
								<li>
									<strong>Created At</strong> / <strong>Updated At</strong> from
									an export file are ignored; the server sets timestamps.
								</li>
							</ul>
						</div>

						<div>
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
									size="sm"
									className="h-9"
									onClick={() => fileRef.current?.click()}
									disabled={importMutation.isPending}
								>
									Choose file…
								</Button>
								{fileName && (
									<span className="text-muted-foreground text-xs">
										{fileName}
									</span>
								)}
							</div>

							{parseError && (
								<p className="mt-2 text-destructive text-sm">{parseError}</p>
							)}

							{rows.length > 0 && !parseError && (
								<p className="mt-2 text-muted-foreground text-sm">
									<span className="font-medium text-foreground">
										{rows.length}
									</span>{" "}
									rows ready to import.
								</p>
							)}
						</div>
					</div>
				</div>

				<DialogFooter className="shrink-0 gap-2 border-t bg-muted/20 px-6 py-4 sm:justify-end">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={handleClose}
						disabled={importMutation.isPending}
					>
						{step === 3 ? "Close" : "Cancel"}
					</Button>
					{step !== 3 && (
						<Button
							type="button"
							size="sm"
							onClick={handleImport}
							disabled={
								rows.length === 0 ||
								!!parseError ||
								importMutation.isPending ||
								step !== 2
							}
							className="min-w-[120px] bg-green-600 hover:bg-green-700"
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
