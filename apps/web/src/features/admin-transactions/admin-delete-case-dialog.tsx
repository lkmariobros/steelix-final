"use client";

import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	formatStatusLabel,
	normalizeTransactionStatus,
} from "@/features/transactions/transaction-detail-utils";
import { invalidateAdminQueries } from "@/lib/query-invalidation";
import { trpc } from "@/utils/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/** Must match server `ADMIN_DELETABLE_STATUSES`: never-approved cases only. */
const ADMIN_DELETABLE_STATUSES = ["draft", "pending", "cancelled"];

export function adminCanDeleteCase(status: string | null | undefined): boolean {
	return ADMIN_DELETABLE_STATUSES.includes(normalizeTransactionStatus(status));
}

export function AdminDeleteCaseDialog({
	open,
	onOpenChange,
	transaction,
	onDeleted,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	transaction: { id: string; caseNo: string | null; status: string | null } | null;
	onDeleted?: () => void;
}) {
	const queryClient = useQueryClient();
	const [confirmText, setConfirmText] = useState("");

	useEffect(() => {
		if (!open) setConfirmText("");
	}, [open]);

	const deleteMutation = trpc.transactions.adminDelete.useMutation({
		onSuccess: (res) => {
			toast.success(
				res.caseNo ? `Case ${res.caseNo} permanently deleted` : "Case permanently deleted",
			);
			onOpenChange(false);
			onDeleted?.();
			invalidateAdminQueries(queryClient);
		},
		onError: (e) => toast.error(e.message || "Failed to delete case"),
	});

	const caseNo = transaction?.caseNo ?? null;
	const confirmed = caseNo
		? confirmText.trim().toUpperCase() === caseNo.toUpperCase()
		: confirmText.trim().toUpperCase() === "DELETE";

	return (
		<AlertDialog
			open={open}
			onOpenChange={(next) => {
				if (!deleteMutation.isPending) onOpenChange(next);
			}}
		>
			<AlertDialogContent className="gap-5 sm:max-w-md">
				<AlertDialogHeader className="gap-2">
					<AlertDialogTitle>
						Delete case {caseNo ?? ""} permanently?
					</AlertDialogTitle>
					<AlertDialogDescription className="text-left">
						This removes the case with its documents, messages and any commission
						records. It cannot be recovered.
						{transaction?.status ? (
							<>
								{" "}
								Current status:{" "}
								<span className="font-medium text-foreground">
									{formatStatusLabel(transaction.status)}
								</span>
								.
							</>
						) : null}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<div className="space-y-2">
					<Label htmlFor="confirm-delete-case">
						Type <span className="font-mono font-semibold">{caseNo ?? "DELETE"}</span>{" "}
						to confirm
					</Label>
					<Input
						id="confirm-delete-case"
						autoComplete="off"
						value={confirmText}
						onChange={(e) => setConfirmText(e.target.value)}
						disabled={deleteMutation.isPending}
					/>
				</div>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={deleteMutation.isPending}>
						Cancel
					</AlertDialogCancel>
					<Button
						type="button"
						variant="destructive"
						disabled={!confirmed || !transaction || deleteMutation.isPending}
						onClick={() => {
							if (!transaction) return;
							deleteMutation.mutate({
								id: transaction.id,
								confirmCaseNo: caseNo ? confirmText.trim() : undefined,
							});
						}}
					>
						{deleteMutation.isPending ? (
							<Loader2 className="mr-1 size-4 animate-spin" />
						) : null}
						Delete permanently
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
