"use client";

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
import { parseCsvToRecords } from "@/app/admin/leads/_utils/parse-csv";

export type CrmImportMode = "personal_assigned" | "company_unclaimed";

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

	const modeLabel =
		importMode === "personal_assigned"
			? "My Leads (assigned to you)"
			: "Company pool (unclaimed company leads)";

	const importMutation = trpc.crm.importCsv.useMutation({
		onSuccess: (result) => {
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
			handleClose();
		},
		onError: (e) => toast.error(e.message),
	});

	const handleClose = () => {
		onOpenChange(false);
		setRows([]);
		setFileName(null);
		setParseError(null);
		if (fileRef.current) fileRef.current.value = "";
	};

	const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		setParseError(null);
		setRows([]);
		setFileName(null);
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
			<DialogContent className="max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-lg">
				<DialogHeader className="border-b px-6 py-4 text-left">
					<DialogTitle className="flex items-center gap-2 text-lg">
						<RiFileUploadLine className="size-5 text-green-600" aria-hidden />
						Import prospects (CSV)
					</DialogTitle>
					<DialogDescription className="text-left text-sm leading-relaxed">
						Same column layout as admin export (Name, Email or Contact Email,
						Phone, etc.). Required per row: name, email, and phone. Duplicates
						(existing email or phone in the system) are skipped. Imports as:{" "}
						<strong>{modeLabel}</strong>. CSV agent columns are ignored.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 px-6 py-4">
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
							<span className="text-muted-foreground text-xs">{fileName}</span>
						)}
					</div>

					{parseError && (
						<p className="text-destructive text-sm">{parseError}</p>
					)}

					{rows.length > 0 && !parseError && (
						<p className="text-muted-foreground text-sm">
							<span className="font-medium text-foreground">{rows.length}</span>{" "}
							rows ready to import.
						</p>
					)}
				</div>

				<DialogFooter className="gap-2 border-t bg-muted/20 px-6 py-4 sm:justify-end">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={handleClose}
						disabled={importMutation.isPending}
					>
						Cancel
					</Button>
					<Button
						type="button"
						size="sm"
						onClick={handleImport}
						disabled={
							rows.length === 0 || !!parseError || importMutation.isPending
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
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
