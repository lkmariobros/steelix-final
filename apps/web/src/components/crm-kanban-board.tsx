"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	RiUserLine,
	RiPhoneLine,
	RiMailLine,
	RiPriceTagLine,
	RiEyeLine,
	RiMessageLine,
	RiCheckboxCircleLine,
	RiCloseCircleLine,
} from "@remixicon/react";
// Pipeline stages type (shared)
export type PipelineStage = "prospect" | "outreach" | "discovery" | "proposal" | "negotiation" | "closed_won" | "closed_lost";

interface Prospect {
	id: string;
	name: string;
	email: string;
	phone: string;
	source: string;
	type: "tenant" | "owner";
	property: "property_developer" | "secondary_market_owner";
	status: "active" | "inactive" | "pending";
	stage: PipelineStage;
	leadType: "personal" | "company";
	tags: string | null;
	lastContact: Date | string | null;
	nextContact: Date | string | null;
	agentId: string | null;
	createdAt: Date | string;
	updatedAt: Date | string;
}

interface KanbanBoardProps {
	prospects: Prospect[];
	onView: (prospect: Prospect) => void;
	onMessage: (prospect: Prospect) => void;
	onStageChange: (prospectId: string, newStage: PipelineStage) => void;
	onClaimLead?: (prospectId: string) => void;
}

// Pipeline stages configuration
const PIPELINE_STAGES: Array<{
	id: PipelineStage;
	label: string;
	color: string;
}> = [
	{ id: "prospect", label: "Prospect", color: "bg-blue-100 dark:bg-blue-900/30" },
	{ id: "outreach", label: "Outreach", color: "bg-yellow-100 dark:bg-yellow-900/30" },
	{ id: "discovery", label: "Discovery", color: "bg-purple-100 dark:bg-purple-900/30" },
	{ id: "proposal", label: "Proposal", color: "bg-orange-100 dark:bg-orange-900/30" },
	{ id: "negotiation", label: "Negotiation", color: "bg-pink-100 dark:bg-pink-900/30" },
	{ id: "closed_won", label: "Closed Won", color: "bg-green-100 dark:bg-green-900/30" },
	{ id: "closed_lost", label: "Closed Lost", color: "bg-red-100 dark:bg-red-900/30" },
];

export function KanbanBoard({
	prospects,
	onView,
	onMessage,
	onStageChange,
	onClaimLead,
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

	return (
		<div className="flex gap-4 overflow-x-auto pb-4">
			{PIPELINE_STAGES.map((stage) => {
				const stageProspects = prospectsByStage[stage.id] || [];
				return (
					<div
						key={stage.id}
						className="flex-shrink-0 w-80"
						onDragOver={handleDragOver}
						onDrop={(e) => handleDrop(e, stage.id)}
					>
						{/* Column Header */}
						<div
							className={`${stage.color} rounded-lg p-3 mb-3 border border-border`}
						>
							<div className="flex items-center justify-between">
								<h3 className="font-semibold text-sm">{stage.label}</h3>
								<Badge variant="secondary" className="text-xs">
									{stageProspects.length}
								</Badge>
							</div>
						</div>

						{/* Column Content */}
						<div className="space-y-3 min-h-[400px]">
							{stageProspects.map((prospect) => (
								<Card
									key={prospect.id}
									draggable
									onDragStart={(e) => handleDragStart(e, prospect)}
									onDragEnd={handleDragEnd}
									className={`cursor-move hover:shadow-md transition-shadow ${
										draggedProspect?.id === prospect.id ? "opacity-50" : ""
									}`}
								>
									<CardContent className="p-4">
										{/* Lead Type Badge */}
										<div className="flex items-center justify-between mb-2">
											{prospect.leadType === "company" && !prospect.agentId ? (
												<Badge variant="outline" className="text-xs border-purple-500 text-purple-600 dark:text-purple-400">
													Company Lead
												</Badge>
											) : (
												<Badge variant="outline" className="text-xs border-blue-500 text-blue-600 dark:text-blue-400">
													Personal
												</Badge>
											)}
											{prospect.leadType === "company" && !prospect.agentId && onClaimLead && (
												<Button
													size="sm"
													variant="outline"
													className="h-6 text-xs"
													onClick={() => onClaimLead(prospect.id)}
												>
													Claim
												</Button>
											)}
										</div>

										{/* Prospect Name */}
										<h4 className="font-semibold text-sm mb-2">{prospect.name}</h4>

										{/* Contact Info */}
										<div className="space-y-1 mb-3 text-xs text-muted-foreground">
											<div className="flex items-center gap-1.5">
												<RiPhoneLine className="size-3" />
												<span>{prospect.phone}</span>
											</div>
											<div className="flex items-center gap-1.5">
												<RiMailLine className="size-3" />
												<span className="truncate">{prospect.email}</span>
											</div>
										</div>

										{/* Tags */}
										{prospect.tags && (
											<div className="flex flex-wrap gap-1 mb-3">
												{prospect.tags.split(",").map((tag, idx) => (
													<Badge
														key={idx}
														variant="secondary"
														className="text-xs"
													>
														{tag.trim()}
													</Badge>
												))}
											</div>
										)}

										{/* Actions */}
										<div className="flex items-center gap-2 pt-2 border-t">
											<Button
												size="sm"
												variant="ghost"
												className="h-7 text-xs flex-1"
												onClick={() => onView(prospect)}
											>
												<RiEyeLine className="size-3 mr-1" />
												View
											</Button>
											<Button
												size="sm"
												variant="ghost"
												className="h-7 text-xs flex-1"
												onClick={() => onMessage(prospect)}
											>
												<RiMessageLine className="size-3 mr-1" />
												Message
											</Button>
										</div>
									</CardContent>
								</Card>
							))}

							{/* Empty State */}
							{stageProspects.length === 0 && (
								<div className="flex items-center justify-center h-32 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
									No prospects
								</div>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}
