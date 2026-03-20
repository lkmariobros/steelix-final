"use client";

import { toast } from "sonner";
import { trpc } from "@/utils/trpc";
import type { Lead } from "./lead-models";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { RiLoader4Line } from "@remixicon/react";

export function DeleteLeadDialog({
	lead,
	open,
	onClose,
	onSuccess,
}: {
	lead: Lead | null;
	open: boolean;
	onClose: () => void;
	onSuccess: () => void;
}) {
	const deleteMutation = trpc.adminLeads.delete.useMutation({
		onSuccess: () => {
			toast.success("Lead deleted");
			onSuccess();
			onClose();
		},
		onError: (e) => toast.error(e.message),
	});

	if (!lead) return null;

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete Lead</DialogTitle>
					<DialogDescription>
						Are you sure you want to delete <strong>{lead.name}</strong>? This
						action cannot be undone and will also remove all notes.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						variant="destructive"
						disabled={deleteMutation.isPending}
						onClick={() => deleteMutation.mutate({ id: lead.id })}
					>
						{deleteMutation.isPending && (
							<RiLoader4Line className="mr-1 size-4 animate-spin" />
						)}
						Delete Lead
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

