"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type React from "react";
import type { Lead } from "./lead-models";
import { PIPELINE_STAGES, type PipelineStageValue } from "./lead-constants";
import { StatusBadge } from "./lead-ui";
import { trpc } from "@/utils/trpc";
import { useHorizontalBoardScroll } from "@/hooks/use-horizontal-board-scroll";
import { cn } from "@/lib/utils";

/** Soft column tints — inspired by the reference board, brand-safe (no purple-first look). */
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

export function KanbanPipelineBoard({
	leads,
	onViewLead,
	onRefresh,
}: {
	leads: Lead[];
	onViewLead: (lead: Lead) => void;
	onRefresh: () => void;
}) {
	const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
	const [dragOverStage, setDragOverStage] = useState<string | null>(null);
	const [optimisticStages, setOptimisticStages] = useState<
		Record<string, { stage: PipelineStageValue; updatedAt: Date }>
	>({});
	const dragStartedRef = useRef(false);
	const { ref: boardScrollRef, boardScrollProps } = useHorizontalBoardScroll();

	const parseDateToMs = (d: Date | string | null | undefined) => {
		if (!d) return null;
		const dt = new Date(d);
		const ms = dt.getTime();
		return Number.isNaN(ms) ? null : ms;
	};

	const effectiveLeads = useMemo(() => {
		if (Object.keys(optimisticStages).length === 0) return leads;
		return leads.map((lead) => {
			const upd = optimisticStages[lead.id];
			if (!upd) return lead;
			return {
				...lead,
				stage: upd.stage,
				updatedAt: upd.updatedAt,
			};
		});
	}, [leads, optimisticStages]);

	const leadsByStage = useMemo(() => {
		const m = new Map<string, Lead[]>();
		for (const lead of effectiveLeads) {
			const stage = lead.stage ?? "new_lead";
			const arr = m.get(stage) ?? [];
			arr.push(lead);
			m.set(stage, arr);
		}

		// Sort inside each stage for better pipeline flow.
		// 1) nextContact (earliest first, nulls at the end)
		// 2) updatedAt (newest first)
		for (const [stage, arr] of m.entries()) {
			arr.sort((a, b) => {
				const aNext = parseDateToMs(a.nextContact);
				const bNext = parseDateToMs(b.nextContact);

				if (aNext !== null && bNext === null) return -1;
				if (aNext === null && bNext !== null) return 1;
				if (aNext !== null && bNext !== null && aNext !== bNext) return aNext - bNext;

				const aUpdated = parseDateToMs(a.updatedAt) ?? 0;
				const bUpdated = parseDateToMs(b.updatedAt) ?? 0;
				return bUpdated - aUpdated;
			});
			m.set(stage, arr);
		}

		return m;
	}, [effectiveLeads]);

	const unknownStages = useMemo(() => {
		const known = new Set<string>(PIPELINE_STAGES.map((s) => s.value));
		const stages = Array.from(leadsByStage.keys()).filter((s) => !known.has(s));
		return stages.sort();
	}, [leadsByStage]);

	const stageByLeadId = useMemo(() => {
		const m = new Map<string, string>();
		for (const l of leads) m.set(l.id, l.stage);
		return m;
	}, [leads]);

	// Clear optimistic overrides once the server state catches up.
	useEffect(() => {
		setOptimisticStages((prev) => {
			const ids = Object.keys(prev);
			if (ids.length === 0) return prev;

			let changed = false;
			const next = { ...prev };
			for (const [leadId, override] of Object.entries(prev)) {
				const actualStage = stageByLeadId.get(leadId);
				if (actualStage === override.stage) {
					delete next[leadId];
					changed = true;
				}
			}
			return changed ? next : prev;
		});
	}, [stageByLeadId]);

	const updateStageMutation = trpc.adminLeads.update.useMutation();

	const setDragOver = (stage: string) =>
		setDragOverStage((prev) => (prev === stage ? prev : stage));

	const handleDragStart = (e: React.DragEvent, lead: Lead) => {
		if (updateStageMutation.isPending) return;
		dragStartedRef.current = true;
		setDraggingLeadId(lead.id);
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", lead.id);
		e.dataTransfer.setData("text/leadId", lead.id);
	};

	const handleDragEnd = () => {
		setDraggingLeadId(null);
		setDragOverStage(null);
		dragStartedRef.current = false;
	};

	const handleDrop = (e: React.DragEvent, stage: PipelineStageValue) => {
		if (updateStageMutation.isPending) return;
		e.preventDefault();
		e.stopPropagation();
		const leadId =
			e.dataTransfer.getData("text/leadId") ||
			e.dataTransfer.getData("text/plain");
		if (!leadId) return;

		const currentStage =
			optimisticStages[leadId]?.stage ?? stageByLeadId.get(leadId);
		if (currentStage === stage) {
			setDragOverStage(null);
			setDraggingLeadId(null);
			dragStartedRef.current = false;
			return;
		}

		// Move instantly (optimistic UI), then sync with backend.
		setOptimisticStages((prev) => ({
			...prev,
			[leadId]: { stage, updatedAt: new Date() },
		}));
		setDragOverStage(null);

		updateStageMutation.mutate(
			{ id: leadId, stage },
			{
				onSuccess: () => {
					toast.success("Stage updated");
					setDraggingLeadId(null);
					setDragOverStage(null);
					dragStartedRef.current = false;
					onRefresh();
				},
				onError: (err) => {
					toast.error(err.message);
					setOptimisticStages((prev) => {
						if (!prev[leadId]) return prev;
						const next = { ...prev };
						delete next[leadId];
						return next;
					});
					setDraggingLeadId(null);
					setDragOverStage(null);
					dragStartedRef.current = false;
				},
			},
		);
	};

	return (
		<div
			ref={boardScrollRef}
			{...boardScrollProps}
			className={cn(
				boardScrollProps.className,
				// Cap height so the horizontal scrollbar stays at the bottom of the
				// visible board (not below a tall column list).
				"h-[min(75vh,calc(100dvh-13rem))] w-full overflow-y-hidden",
			)}
		>
			<div className="flex h-full min-w-max items-stretch gap-3 pb-1">
				{PIPELINE_STAGES.map((stage) => {
					const columnLeads = leadsByStage.get(stage.value) ?? [];
					const isOver = dragOverStage === stage.value;
					const style = COLUMN_STYLE[stage.value] ?? DEFAULT_COLUMN_STYLE;

					return (
						<div
							key={stage.value}
							className={cn(
								"flex h-full w-[280px] min-w-[280px] shrink-0 flex-col rounded-2xl p-3 transition-all sm:w-[300px] sm:min-w-[300px]",
								style.column,
								isOver &&
									"ring-2 ring-primary/45 ring-offset-2 ring-offset-background",
							)}
							onDragOver={(e) => {
								if (updateStageMutation.isPending) return;
								e.preventDefault();
								e.stopPropagation();
								e.dataTransfer.dropEffect = "move";
								setDragOver(stage.value);
							}}
							onDragEnter={(e) => {
								if (updateStageMutation.isPending) return;
								e.preventDefault();
								e.stopPropagation();
								setDragOver(stage.value);
							}}
							onDragLeave={(e) => {
								const related = e.relatedTarget as Node | null;
								if (related && e.currentTarget.contains(related)) return;
								setDragOverStage((prev) =>
									prev === stage.value ? null : prev,
								);
							}}
							onDrop={(e) => handleDrop(e, stage.value as PipelineStageValue)}
						>
							<div className="mb-3 flex shrink-0 items-center justify-between gap-2 px-0.5">
								<div className="flex min-w-0 items-center gap-2">
									<span
										className={cn("size-2 shrink-0 rounded-full", style.accent)}
										aria-hidden
									/>
									<h3 className="truncate font-semibold text-foreground text-sm tracking-tight">
										{stage.label}
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
										{columnLeads.length}
									</span>
								</div>
							</div>

							<div
								className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain pr-0.5"
								onDragOver={(e) => {
									if (updateStageMutation.isPending) return;
									e.preventDefault();
									e.stopPropagation();
									e.dataTransfer.dropEffect = "move";
									setDragOver(stage.value);
								}}
								onDrop={(e) =>
									handleDrop(e, stage.value as PipelineStageValue)
								}
							>
								{columnLeads.length === 0 ? (
									<div className="rounded-xl border border-dashed border-border/60 bg-background/50 px-3 py-6 text-center text-muted-foreground text-xs">
										{isOver ? "Release to move here" : "No leads in this stage"}
									</div>
								) : (
									columnLeads.map((lead) => (
										<button
											key={lead.id}
											type="button"
											draggable={!updateStageMutation.isPending}
											onDragStart={(e) => handleDragStart(e, lead)}
											onDragEnd={handleDragEnd}
											className={cn(
												"w-full select-none rounded-xl border border-border/40 bg-card p-3.5 text-left shadow-sm transition-all",
												"hover:border-border/70 hover:shadow-md",
												updateStageMutation.isPending
													? "cursor-not-allowed opacity-60"
													: "cursor-grab active:cursor-grabbing",
												draggingLeadId === lead.id && "opacity-50 shadow-none",
											)}
											onClick={() => {
												if (
													dragStartedRef.current ||
													updateStageMutation.isPending
												) {
													dragStartedRef.current = false;
													return;
												}
												onViewLead(lead);
											}}
											title={`${lead.name}\n${lead.email}\n${lead.source}\n${lead.agentName ?? "Unassigned"}`}
										>
											<div className="min-w-0 space-y-2.5">
												<p className="line-clamp-2 font-semibold text-foreground text-sm leading-snug">
													{lead.name}
												</p>
												<div className="flex items-center justify-between gap-2">
													<span className="min-w-0 truncate text-muted-foreground text-xs">
														{lead.agentName ?? "Unassigned"}
													</span>
													<StatusBadge status={lead.status} />
												</div>
											</div>
										</button>
									))
								)}
							</div>
						</div>
					);
				})}

				{unknownStages.length > 0 && (
					<div className="flex h-full w-[280px] shrink-0 flex-col rounded-2xl bg-muted/40 p-3 sm:w-[300px]">
						<div className="mb-3 flex shrink-0 items-center justify-between gap-2 px-0.5">
							<div className="flex items-center gap-2">
								<span className="size-2 rounded-full bg-muted-foreground" />
								<h3 className="font-semibold text-foreground text-sm">Other</h3>
							</div>
							<span className="inline-flex min-w-6 items-center justify-center rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground text-[11px] tabular-nums">
								{unknownStages.reduce(
									(sum, s) => sum + (leadsByStage.get(s)?.length ?? 0),
									0,
								)}
							</span>
						</div>
						<div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto">
							{unknownStages.map((s) => (
								<div key={s} className="space-y-2.5">
									{(leadsByStage.get(s) ?? []).map((lead) => (
										<button
											key={lead.id}
											type="button"
											draggable={!updateStageMutation.isPending}
											onDragStart={(e) => handleDragStart(e, lead)}
											onDragEnd={handleDragEnd}
											className={cn(
												"w-full select-none rounded-xl border border-border/40 bg-card p-3.5 text-left shadow-sm transition-all",
												"hover:border-border/70 hover:shadow-md",
												updateStageMutation.isPending
													? "cursor-not-allowed opacity-60"
													: "cursor-grab active:cursor-grabbing",
											)}
											onClick={() => {
												if (
													dragStartedRef.current ||
													updateStageMutation.isPending
												) {
													dragStartedRef.current = false;
													return;
												}
												onViewLead(lead);
											}}
											title={`${lead.name}\n${lead.email}\n${lead.source}\n${lead.agentName ?? "Unassigned"}`}
										>
											<div className="min-w-0 space-y-2.5">
												<p className="line-clamp-2 font-semibold text-foreground text-sm leading-snug">
													{lead.name}
												</p>
												<div className="flex items-center justify-between gap-2">
													<span className="min-w-0 truncate text-muted-foreground text-xs">
														{lead.agentName ?? "Unassigned"}
													</span>
													<StatusBadge status={lead.status} />
												</div>
											</div>
										</button>
									))}
								</div>
							))}
							<p className="text-muted-foreground text-xs italic">
								Drop only supports configured pipeline stages
							</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

