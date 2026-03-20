"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type React from "react";
import type { Lead } from "./lead-models";
import { PIPELINE_STAGES, type PipelineStageValue } from "./lead-constants";
import { StageBadge, StatusBadge } from "./lead-ui";
import { Card } from "@/components/ui/card";
import { trpc } from "@/utils/trpc";

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
	const dragStartedRef = useRef(false);
	// Optimistic stage updates so cards move immediately without waiting for refetch.
	const [optimisticStages, setOptimisticStages] = useState<
		Record<string, { stage: PipelineStageValue; updatedAt: Date }>
	>({});

	const parseDateToMs = (d: Date | string | null | undefined) => {
		if (!d) return null;
		const dt = new Date(d);
		const ms = dt.getTime();
		return Number.isNaN(ms) ? null : ms;
	};

	const formatDate = (d: Date | string | null | undefined) => {
		const ms = parseDateToMs(d);
		if (!ms) return "—";
		return new Date(ms).toLocaleDateString();
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
		const leadId = e.dataTransfer.getData("text/leadId");
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
		<div className="w-full overflow-x-auto">
			<div className="flex min-w-max gap-3 pb-2">
				{PIPELINE_STAGES.map((stage) => {
					const columnLeads = leadsByStage.get(stage.value) ?? [];
					const isOver = dragOverStage === stage.value;

					return (
						<div
							key={stage.value}
							className={[
								"flex w-[340px] flex-col gap-2 rounded-lg border bg-muted/10 p-2",
								isOver ? "border-primary/60 bg-primary/5" : "border-border/60",
							].join(" ")}
							onDragOver={(e) => {
								if (updateStageMutation.isPending) return;
								e.preventDefault();
								setDragOver(stage.value);
							}}
							onDragEnter={(e) => {
								if (updateStageMutation.isPending) return;
								e.preventDefault();
								setDragOver(stage.value);
							}}
							onDragLeave={() => setDragOverStage(null)}
							onDrop={(e) => handleDrop(e, stage.value as PipelineStageValue)}
						>
							<div className="flex items-center justify-between gap-2 px-1 pt-1">
								<div className="flex items-center gap-2">
									<StageBadge stage={stage.value} />
									<span className="text-muted-foreground text-xs">
										{columnLeads.length}{" "}
										{columnLeads.length === 1 ? "lead" : "leads"}
									</span>
								</div>
								{isOver ? (
									<span className="text-primary text-xs font-medium">Drop</span>
								) : null}
							</div>

							<div className="flex flex-col gap-2">
								{columnLeads.length === 0 ? (
									<div className="px-1 text-muted-foreground text-xs italic">
										{isOver ? "Release to move here" : "No leads in this stage"}
									</div>
								) : (
									columnLeads.map((lead) => (
										<Card
											key={lead.id}
											draggable={!updateStageMutation.isPending}
											onDragStart={(e) => handleDragStart(e, lead)}
											onDragEnd={handleDragEnd}
											className={[
												"select-none p-3",
												updateStageMutation.isPending
													? "cursor-not-allowed opacity-60"
													: "cursor-grab",
												draggingLeadId === lead.id
													? "opacity-60"
													: "hover:bg-muted/40",
											].join(" ")}
											onClick={() => {
												if (dragStartedRef.current || updateStageMutation.isPending) {
													dragStartedRef.current = false;
													return;
												}
												onViewLead(lead);
											}}
											title={`${lead.name}\n${lead.email}\n${lead.property}`}
										>
											<div className="flex items-start justify-between gap-3">
												<div className="text-[11px] text-muted-foreground">
													{lead.nextContact ? (
														<span>
															Next:{" "}
															<span className="font-medium text-foreground">
																{formatDate(lead.nextContact)}
															</span>
														</span>
													) : (
														<span>Next: —</span>
													)}
												</div>

												<StatusBadge status={lead.status} />
											</div>

											<div className="mt-2 space-y-1">
												<div className="font-medium text-sm leading-tight">
													{lead.name}
												</div>
												<div className="text-muted-foreground text-xs truncate">
													{lead.email}
												</div>
												<div className="text-muted-foreground text-xs truncate">
													{lead.property}
												</div>
												<div className="text-muted-foreground text-[11px] truncate">
													Owner:{" "}
													<span className="text-foreground/90">
														{lead.agentName ? lead.agentName : "Unassigned"}
													</span>
												</div>
											</div>
										</Card>
									))
								)}
							</div>
						</div>
					);
				})}

				{unknownStages.length > 0 && (
					<div
						className="flex w-[340px] flex-col gap-2 rounded-lg border bg-muted/10 p-2"
						onDragOver={(e) => {
							if (updateStageMutation.isPending) return;
							e.preventDefault();
						}}
					>
						<div className="flex items-center justify-between gap-2">
							<span className="text-sm font-medium">Other</span>
							<span className="text-muted-foreground text-xs">
								{unknownStages.reduce(
									(sum, s) => sum + (leadsByStage.get(s)?.length ?? 0),
									0,
								)}
							</span>
						</div>
						{unknownStages.map((s) => (
							<div key={s} className="space-y-2">
								{(leadsByStage.get(s) ?? []).map((lead) => (
									<Card
										key={lead.id}
												draggable={!updateStageMutation.isPending}
												onDragStart={(e) => handleDragStart(e, lead)}
												onDragEnd={handleDragEnd}
												className={[
													"select-none p-3",
													updateStageMutation.isPending
														? "cursor-not-allowed opacity-60"
														: "cursor-grab",
													"hover:bg-muted/40",
												].join(" ")}
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
												title={`${lead.name}\n${lead.email}\n${lead.property}`}
									>
										<div className="flex items-start justify-between gap-3">
													<div className="text-[11px] text-muted-foreground">
														{lead.nextContact ? (
															<span>
																Next:{" "}
																<span className="font-medium text-foreground">
																	{formatDate(lead.nextContact)}
																</span>
															</span>
														) : (
															<span>Next: —</span>
														)}
													</div>
											<StatusBadge status={lead.status} />
										</div>
										<div className="mt-2 space-y-1">
											<div className="font-medium text-sm leading-tight">
												{lead.name}
											</div>
													<div className="text-muted-foreground text-xs truncate">
												{lead.email}
											</div>
											<div className="text-muted-foreground text-xs truncate">
												{lead.property}
											</div>
													<div className="text-muted-foreground text-[11px] truncate">
														Owner:{" "}
														<span className="text-foreground/90">
															{lead.agentName ? lead.agentName : "Unassigned"}
														</span>
													</div>
										</div>
									</Card>
								))}
							</div>
						))}
						<div className="text-muted-foreground text-xs italic">
							Drop only supports configured pipeline stages
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

