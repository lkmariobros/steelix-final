"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";
import { FollowerSelector } from "@/components/follower-selector";
import { useTransactionModalActions } from "@/contexts/transaction-modal-context";
import { stashTransactionPrefillOnce } from "@/features/sales-entry/prefill-stash";
import {
	type ActivityEventType,
	type Lead,
	formatLeadId,
	getLeadDisplayTags,
	withCurrentAssigneeOption,
} from "./lead-models";
import {
	ACTIVITY_CONFIG,
	PIPELINE_STAGES,
	type PipelineStageValue,
} from "./lead-constants";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/sheet";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
	RiHistoryLine,
	RiLoader4Line,
	RiStickyNoteLine,
	RiUserLine,
} from "@remixicon/react";
import { StageBadge, ActivityEventIcon, StatusBadge } from "./lead-ui";
import { LeadTasksCard } from "./lead-tasks-card";
import { LeadContactInfoCard } from "./lead-contact-info-card";

export function LeadDetailSheet({
	lead,
	open,
	onClose,
	agents,
	onRefresh,
}: {
	lead: Lead | null;
	open: boolean;
	onClose: () => void;
	agents: Array<{
		agentId: string;
		agentName: string | null;
		agentEmail: string;
	}>;
	onRefresh: () => void;
}) {
	const queryClient = useQueryClient();
	const { openCreateModal } = useTransactionModalActions();

	const [showNoteInput, setShowNoteInput] = useState(false);
	const [inputContent, setInputContent] = useState("");
	const [newStage, setNewStage] = useState<string>("");
	const [assignAgentId, setAssignAgentId] = useState<string>("");
	const [followerIds, setFollowerIds] = useState<string[]>([]);

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: [["adminLeads", "get"]] });
		queryClient.invalidateQueries({
			queryKey: [["adminLeads", "getTimeline"]],
		});
	};

	const { data: detail, isLoading } = trpc.adminLeads.get.useQuery(
		{ id: lead?.id ?? "" },
		{ enabled: !!lead?.id && open, staleTime: 0 },
	);

	const { data: timeline, isLoading: timelineLoading } =
		trpc.adminLeads.getTimeline.useQuery(
			{ leadId: lead?.id ?? "" },
			{ enabled: !!lead?.id && open, staleTime: 0 },
		);

	const addNoteMutation = trpc.adminLeads.addNote.useMutation({
		onSuccess: () => {
			toast.success("Note added");
			setInputContent("");
			setShowNoteInput(false);
			invalidate();
		},
		onError: (e) => toast.error(e.message),
	});

	const updateStageMutation = trpc.adminLeads.update.useMutation({
		onSuccess: () => {
			toast.success("Stage updated");
			onRefresh();
			invalidate();
		},
		onError: (e) => toast.error(e.message),
	});

	const assignMutation = trpc.adminLeads.assign.useMutation({
		onSuccess: () => {
			toast.success("Lead reassigned");
			onRefresh();
			invalidate();
		},
		onError: (e) => toast.error(e.message),
	});

	const setFollowersMutation = trpc.adminLeads.setFollowers.useMutation({
		onSuccess: () => {
			toast.success("Followers updated");
			onRefresh();
			invalidate();
		},
		onError: (e) => toast.error(e.message),
	});

	const assignAgentOptions = useMemo(() => {
		const current = detail?.lead ?? lead;
		return withCurrentAssigneeOption(agents, {
			agentId: current?.agentId ?? null,
			agentName: current?.agentName ?? null,
			agentEmail: current?.agentEmail ?? null,
		});
	}, [agents, lead, detail?.lead]);

	useEffect(() => {
		const current = detail?.lead ?? lead;
		setFollowerIds(current?.followerIds ?? []);
	}, [detail?.lead, lead]);

	if (!lead) return null;

	const activeLead = (detail?.lead ?? lead) as Lead;
	const displayTags = getLeadDisplayTags(activeLead);
	const displayNotes =
		activeLead.notes?.trim() ||
		detail?.notes?.[0]?.content?.trim() ||
		null;

	const formatDateTime = (d: Date | string) => {
		try {
			const dt = new Date(d);
			return dt.toLocaleString(undefined, {
				month: "short",
				day: "numeric",
				year: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			});
		} catch {
			return "—";
		}
	};

	const handleSubmitNote = () => {
		if (!inputContent.trim() || !lead) return;
		addNoteMutation.mutate({ leadId: lead.id, content: inputContent.trim() });
	};

	const handleConvertToTransaction = () => {
		if (activeLead.stage !== "booking_made") return;
		stashTransactionPrefillOnce({
			clientData: {
				name: activeLead.name,
				icNo: "",
				email: activeLead.email ?? "",
				phone: activeLead.phone,
				address: activeLead.property || "",
				type: activeLead.type === "tenant" ? "tenant" : "buyer",
				source: activeLead.source,
				notes: displayNotes ?? "",
			},
			propertyData: {
				address: activeLead.property || "",
				propertyType: activeLead.projectName || "Property",
				price: 0,
				description: displayTags.join(", "),
			},
		});
		openCreateModal();
		toast.success("Transaction form opened with lead details.");
	};

	const isSubmitting = addNoteMutation.isPending;

	return (
		<Sheet open={open} onOpenChange={(v) => !v && onClose()}>
			<SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
				<SheetHeader className="mb-4 pr-8">
					<SheetTitle className="flex items-center gap-2">
						<RiUserLine size={20} />
						{activeLead.name}
					</SheetTitle>
					<SheetDescription>
						Lead details, activity timeline, and management actions
					</SheetDescription>
				</SheetHeader>

				{isLoading && !detail ? (
					<div className="flex items-center justify-center py-12">
						<RiLoader4Line className="size-6 animate-spin text-muted-foreground" />
					</div>
				) : (
					<div className="space-y-6">
						<LeadContactInfoCard
							lead={{
								status: activeLead.status,
								email: activeLead.email,
								phone: activeLead.phone,
								source: activeLead.source,
								leadType: activeLead.leadType,
								tagNames: activeLead.tagNames,
								tags: activeLead.tags,
								property: activeLead.property,
								notesSummary: displayNotes,
								createdAt: activeLead.createdAt,
								agentName: activeLead.agentName,
							}}
							showDescription={false}
							showNotes={false}
						/>

						{/* Pipeline Stage */}
						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-sm">Pipeline Stage</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								<StageBadge stage={activeLead.stage} />
								<div className="flex gap-2">
									<Select
										value={newStage || activeLead.stage}
										onValueChange={setNewStage}
									>
										<SelectTrigger className="flex-1">
											<SelectValue placeholder="Change stage…" />
										</SelectTrigger>
										<SelectContent>
											{PIPELINE_STAGES.map((s) => (
												<SelectItem key={s.value} value={s.value}>
													{s.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<Button
										size="sm"
										disabled={
											!newStage ||
											newStage === activeLead.stage ||
											updateStageMutation.isPending
										}
										onClick={() =>
											updateStageMutation.mutate({
												id: lead.id,
												stage: newStage as PipelineStageValue,
											})
										}
									>
										{updateStageMutation.isPending ? (
											<RiLoader4Line className="size-4 animate-spin" />
										) : (
											"Update"
										)}
									</Button>
								</div>
								{activeLead.stage === "booking_made" ? (
									<Button
										size="sm"
										variant="secondary"
										onClick={handleConvertToTransaction}
									>
										Convert to Transaction
									</Button>
								) : null}
							</CardContent>
						</Card>

						{/* Assign to Agent */}
						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-sm">Assign to Agent</CardTitle>
							</CardHeader>
							<CardContent className="flex gap-2">
								<Select
									value={assignAgentId || activeLead.agentId || "__unassigned__"}
									onValueChange={setAssignAgentId}
								>
									<SelectTrigger className="flex-1">
										<SelectValue placeholder="Select agent…" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="__unassigned__">— Unassigned —</SelectItem>
										{assignAgentOptions.map((a) => (
											<SelectItem key={a.agentId} value={a.agentId}>
												{a.agentName ?? a.agentEmail}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Button
									size="sm"
									disabled={
										!assignAgentId ||
										assignAgentId === (activeLead.agentId ?? "__unassigned__") ||
										assignMutation.isPending
									}
									onClick={() =>
										assignMutation.mutate({
											id: lead.id,
											agentId:
												assignAgentId === "__unassigned__"
													? null
													: assignAgentId,
										})
									}
								>
									{assignMutation.isPending ? (
										<RiLoader4Line className="size-4 animate-spin" />
									) : (
										"Assign"
									)}
								</Button>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-sm">Followers</CardTitle>
								<CardDescription className="text-xs">
									Sales leaders can follow leads to track team activity
								</CardDescription>
							</CardHeader>
							<CardContent className="flex gap-2">
								<FollowerSelector
									value={followerIds}
									onChange={setFollowerIds}
									agents={agents}
									className="flex-1"
								/>
								<Button
									size="sm"
									disabled={
										setFollowersMutation.isPending ||
										JSON.stringify(followerIds) ===
											JSON.stringify(activeLead.followerIds ?? [])
									}
									onClick={() =>
										setFollowersMutation.mutate({
											id: lead.id,
											followerIds,
										})
									}
								>
									{setFollowersMutation.isPending ? (
										<RiLoader4Line className="size-4 animate-spin" />
									) : (
										"Save"
									)}
								</Button>
							</CardContent>
						</Card>

						{/* ── Tasks & Follow-ups ── */}
						<LeadTasksCard leadId={lead.id} />

						{/* ── Activity Timeline ── */}
						<Card>
							<CardHeader className="pb-3">
								<div className="flex items-center justify-between">
									<CardTitle className="flex items-center gap-2 text-sm">
										<RiHistoryLine className="size-4" />
										Activity Timeline
									</CardTitle>
									{timeline && timeline.length > 0 && (
										<span className="text-muted-foreground text-xs">
											{timeline.length} event
											{timeline.length !== 1 ? "s" : ""}
										</span>
									)}
								</div>
								<CardDescription className="text-xs">
									Every touchpoint with this lead, newest first
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<Button
									size="sm"
									variant={showNoteInput ? "default" : "outline"}
									className="h-8 gap-1.5 text-xs"
									onClick={() => setShowNoteInput((v) => !v)}
								>
									<RiStickyNoteLine className="size-3.5" />
									Add Note
								</Button>

								{showNoteInput && (
									<div className="space-y-2 rounded-md border bg-muted/30 p-3">
										<p className="font-medium text-xs">Note</p>
										<Textarea
											placeholder="Add a note about this lead…"
											value={inputContent}
											onChange={(e) => setInputContent(e.target.value)}
											rows={3}
											className="resize-none bg-background"
											autoFocus
										/>
										<div className="flex gap-2">
											<Button
												size="sm"
												disabled={!inputContent.trim() || isSubmitting}
												onClick={handleSubmitNote}
											>
												{isSubmitting ? (
													<RiLoader4Line className="mr-1 size-4 animate-spin" />
												) : null}
												Save Note
											</Button>
											<Button
												size="sm"
												variant="ghost"
												onClick={() => {
													setShowNoteInput(false);
													setInputContent("");
												}}
											>
												Cancel
											</Button>
										</div>
									</div>
								)}

								{/* Timeline feed */}
								{timelineLoading ? (
									<div className="space-y-3 pt-1">
										{[1, 2, 3].map((i) => (
											<div key={i} className="flex gap-3">
												<Skeleton className="mt-0.5 size-7 shrink-0 rounded-full" />
												<div className="flex-1 space-y-1.5 pt-1">
													<Skeleton className="h-3.5 w-28 rounded" />
													<Skeleton className="h-3 w-48 rounded" />
													<Skeleton className="h-3 w-20 rounded" />
												</div>
											</div>
										))}
									</div>
								) : timeline && timeline.length > 0 ? (
									<div className="relative">
										{/* Vertical connector line — sits behind dots */}
										<div className="absolute top-3.5 bottom-3.5 left-3.5 w-px bg-gradient-to-b from-border via-border/60 to-transparent" />
										<div className="space-y-1">
											{timeline.map((event, idx) => {
												const cfg =
													ACTIVITY_CONFIG[
														event.eventType as ActivityEventType
													] ?? ACTIVITY_CONFIG.lead_updated;
												const isLast = idx === timeline.length - 1;
												return (
													<div
														key={event.id}
														className="relative flex gap-3"
													>
														{/* Dot */}
														<div
															className={`relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-background shadow-sm ${cfg.dotColor}`}
														>
															<span className="text-white [&>svg]:size-3">
																{cfg.icon}
															</span>
														</div>
														{/* Content bubble */}
														<div
															className={`flex-1 rounded-lg border bg-muted/20 px-3 py-2 ${isLast ? "mb-0" : "mb-1"}`}
														>
															<div className="flex flex-wrap items-center gap-2">
																<ActivityEventIcon
																	type={event.eventType as ActivityEventType}
																/>
																<span className="text-muted-foreground text-xs">
																	by{" "}
																	<span className="font-medium text-foreground">
																		{event.actorName}
																	</span>
																</span>
																<span className="ml-auto shrink-0 text-muted-foreground text-xs">
																	{formatDateTime(event.createdAt)}
																</span>
															</div>
															{event.content && (
																<p className="mt-1.5 break-words whitespace-pre-line text-foreground/90 text-sm leading-relaxed">
																	{event.content}
																</p>
															)}
														</div>
													</div>
												);
											})}
										</div>
									</div>
								) : (
									<div className="flex flex-col items-center gap-2 py-8 text-center">
										<RiHistoryLine className="size-8 text-muted-foreground/40" />
										<p className="text-muted-foreground text-sm">
											No activity yet
										</p>
										<p className="text-muted-foreground text-xs">
											Add a note, log a call, or change the stage to start the
											timeline
										</p>
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				)}
			</SheetContent>
		</Sheet>
	);
}

