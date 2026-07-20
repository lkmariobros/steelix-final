"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";
import { FollowerSelector } from "@/components/follower-selector";
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	RiAddLine,
	RiCloseLine,
	RiLoader4Line,
} from "@remixicon/react";
import { PIPELINE_STAGES, type PipelineStageValue } from "./lead-constants";

type BulkField = "stage" | "owner" | "categories" | "followers";
type MergeMode = "replace" | "add" | "remove";

const FIELD_OPTIONS: Array<{ id: BulkField; label: string }> = [
	{ id: "stage", label: "Stage" },
	{ id: "owner", label: "Owner" },
	{ id: "categories", label: "Categories" },
	{ id: "followers", label: "Followers" },
];

type AgentOption = {
	agentId: string;
	agentName: string | null;
	agentEmail: string;
};

export function BulkEditDialog({
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
	agents: AgentOption[];
}) {
	const [activeFields, setActiveFields] = useState<BulkField[]>([
		"stage",
		"owner",
	]);
	const [stage, setStage] = useState("");
	const [agentId, setAgentId] = useState<string>("");
	const [categoryMode, setCategoryMode] = useState<MergeMode>("replace");
	const [tagIds, setTagIds] = useState<string[]>([]);
	const [followerMode, setFollowerMode] = useState<MergeMode>("replace");
	const [followerIds, setFollowerIds] = useState<string[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const utils = trpc.useUtils();
	const stageMutation = trpc.adminLeads.bulkUpdateStage.useMutation();
	const assignMutation = trpc.adminLeads.bulkAssign.useMutation();
	const categoriesMutation = trpc.adminLeads.bulkUpdateCategories.useMutation();
	const followersMutation = trpc.adminLeads.bulkSetFollowers.useMutation();

	const agentItems = useMemo(
		() =>
			agents.map((a) => ({
				value: a.agentId,
				label: a.agentName ?? a.agentEmail,
			})),
		[agents],
	);

	const availableToAdd = FIELD_OPTIONS.filter(
		(f) => !activeFields.includes(f.id),
	);

	const resetForm = () => {
		setActiveFields(["stage", "owner"]);
		setStage("");
		setAgentId("");
		setCategoryMode("replace");
		setTagIds([]);
		setFollowerMode("replace");
		setFollowerIds([]);
	};

	useEffect(() => {
		if (!open) resetForm();
	}, [open]);

	const removeField = (field: BulkField) => {
		setActiveFields((prev) => prev.filter((f) => f !== field));
		if (field === "stage") setStage("");
		if (field === "owner") setAgentId("");
		if (field === "categories") {
			setCategoryMode("replace");
			setTagIds([]);
		}
		if (field === "followers") {
			setFollowerMode("replace");
			setFollowerIds([]);
		}
	};

	const addField = (field: BulkField) => {
		setActiveFields((prev) =>
			prev.includes(field) ? prev : [...prev, field],
		);
	};

	const stageReady = !activeFields.includes("stage") || Boolean(stage);
	const ownerReady = !activeFields.includes("owner") || Boolean(agentId);
	const categoriesReady =
		!activeFields.includes("categories") ||
		categoryMode === "replace" ||
		tagIds.length > 0;
	const followersReady =
		!activeFields.includes("followers") ||
		followerMode === "replace" ||
		followerIds.length > 0;

	const canApply =
		selectedIds.length > 0 &&
		activeFields.length > 0 &&
		stageReady &&
		ownerReady &&
		categoriesReady &&
		followersReady &&
		!isSubmitting;

	const handleClose = () => {
		if (isSubmitting) return;
		onClose();
	};

	const handleApply = async () => {
		if (!canApply) return;
		setIsSubmitting(true);
		const applied: string[] = [];

		try {
			if (activeFields.includes("stage") && stage) {
				const result = await stageMutation.mutateAsync({
					ids: selectedIds,
					stage: stage as PipelineStageValue,
				});
				applied.push(`stage (${result.updated})`);
			}
			if (activeFields.includes("owner") && agentId) {
				const result = await assignMutation.mutateAsync({
					ids: selectedIds,
					agentId: agentId === "__unassigned__" ? null : agentId,
				});
				applied.push(`owner (${result.updated})`);
			}
			if (activeFields.includes("categories")) {
				const result = await categoriesMutation.mutateAsync({
					ids: selectedIds,
					tagIds,
					mode: categoryMode,
				});
				applied.push(`categories (${result.updated})`);
			}
			if (activeFields.includes("followers")) {
				const result = await followersMutation.mutateAsync({
					ids: selectedIds,
					followerIds,
					mode: followerMode,
				});
				applied.push(`followers (${result.updated})`);
			}

			await utils.adminLeads.list.invalidate();
			toast.success(
				`Updated ${selectedIds.length} lead(s): ${applied.join(", ")}`,
			);
			onSuccess();
			onClose();
		} catch (e) {
			const message = e instanceof Error ? e.message : "Bulk edit failed";
			toast.error(message);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Bulk edit</DialogTitle>
					<DialogDescription>
						Update one or more fields for {selectedIds.length} selected
						lead(s). Remove a field to skip it.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-1">
					{activeFields.includes("stage") && (
						<div className="space-y-2 rounded-md border p-3">
							<div className="flex items-center justify-between gap-2">
								<Label>
									Stage <span className="text-destructive">*</span>
								</Label>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-7 w-7 p-0 text-muted-foreground"
									onClick={() => removeField("stage")}
									title="Remove field"
								>
									<RiCloseLine className="size-4" />
								</Button>
							</div>
							<Select value={stage || undefined} onValueChange={setStage}>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Select stage…" />
								</SelectTrigger>
								<SelectContent>
									{PIPELINE_STAGES.map((s) => (
										<SelectItem key={s.value} value={s.value}>
											{s.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}

					{activeFields.includes("owner") && (
						<div className="space-y-2 rounded-md border p-3">
							<div className="flex items-center justify-between gap-2">
								<Label>
									Owner <span className="text-destructive">*</span>
								</Label>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-7 w-7 p-0 text-muted-foreground"
									onClick={() => removeField("owner")}
									title="Remove field"
								>
									<RiCloseLine className="size-4" />
								</Button>
							</div>
							<Select
								value={agentId || undefined}
								onValueChange={setAgentId}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Select owner…" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="__unassigned__">— Unassigned —</SelectItem>
									{agentItems.map((a) => (
										<SelectItem key={a.value} value={a.value}>
											{a.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}

					{activeFields.includes("categories") && (
						<div className="space-y-2 rounded-md border p-3">
							<div className="flex items-center justify-between gap-2">
								<Label>Categories</Label>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-7 w-7 p-0 text-muted-foreground"
									onClick={() => removeField("categories")}
									title="Remove field"
								>
									<RiCloseLine className="size-4" />
								</Button>
							</div>
							<Select
								value={categoryMode}
								onValueChange={(v) => setCategoryMode(v as MergeMode)}
							>
								<SelectTrigger className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="replace">
										Replace — set to exactly these
									</SelectItem>
									<SelectItem value="add">
										Add — keep existing and add selected
									</SelectItem>
									<SelectItem value="remove">
										Remove — remove selected from leads
									</SelectItem>
								</SelectContent>
							</Select>
							<TagSelector
								value={tagIds}
								onChange={setTagIds}
								placeholder={
									categoryMode === "replace"
										? "Select categories (leave empty to clear all)…"
										: "Select categories…"
								}
							/>
						</div>
					)}

					{activeFields.includes("followers") && (
						<div className="space-y-2 rounded-md border p-3">
							<div className="flex items-center justify-between gap-2">
								<Label>Followers</Label>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-7 w-7 p-0 text-muted-foreground"
									onClick={() => removeField("followers")}
									title="Remove field"
								>
									<RiCloseLine className="size-4" />
								</Button>
							</div>
							<Select
								value={followerMode}
								onValueChange={(v) => setFollowerMode(v as MergeMode)}
							>
								<SelectTrigger className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="replace">
										Replace — set to exactly these
									</SelectItem>
									<SelectItem value="add">
										Add — keep existing and add selected
									</SelectItem>
									<SelectItem value="remove">
										Remove — remove selected from leads
									</SelectItem>
								</SelectContent>
							</Select>
							<FollowerSelector
								value={followerIds}
								onChange={setFollowerIds}
								agents={agents}
								placeholder={
									followerMode === "replace"
										? "Select followers (leave empty to clear all)…"
										: "Select followers…"
								}
							/>
							{followerMode === "replace" && (
								<p className="text-muted-foreground text-xs">
									This will replace the existing followers of the selected
									leads.
								</p>
							)}
						</div>
					)}

					{availableToAdd.length > 0 && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button type="button" variant="outline" size="sm" className="h-8">
									<RiAddLine className="mr-1.5 size-4" />
									Add field
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start">
								{availableToAdd.map((f) => (
									<DropdownMenuItem
										key={f.id}
										onSelect={() => addField(f.id)}
									>
										{f.label}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					)}

					{activeFields.length === 0 && (
						<p className="text-muted-foreground text-sm">
							Add at least one field to update.
						</p>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
						Cancel
					</Button>
					<Button disabled={!canApply} onClick={() => void handleApply()}>
						{isSubmitting && (
							<RiLoader4Line className="mr-1 size-4 animate-spin" />
						)}
						Apply
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
