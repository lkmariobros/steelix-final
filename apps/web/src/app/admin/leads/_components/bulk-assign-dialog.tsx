"use client";

import { useMemo, useState } from "react";
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { RiLoader4Line } from "@remixicon/react";

export function BulkAssignDialog({
	selectedIds,
	open,
	onClose,
	onSuccess,
	agents,
}: {
	selectedIds: string[];
	open: boolean;
	onClose: () => void;
	onSuccess: () => void;
	agents: Array<{
		agentId: string;
		agentName: string | null;
		agentEmail: string;
	}>;
}) {
	const [agentId, setAgentId] = useState<string>("__unassigned__");

	const items = useMemo(
		() =>
			agents.map((a) => ({
				value: a.agentId,
				label: a.agentName ?? a.agentEmail,
			})),
		[agents],
	);

	const bulkMutation = trpc.adminLeads.bulkAssign.useMutation({
		onSuccess: (data) => {
			toast.success(`Re-assigned ${data.updated} lead(s)`);
			onSuccess();
			onClose();
		},
		onError: (e) => toast.error(e.message),
	});

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				if (!v) onClose();
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Bulk Re-assign Agent</DialogTitle>
					<DialogDescription>
						Assign {selectedIds.length} selected lead(s) to an agent (or unassign).
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-2">
					<Select value={agentId} onValueChange={setAgentId}>
						<SelectTrigger>
							<SelectValue placeholder="Select agent…" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="__unassigned__">— Unassigned —</SelectItem>
							{items.map((a) => (
								<SelectItem key={a.value} value={a.value}>
									{a.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={bulkMutation.isPending || selectedIds.length === 0}
						onClick={() =>
							bulkMutation.mutate({
								ids: selectedIds,
								agentId: agentId === "__unassigned__" ? null : agentId,
							})
						}
					>
						{bulkMutation.isPending && (
							<RiLoader4Line className="mr-1 size-4 animate-spin" />
						)}
						Apply
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

