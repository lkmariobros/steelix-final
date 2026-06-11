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
import {
	RiCheckLine,
	RiCloseLine,
	RiFileUploadLine,
	RiLoader4Line,
} from "@remixicon/react";
import { parseCsvToRecords } from "../../leads/_utils/parse-csv";

function extractTagName(row: Record<string, string>): string {
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

export function ImportTagsDialog({
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
	const [rows, setRows] = useState<Record<string, string>[]>([]);
	const [fileName, setFileName] = useState<string | null>(null);
	const [parseError, setParseError] = useState<string | null>(null);
	const [importResult, setImportResult] = useState<{
		total: number;
		created: number;
		skipped: number;
		error: number;
		lines: Array<{
			lineNo: number;
			name: string;
			kind: "created" | "skipped" | "error";
			message?: string;
		}>;
	} | null>(null);

	const previewNames = useMemo(
		() => rows.slice(0, 8).map(extractTagName).filter(Boolean),
		[rows],
	);

	const importMutation = trpc.tags.importCsv.useMutation({
		onSuccess: (result) => {
			setImportResult(result);
			void queryClient.invalidateQueries({ queryKey: [["tags", "list"]] });
			onImported();
			if (result.created > 0) {
				toast.success(`Created ${result.created} tag(s).`);
			} else if (result.error === 0) {
				toast.message("No new tags — all names already exist or were duplicates.");
			}
		},
		onError: (e) => toast.error(e.message),
	});

	const handleClose = () => {
		setRows([]);
		setFileName(null);
		setParseError(null);
		setImportResult(null);
		onOpenChange(false);
	};

	const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		setParseError(null);
		setRows([]);
		setFileName(null);
		setImportResult(null);
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
		importMutation.mutate({ rows });
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				if (!v) handleClose();
			}}
		>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<RiFileUploadLine className="size-5" />
						Import categories from CSV
					</DialogTitle>
					<DialogDescription>
						One category per row. Use a column named <strong>Tags</strong> or{" "}
						<strong>Category Name</strong>. Existing names are skipped.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-2">
					<input
						ref={fileRef}
						type="file"
						accept=".csv,text/csv"
						className="hidden"
						onChange={onPickFile}
					/>
					<Button
						type="button"
						variant="outline"
						className="w-full"
						onClick={() => fileRef.current?.click()}
					>
						<RiFileUploadLine className="mr-2 size-4" />
						{fileName ? `Selected: ${fileName}` : "Choose CSV file"}
					</Button>

					{parseError ? (
						<p className="text-destructive text-sm">{parseError}</p>
					) : null}

					{rows.length > 0 && !importResult ? (
						<div className="rounded-md border bg-muted/30 p-3 text-sm">
							<p className="font-medium">
								{rows.length} row{rows.length === 1 ? "" : "s"} ready to import
							</p>
							{previewNames.length > 0 ? (
								<ul className="mt-2 list-disc space-y-0.5 pl-4 text-muted-foreground text-xs">
									{previewNames.map((n) => (
										<li key={n}>{n}</li>
									))}
									{rows.length > previewNames.length ? (
										<li>…and more</li>
									) : null}
								</ul>
							) : null}
						</div>
					) : null}

					{importResult ? (
						<div className="space-y-2 rounded-md border p-3 text-sm">
							<div className="flex flex-wrap gap-3 text-xs">
								<span>Total: {importResult.total}</span>
								<span className="text-emerald-600">
									Created: {importResult.created}
								</span>
								<span className="text-muted-foreground">
									Skipped: {importResult.skipped}
								</span>
								{importResult.error > 0 ? (
									<span className="text-destructive">
										Errors: {importResult.error}
									</span>
								) : null}
							</div>
							<div className="max-h-40 overflow-y-auto rounded border">
								<table className="w-full text-left text-xs">
									<thead className="sticky top-0 border-b bg-muted/50">
										<tr>
											<th className="px-2 py-1">Line</th>
											<th className="px-2 py-1">Tag</th>
											<th className="px-2 py-1">Result</th>
										</tr>
									</thead>
									<tbody>
										{importResult.lines.map((l) => (
											<tr key={`${l.lineNo}-${l.name}`} className="border-b">
												<td className="px-2 py-1">{l.lineNo}</td>
												<td className="px-2 py-1">{l.name}</td>
												<td className="px-2 py-1 capitalize">
													{l.kind}
													{l.message ? ` — ${l.message}` : ""}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					) : null}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={handleClose}>
						<RiCloseLine className="mr-1 size-4" />
						{importResult ? "Close" : "Cancel"}
					</Button>
					{!importResult ? (
						<Button
							onClick={handleImport}
							disabled={rows.length === 0 || importMutation.isPending}
							className="bg-green-600 hover:bg-green-700"
						>
							{importMutation.isPending ? (
								<>
									<RiLoader4Line className="mr-2 size-4 animate-spin" />
									Importing…
								</>
							) : (
								<>
									<RiCheckLine className="mr-2 size-4" />
									Import {rows.length > 0 ? rows.length : ""} tag
									{rows.length === 1 ? "" : "s"}
								</>
							)}
						</Button>
					) : null}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
