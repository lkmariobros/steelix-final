"use client";

import { useState } from "react";
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
import { PIPELINE_STAGES, type PipelineStageValue } from "./lead-constants";

export function BulkStageDialog({
	selectedIds,
	open,
	onClose,
	onSuccess,
}: {
	selectedIds: string[];
	open: boolean;
	onClose: () => void;
	onSuccess: () => void;
}) {
	const [stage, setStage] = useState("");

	const bulkMutation = trpc.adminLeads.bulkUpdateStage.useMutation({
		onSuccess: (data) => {
			toast.success(`Updated ${data.updated} lead(s)`);
			setStage("");
			onSuccess();
			onClose();
		},
		onError: (e) => toast.error(e.message),
	});

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Bulk Update Stage</DialogTitle>
					<DialogDescription>
						Move {selectedIds.length} selected lead(s) to a new pipeline stage.
					</DialogDescription>
				</DialogHeader>
				<Select value={stage} onValueChange={setStage}>
					<SelectTrigger>
						<SelectValue placeholder="Select new stage…" />
					</SelectTrigger>
					<SelectContent>
						{PIPELINE_STAGES.map((s) => (
							<SelectItem key={s.value} value={s.value}>
								{s.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={!stage || bulkMutation.isPending}
						onClick={() =>
							bulkMutation.mutate({
								ids: selectedIds,
								stage: stage as PipelineStageValue,
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

