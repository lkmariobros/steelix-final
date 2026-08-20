"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	PIPELINE_STAGES as SHARED_PIPELINE_STAGES,
	type PipelineStageValue,
} from "@/app/admin/leads/_components/lead-constants";
import { StatusBadge } from "@/app/admin/leads/_components/lead-ui";
import { useHorizontalBoardScroll } from "@/hooks/use-horizontal-board-scroll";
import { cn } from "@/lib/utils";
import { RiEyeLine, RiPhoneLine } from "@remixicon/react";

export type PipelineStage = PipelineStageValue;

interface Prospect {
	id: string;
	name: string;
	email: string | null;
	phone: string;
	whatsappUsername?: string | null;
	source: string;
	type: "tenant" | "buyer";
	property: string;
	status: "active" | "inactive" | "pending";
	stage: PipelineStage;
	leadType: "personal" | "company";
	tags: string | null;
	tagIds?: string[];
	tagNames?: string[];
	agentName?: string | null;
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
	leadsTab?: "my" | "company";
}

/** Soft column tints — same palette as admin KanbanPipelineBoard. */
const COLUMN_STYLE: Record<
	string,
	{ column: string; accent: string; count: string }
> = {
	new_lead: {
		column: "bg-[#eef4f8] dark:bg-sky-950/35",
		accent: "bg-sky-500",
		count: "bg-sky-500/15 text-sky-800 dark:text-sky-300",
	},
	first_follow_up: {
		column: "bg-[#f3f0f8] dark:bg-violet-950/30",
		accent: "bg-violet-500",
		count: "bg-violet-500/15 text-violet-800 dark:text-violet-300",
	},
	second_follow_up: {
		column: "bg-[#f5f2ec] dark:bg-amber-950/30",
		accent: "bg-amber-500",
		count: "bg-amber-500/15 text-amber-900 dark:text-amber-300",
	},
	third_follow_up: {
		column: "bg-[#f7f0ea] dark:bg-orange-950/30",
		accent: "bg-orange-500",
		count: "bg-orange-500/15 text-orange-900 dark:text-orange-300",
	},
	fourth_follow_up: {
		column: "bg-[#eef2f6] dark:bg-slate-900/50",
		accent: "bg-slate-500",
		count: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
	},
	potential_lead: {
		column: "bg-[#eaf4f3] dark:bg-teal-950/35",
		accent: "bg-[#2a6b73]",
		count: "bg-primary/15 text-primary",
	},
	appointment_made: {
		column: "bg-[#eaf3f8] dark:bg-cyan-950/30",
		accent: "bg-cyan-600",
		count: "bg-cyan-500/15 text-cyan-900 dark:text-cyan-300",
	},
	need_consider: {
		column: "bg-[#f3f4f6] dark:bg-zinc-900/50",
		accent: "bg-zinc-500",
		count: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300",
	},
	reject_project: {
		column: "bg-[#f8eeee] dark:bg-rose-950/30",
		accent: "bg-rose-500",
		count: "bg-rose-500/15 text-rose-800 dark:text-rose-300",
	},
	booking_made: {
		column: "bg-[#eaf6f0] dark:bg-emerald-950/30",
		accent: "bg-emerald-500",
		count: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
	},
	spam_fake_lead: {
		column: "bg-[#f1f1f1] dark:bg-neutral-900/50",
		accent: "bg-neutral-500",
		count: "bg-neutral-500/15 text-neutral-700 dark:text-neutral-300",
	},
};

const DEFAULT_COLUMN_STYLE = {
	column: "bg-muted/40",
	accent: "bg-muted-foreground",
	count: "bg-muted text-muted-foreground",
};

const PIPELINE_STAGES: Array<{ id: PipelineStage }> = SHARED_PIPELINE_STAGES.map(
	(s) => ({ id: s.value }),
);

export function KanbanBoard({
	prospects,
	onView,
	onStageChange,
	onClaimLead,
	leadsTab = "my",
}: KanbanBoardProps) {
	const [draggedProspect, setDraggedProspect] = useState<Prospect | null>(null);
	const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(
		null,
	);
	const [optimisticUpdates, setOptimisticUpdates] = useState<
		Map<string, PipelineStage>
	>(new Map());
	const { ref: boardScrollRef, boardScrollProps } = useHorizontalBoardScroll();

	const mergedProspects = prospects.map((p) => {
		const optimisticStage = optimisticUpdates.get(p.id);
		return optimisticStage ? { ...p, stage: optimisticStage } : p;
	});

	const prospectsByStage = PIPELINE_STAGES.reduce(
		(acc, stage) => {
			acc[stage.id] = mergedProspects.filter((p) => p.stage === stage.id);
			return acc;
		},
		{} as Record<PipelineStage, Prospect[]>,
	);

	useEffect(() => {
		setOptimisticUpdates((prev) => {
			const next = new Map(prev);
			let changed = false;

			for (const [id, optimisticStage] of next) {
				const serverProspect = prospects.find((p) => p.id === id);
				if (serverProspect && serverProspect.stage === optimisticStage) {
					next.delete(id);
					changed = true;
				}
			}

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
		e.dataTransfer.setData("text/plain", prospect.id);
		e.dataTransfer.setData("text/prospectId", prospect.id);
	};

	const handleDragOver = (e: React.DragEvent, stage?: PipelineStage) => {
		e.preventDefault();
		e.stopPropagation();
		e.dataTransfer.dropEffect = "move";
		if (stage) setDragOverStage(stage);
	};

	const handleDrop = (e: React.DragEvent, targetStage: PipelineStage) => {
		e.preventDefault();
		e.stopPropagation();
		const fromData =
			e.dataTransfer.getData("text/prospectId") ||
			e.dataTransfer.getData("text/plain");
		const prospect =
			draggedProspect ??
			(fromData ? (prospects.find((p) => p.id === fromData) ?? null) : null);
		if (!prospect) {
			setDraggedProspect(null);
			setDragOverStage(null);
			return;
		}
		const currentStage = optimisticUpdates.get(prospect.id) ?? prospect.stage;
		if (currentStage !== targetStage) {
			setOptimisticUpdates((prev) => {
				const next = new Map(prev);
				next.set(prospect.id, targetStage);
				return next;
			});
			onStageChange(prospect.id, targetStage);
		}
		setDraggedProspect(null);
		setDragOverStage(null);
	};

	const handleDragEnd = () => {
		setDraggedProspect(null);
		setDragOverStage(null);
	};

	const tagSummary = (prospect: Prospect) => {
		const names =
			prospect.tagNames && prospect.tagNames.length > 0
				? prospect.tagNames
				: prospect.tags
					? prospect.tags
							.split(",")
							.map((t) => t.trim())
							.filter(Boolean)
					: [];
		return names.length > 0 ? names : null;
	};

	return (
		<div
			ref={boardScrollRef}
			{...boardScrollProps}
			className={cn(
				boardScrollProps.className,
				"h-[min(75vh,calc(100dvh-13rem))] w-full overflow-y-hidden",
			)}
		>
			<div className="flex h-full min-w-max items-stretch gap-3 pb-1">
				{PIPELINE_STAGES.map((stage) => {
					const stageProspects = prospectsByStage[stage.id] || [];
					const stageLabel =
						SHARED_PIPELINE_STAGES.find((s) => s.value === stage.id)?.label ??
						stage.id;
					const style = COLUMN_STYLE[stage.id] ?? DEFAULT_COLUMN_STYLE;
					const isOver = dragOverStage === stage.id;

					return (
						<div
							key={stage.id}
							className={cn(
								"flex h-full w-[280px] min-w-[280px] shrink-0 flex-col rounded-2xl p-3 transition-all sm:w-[300px] sm:min-w-[300px]",
								style.column,
								isOver &&
									"ring-2 ring-primary/45 ring-offset-2 ring-offset-background",
							)}
							onDragOver={(e) => handleDragOver(e, stage.id)}
							onDragLeave={(e) => {
								const related = e.relatedTarget as Node | null;
								if (related && e.currentTarget.contains(related)) return;
								setDragOverStage((prev) => (prev === stage.id ? null : prev));
							}}
							onDrop={(e) => handleDrop(e, stage.id)}
						>
							<div className="mb-3 flex shrink-0 items-center justify-between gap-2 px-0.5">
								<div className="flex min-w-0 items-center gap-2">
									<span
										className={cn("size-2 shrink-0 rounded-full", style.accent)}
										aria-hidden
									/>
									<h3 className="truncate font-semibold text-foreground text-sm tracking-tight">
										{stageLabel}
									</h3>
								</div>
								<div className="flex shrink-0 items-center gap-1.5">
									{isOver ? (
										<span className="font-medium text-primary text-xs">
											Drop
										</span>
									) : null}
									<span
										className={cn(
											"inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 font-semibold text-[11px] tabular-nums",
											style.count,
										)}
									>
										{stageProspects.length}
									</span>
								</div>
							</div>

							<div
								className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain pr-0.5"
								onDragOver={(e) => handleDragOver(e, stage.id)}
								onDrop={(e) => handleDrop(e, stage.id)}
							>
								{stageProspects.length === 0 ? (
									<div className="rounded-xl border border-dashed border-border/60 bg-background/50 px-3 py-6 text-center text-muted-foreground text-xs">
										{isOver ? "Release to move here" : "No leads in this stage"}
									</div>
								) : (
									stageProspects.map((prospect) => {
										const tags = tagSummary(prospect);
										const canClaim =
											leadsTab === "company" &&
											prospect.leadType === "company" &&
											!prospect.agentId &&
											!!onClaimLead;

										return (
											<div
												key={prospect.id}
												draggable
												title={`${prospect.name}\n${prospect.email ?? ""}\n${prospect.phone}`}
												onDragStart={(e) => handleDragStart(e, prospect)}
												onDragEnd={handleDragEnd}
												className={cn(
													"w-full select-none rounded-xl border border-border/40 bg-card p-3.5 text-left shadow-sm transition-all",
													"hover:border-border/70 hover:shadow-md",
													"cursor-grab active:cursor-grabbing",
													draggedProspect?.id === prospect.id &&
														"opacity-50 shadow-none",
												)}
											>
												<div className="min-w-0 space-y-2.5">
													<div className="flex items-start justify-between gap-2">
														<p className="line-clamp-2 font-semibold text-foreground text-sm leading-snug">
															{prospect.name}
														</p>
														{leadsTab === "company" &&
														prospect.leadType === "company" &&
														!prospect.agentId ? (
															<span className="inline-flex shrink-0 rounded-full bg-primary/12 px-2 py-0.5 font-medium text-[10px] text-primary">
																Co.
															</span>
														) : null}
													</div>

													<p className="truncate text-muted-foreground text-xs">
														<span className="inline-flex items-center gap-1">
															<RiPhoneLine className="size-3 shrink-0 opacity-70" />
															{prospect.phone?.trim() ||
																(prospect.whatsappUsername
																	? `@${String(prospect.whatsappUsername).replace(/^@/, "")}`
																	: "—")}
														</span>
													</p>

													<div className="flex items-center justify-between gap-2">
														<span className="min-w-0 truncate text-muted-foreground text-xs">
															{prospect.agentName ?? "Unassigned"}
														</span>
														<StatusBadge status={prospect.status} />
													</div>

													{tags ? (
														<div className="flex flex-wrap gap-1">
															{tags.slice(0, 3).map((tag) => (
																<span
																	key={tag}
																	className="inline-flex rounded-full bg-muted px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground"
																>
																	{tag}
																</span>
															))}
															{tags.length > 3 ? (
																<span className="text-[10px] text-muted-foreground">
																	+{tags.length - 3}
																</span>
															) : null}
														</div>
													) : null}

													<div className="flex items-center gap-1.5 border-border/50 border-t pt-2">
														{canClaim ? (
															<Button
																size="sm"
																variant="secondary"
																className="h-7 flex-1 rounded-full px-2 text-xs"
																title="Assign this company lead to yourself"
																onClick={(e) => {
																	e.stopPropagation();
																	onClaimLead?.(prospect.id);
																}}
															>
																Claim Lead
															</Button>
														) : null}
														<Button
															size="sm"
															variant="outline"
															className={cn(
																"h-7 rounded-full border-border/60 px-2.5 text-xs",
																canClaim ? "shrink-0" : "flex-1",
															)}
															onClick={(e) => {
																e.stopPropagation();
																onView(prospect);
															}}
														>
															<RiEyeLine className="size-3.5" />
															<span className={canClaim ? "sr-only" : "ml-1"}>
																View
															</span>
														</Button>
													</div>
												</div>
											</div>
										);
									})
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
