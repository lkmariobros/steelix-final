"use client";

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
import { RiLoader4Line } from "@remixicon/react";

export function BulkDeleteDialog({
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
	const bulkDelete = trpc.adminLeads.bulkDelete.useMutation({
		onSuccess: (data) => {
			toast.success(`Deleted ${data.deleted} lead(s)`);
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
					<DialogTitle>Bulk Delete Leads</DialogTitle>
					<DialogDescription>
						You are about to delete{" "}
						<strong>{selectedIds.length}</strong> lead(s). This action cannot be
						undone.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={onClose}
						disabled={bulkDelete.isPending}
					>
						Cancel
					</Button>
					<Button
						variant="destructive"
						disabled={bulkDelete.isPending || selectedIds.length === 0}
						onClick={() => bulkDelete.mutate({ ids: selectedIds })}
					>
						{bulkDelete.isPending && (
							<RiLoader4Line className="mr-1 size-4 animate-spin" />
						)}
						Delete
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

