"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";
import { FollowerSelector } from "@/components/follower-selector";
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

type FollowerMode = "replace" | "add" | "remove";

export function BulkFollowersDialog({
	selectedIds,
	agents,
	open,
	onClose,
	onSuccess,
}: {
	selectedIds: string[];
	agents: Array<{
		agentId: string;
		agentName: string | null;
		agentEmail: string;
	}>;
	open: boolean;
	onClose: () => void;
	onSuccess: () => void;
}) {
	const [mode, setMode] = useState<FollowerMode>("add");
	const [followerIds, setFollowerIds] = useState<string[]>([]);

	const bulkMutation = trpc.adminLeads.bulkSetFollowers.useMutation({
		onSuccess: (data) => {
			toast.success(`Updated followers on ${data.updated} lead(s)`);
			setMode("add");
			setFollowerIds([]);
			onSuccess();
			onClose();
		},
		onError: (e) => toast.error(e.message),
	});

	const canApply = mode === "replace" || followerIds.length > 0;

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				if (!v) onClose();
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Bulk Edit Lead Followers</DialogTitle>
					<DialogDescription>
						Update followers for {selectedIds.length} selected lead(s).
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-1">
					<div className="space-y-2">
						<Label>Action</Label>
						<Select
							value={mode}
							onValueChange={(v) => setMode(v as FollowerMode)}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="replace">
									Replace — set followers to exactly these
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
							{mode === "remove" ? "Followers to remove" : "Followers"}
						</Label>
						<FollowerSelector
							value={followerIds}
							onChange={setFollowerIds}
							agents={agents}
							placeholder={
								mode === "replace"
									? "Select followers (leave empty to clear all)…"
									: "Select followers…"
							}
						/>
						{mode === "replace" && (
							<p className="text-muted-foreground text-xs">
								Leave empty to remove all followers from the selected leads.
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
								followerIds,
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
