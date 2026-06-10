"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	CANONICAL_TRANSACTION_STATUSES,
	formatStatusLabel,
	getStatusBadgeClass,
	normalizeTransactionStatus,
} from "@/features/transactions/transaction-detail-utils";
import { invalidateTransactionQueries } from "@/lib/query-invalidation";
import { trpc } from "@/utils/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type CanonicalStatus = (typeof CANONICAL_TRANSACTION_STATUSES)[number];

interface AdminTransactionStatusPanelProps {
	transactionId: string;
	currentStatus: string | null | undefined;
	agentEditAllowed?: boolean | null;
	onUpdated?: () => void;
}

export function AdminTransactionStatusPanel({
	transactionId,
	currentStatus,
	agentEditAllowed,
	onUpdated,
}: AdminTransactionStatusPanelProps) {
	const queryClient = useQueryClient();
	const normalized = normalizeTransactionStatus(currentStatus) as CanonicalStatus;

	const [status, setStatus] = useState<CanonicalStatus>(normalized);
	const [reviewNotes, setReviewNotes] = useState("");
	const [allowAgentEdit, setAllowAgentEdit] = useState(
		agentEditAllowed === true,
	);

	useEffect(() => {
		setStatus(normalizeTransactionStatus(currentStatus) as CanonicalStatus);
		setAllowAgentEdit(agentEditAllowed === true);
	}, [currentStatus, agentEditAllowed]);

	const changeStatus = trpc.transactions.adminChangeStatus.useMutation({
		onSuccess: async () => {
			toast.success("Status updated");
			invalidateTransactionQueries(queryClient);
			await queryClient.invalidateQueries({
				queryKey: [["admin", "getCommissionApprovalQueue"]],
			});
			await queryClient.invalidateQueries({
				queryKey: [["admin", "getDashboardSummary"]],
			});
			setReviewNotes("");
			onUpdated?.();
		},
		onError: (e) => toast.error(e.message || "Failed to update status"),
	});

	const applyStatus = (next: CanonicalStatus, opts?: { allowEdit?: boolean }) => {
		changeStatus.mutate({
			id: transactionId,
			status: next,
			reviewNotes: reviewNotes.trim() || undefined,
			allowAgentEdit:
				opts?.allowEdit ??
				(next === "pending" ? allowAgentEdit : undefined),
		});
	};

	const quickActions: {
		label: string;
		status: CanonicalStatus;
		allowEdit?: boolean;
		variant?: "default" | "outline" | "destructive" | "secondary";
		show?: boolean;
	}[] = [
		{
			label: "Verify",
			status: "verified",
			show: normalized === "pending",
		},
		{
			label: "Cancel",
			status: "cancelled",
			variant: "destructive",
			show: normalized === "pending",
		},
		{
			label: "Mark converted",
			status: "converted",
			show: normalized === "verified",
		},
		{
			label: "Reopen for agent",
			status: "pending",
			allowEdit: true,
			variant: "secondary",
			show: ["pending", "verified", "cancelled"].includes(normalized),
		},
		{
			label: "Revoke",
			status: "revoke",
			variant: "destructive",
			show: ["verified", "converted"].includes(normalized),
		},
	];

	return (
		<div className="space-y-4 rounded-lg border bg-muted/20 p-4">
			<div className="flex flex-wrap items-center gap-2">
				<span className="font-medium text-sm">Status</span>
				<Badge className={getStatusBadgeClass(currentStatus)}>
					{formatStatusLabel(currentStatus)}
				</Badge>
				{agentEditAllowed ? (
					<Badge variant="outline" className="text-xs">
						Agent edit allowed
					</Badge>
				) : null}
			</div>

			<div className="flex flex-wrap gap-2">
				{quickActions
					.filter((a) => a.show !== false)
					.map((action) => (
						<Button
							key={action.label}
							type="button"
							size="sm"
							variant={action.variant ?? "outline"}
							disabled={changeStatus.isPending}
							onClick={() =>
								applyStatus(action.status, {
									allowEdit: action.allowEdit,
								})
							}
						>
							{action.label}
						</Button>
					))}
			</div>

			<div className="grid gap-3 md:grid-cols-2">
				<div className="space-y-2">
					<Label>Set status</Label>
					<Select
						value={status}
						onValueChange={(v) => setStatus(v as CanonicalStatus)}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{CANONICAL_TRANSACTION_STATUSES.map((s) => (
								<SelectItem key={s} value={s}>
									{formatStatusLabel(s)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				{status === "pending" && (
					<div className="flex items-center gap-2 pt-6">
						<Checkbox
							id="allow-agent-edit"
							checked={allowAgentEdit}
							onCheckedChange={(v) => setAllowAgentEdit(v === true)}
						/>
						<Label htmlFor="allow-agent-edit" className="text-sm">
							Allow agent to edit this case
						</Label>
					</div>
				)}
			</div>

			<div className="space-y-2">
				<Label>Review notes (optional)</Label>
				<Textarea
					value={reviewNotes}
					onChange={(e) => setReviewNotes(e.target.value)}
					placeholder="Notes visible on the transaction record…"
					rows={2}
				/>
			</div>

			<div className="flex justify-end">
				<Button
					disabled={changeStatus.isPending}
					onClick={() => applyStatus(status)}
				>
					{changeStatus.isPending ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						"Update status"
					)}
				</Button>
			</div>
		</div>
	);
}
