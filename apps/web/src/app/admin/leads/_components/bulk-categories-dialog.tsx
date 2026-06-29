"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";
import { TagSelector } from "@/components/tag-selector";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { RiLoader4Line } from "@remixicon/react";

type CategoryMode = "replace" | "add" | "remove";

export function BulkCategoriesDialog({
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
	const [mode, setMode] = useState<CategoryMode>("add");
	const [tagIds, setTagIds] = useState<string[]>([]);

	const bulkMutation = trpc.adminLeads.bulkUpdateCategories.useMutation({
		onSuccess: (data) => {
			toast.success(`Updated categories on ${data.updated} lead(s)`);
			setMode("add");
			setTagIds([]);
			onSuccess();
			onClose();
		},
		onError: (e) => toast.error(e.message),
	});

	const canApply =
		mode === "replace" || tagIds.length > 0;

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				if (!v) onClose();
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Bulk Edit Lead Categories</DialogTitle>
					<DialogDescription>
						Update categories for {selectedIds.length} selected lead(s).
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-1">
					<div className="space-y-2">
						<Label>Action</Label>
						<Select
							value={mode}
							onValueChange={(v) => setMode(v as CategoryMode)}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="replace">
									Replace — set categories to exactly these
								</SelectItem>
								<SelectItem value="add">
									Add — keep existing and add selected
								</SelectItem>
								<SelectItem value="remove">
									Remove — remove selected from leads
								</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label>
							{mode === "remove" ? "Categories to remove" : "Categories"}
						</Label>
						<TagSelector
							value={tagIds}
							onChange={setTagIds}
							placeholder={
								mode === "replace"
									? "Select categories (leave empty to clear all)…"
									: "Select categories…"
							}
						/>
						{mode === "replace" && (
							<p className="text-muted-foreground text-xs">
								Leave empty to remove all categories from the selected leads.
							</p>
						)}
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={
							!canApply || bulkMutation.isPending || selectedIds.length === 0
						}
						onClick={() =>
							bulkMutation.mutate({
								ids: selectedIds,
								tagIds,
								mode,
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
