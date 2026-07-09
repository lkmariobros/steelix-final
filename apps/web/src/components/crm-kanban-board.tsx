"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	RiPhoneLine,
	RiEyeLine,
} from "@remixicon/react";
import {
	PIPELINE_STAGES as SHARED_PIPELINE_STAGES,
	type PipelineStageValue,
} from "@/app/admin/leads/_components/lead-constants";
import { StatusBadge } from "@/app/admin/leads/_components/lead-ui";

export type PipelineStage = PipelineStageValue;

interface Prospect {
	id: string;
	name: string;
	email: string | null;
	phone: string;
	source: string;
	type: "tenant" | "buyer";
	property: string; // Free text field
	status: "active" | "inactive" | "pending";
	stage: PipelineStage;
	leadType: "personal" | "company";
	tags: string | null; // Old: Comma-separated tags (kept for backward compatibility)
	tagIds?: string[]; // New: Array of tag IDs (optional for backward compatibility)
	tagNames?: string[]; // New: Array of tag names (optional for backward compatibility)
	agentName?: string | null; // Agent name
	lastContact: Date | string | null;
	nextContact: Date | string | null;
	agentId: string | null;
	createdAt: Date | string;
	updatedAt: Date | string;
}

interface KanbanBoardProps {
	prospects: Prospect[];
	onView: (prospect: Prospect) => void;
	onStageChange: (prospectId: string, newStage: PipelineStage) => void;
	onClaimLead?: (prospectId: string) => void;
	/** Which leads tab is active — controls claim button and type badges */
	leadsTab?: "my" | "company";
}

const PIPELINE_STAGES: Array<{
	id: PipelineStage;
	label: string;
	color: string;
}> = SHARED_PIPELINE_STAGES.map((s) => ({
	id: s.value,
	label: s.label,
	color: `${s.color.split(" ").find((c) => c.startsWith("bg-")) ?? "bg-muted"} dark:bg-opacity-30`,
}));

export function KanbanBoard({
	prospects,
	onView,
	onStageChange,
	onClaimLead,
	leadsTab = "my",
}: KanbanBoardProps) {
	const [draggedProspect, setDraggedProspect] = useState<Prospect | null>(null);
	const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, PipelineStage>>(new Map());

	// Merge optimistic updates with actual prospects data
	const mergedProspects = prospects.map((p) => {
		const optimisticStage = optimisticUpdates.get(p.id);
		return optimisticStage ? { ...p, stage: optimisticStage } : p;
	});

	// Group prospects by stage (including optimistic updates)
	const prospectsByStage = PIPELINE_STAGES.reduce((acc, stage) => {
		acc[stage.id] = mergedProspects.filter((p) => p.stage === stage.id);
		return acc;
	}, {} as Record<PipelineStage, Prospect[]>);

	// Clean up optimistic updates when server data syncs
	// This ensures optimistic updates don't persist after the server has confirmed the change
	useEffect(() => {
		setOptimisticUpdates((prev) => {
			const next = new Map(prev);
			let changed = false;
			
			// Clear optimistic updates for prospects whose stage matches server data
			for (const [id, optimisticStage] of next) {
				const serverProspect = prospects.find((p) => p.id === id);
				if (serverProspect && serverProspect.stage === optimisticStage) {
					// Server has confirmed the change, clear optimistic update
					next.delete(id);
					changed = true;
				}
			}
			
			// Also clear optimistic updates for prospects that no longer exist
			const prospectIds = new Set(prospects.map((p) => p.id));
			for (const [id] of next) {
				if (!prospectIds.has(id)) {
					next.delete(id);
					changed = true;
				}
			}
			
			return changed ? next : prev;
		});
	}, [prospects]);

	const handleDragStart = (e: React.DragEvent, prospect: Prospect) => {
		setDraggedProspect(prospect);
		e.dataTransfer.effectAllowed = "move";
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
	};

	const handleDrop = (e: React.DragEvent, targetStage: PipelineStage) => {
		e.preventDefault();
		if (draggedProspect && draggedProspect.stage !== targetStage) {
			// Optimistically update UI immediately (before backend call)
			// This provides instant visual feedback while the mutation is in progress
			setOptimisticUpdates((prev) => {
				const next = new Map(prev);
				next.set(draggedProspect.id, targetStage);
				return next;
			});

			// Call backend mutation (which will also update query cache optimistically)
			onStageChange(draggedProspect.id, targetStage);

			// Clear optimistic update when query data updates (handled by query cache)
			// The optimistic update will be replaced by the actual data from the server
		}
		setDraggedProspect(null);
	};

	const handleDragEnd = () => {
		setDraggedProspect(null);
	};

	const tagSummary = (prospect: Prospect) => {
		const names =
			prospect.tagNames && prospect.tagNames.length > 0
				? prospect.tagNames
				: prospect.tags
					? prospect.tags.split(",").map((t) => t.trim()).filter(Boolean)
					: [];
		return names.length > 0 ? names : null;
	};

	return (
		<div className="flex gap-3 overflow-x-auto pb-3">
			{PIPELINE_STAGES.map((stage) => {
				const stageProspects = prospectsByStage[stage.id] || [];
				return (
					<div
						key={stage.id}
						className="w-72 shrink-0"
						onDragOver={handleDragOver}
						onDrop={(e) => handleDrop(e, stage.id)}
					>
						{/* Column Header */}
						<div className="mb-2 rounded-md border border-border bg-muted/20 px-2 py-2">
							<div className="flex items-center justify-between gap-2">
								<div className="flex min-w-0 items-center gap-2">
									<span
										aria-hidden="true"
										className={`${stage.color} size-2.5 shrink-0 rounded-sm`}
									/>
									<h3 className="min-w-0 truncate font-semibold text-foreground text-xs leading-tight">
										{stage.label}
									</h3>
								</div>
								<Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px] tabular-nums">
									{stageProspects.length}
								</Badge>
							</div>
						</div>

						{/* Column Content */}
						<div className="min-h-[320px] space-y-2">
							{stageProspects.map((prospect) => {
								const tags = tagSummary(prospect);
								const titleHint = `${prospect.name}\n${prospect.email ?? ""}\n${prospect.phone}`;
								return (
								<Card
									key={prospect.id}
									draggable
									title={titleHint}
									onDragStart={(e) => handleDragStart(e, prospect)}
									onDragEnd={handleDragEnd}
									className={`cursor-move transition-shadow hover:shadow-sm ${
										draggedProspect?.id === prospect.id ? "opacity-50" : ""
									}`}
								>
									<CardContent className="p-2.5">
										<div className="flex items-start justify-between gap-1.5">
											<h4 className="line-clamp-2 font-medium text-sm leading-snug">
												{prospect.name}
											</h4>
											{leadsTab === "company" &&
											prospect.leadType === "company" &&
											!prospect.agentId ? (
												<Badge
													variant="outline"
													className="h-5 shrink-0 border-purple-500/50 px-1 text-[10px] text-purple-700 dark:text-purple-300"
												>
													Co.
												</Badge>
											) : null}
										</div>

										<p className="mt-1 truncate text-muted-foreground text-[11px]">
											<span className="inline-flex items-center gap-1">
												<RiPhoneLine className="size-3 shrink-0 opacity-70" />
												{prospect.phone}
											</span>
										</p>

										<div className="mt-1 flex min-w-0 items-center gap-1">
											<StatusBadge status={prospect.status} />
										</div>

										{tags && (
											<div className="mt-1.5 flex flex-wrap gap-1">
												{tags.map((tag, idx) => (
													<Badge
														key={`${tag}-${idx}`}
														variant="secondary"
														className="h-auto whitespace-normal break-words px-1.5 py-0.5 text-[10px] font-normal leading-tight"
													>
														{tag}
													</Badge>
												))}
											</div>
										)}

										<div className="mt-2 flex items-center gap-1 border-border border-t pt-1.5">
											{leadsTab === "company" &&
											prospect.leadType === "company" &&
											!prospect.agentId &&
											onClaimLead && (
												<Button
													size="sm"
													variant="secondary"
													className="h-7 flex-1 px-2 text-xs"
													title="Assign this company lead to yourself"
													onClick={(e) => {
														e.stopPropagation();
														onClaimLead(prospect.id);
													}}
												>
													Claim Lead
												</Button>
											)}
											<Button
												size="sm"
												variant="ghost"
												className="h-7 flex-1 px-2 text-xs"
												onClick={() => onView(prospect)}
											>
												<RiEyeLine className="size-3.5" />
												<span className="sr-only">View</span>
											</Button>
										</div>
									</CardContent>
								</Card>
							);
							})}

							{/* Empty State */}
							{stageProspects.length === 0 && (
								<div className="flex h-24 items-center justify-center rounded-md border border-dashed text-muted-foreground text-xs">
									Empty
								</div>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}
