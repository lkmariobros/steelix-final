"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";
import type { ActivityEventType, Lead } from "./lead-models";
import {
	ACTIVITY_CONFIG,
	PIPELINE_STAGES,
	type PipelineStageValue,
} from "./lead-constants";
import { Badge } from "@/components/ui/badge";
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
	RiMailLine,
	RiPhoneLine,
	RiStickyNoteLine,
	RiUserLine,
} from "@remixicon/react";
import { StageBadge, StatusBadge, ActivityEventIcon } from "./lead-ui";
import { LeadTasksCard } from "./lead-tasks-card";

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

	// Input state for the three action types
	const [activeInput, setActiveInput] = useState<
		"note" | "call" | "email" | null
	>(null);
	const [inputContent, setInputContent] = useState("");
	const [newStage, setNewStage] = useState<string>("");
	const [assignAgentId, setAssignAgentId] = useState<string>("");

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
			setActiveInput(null);
			invalidate();
		},
		onError: (e) => toast.error(e.message),
	});

	const logCallMutation = trpc.adminLeads.logCall.useMutation({
		onSuccess: () => {
			toast.success("Call logged");
			setInputContent("");
			setActiveInput(null);
			invalidate();
			onRefresh();
		},
		onError: (e) => toast.error(e.message),
	});

	const logEmailMutation = trpc.adminLeads.logEmail.useMutation({
		onSuccess: () => {
			toast.success("Email logged");
			setInputContent("");
			setActiveInput(null);
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

	if (!lead) return null;

	const formatDate = (d: Date | string | null) => {
		if (!d) return "—";
		try {
			return new Date(d).toLocaleDateString();
		} catch {
			return "—";
		}
	};

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

	const handleSubmitAction = () => {
		if (!inputContent.trim() || !lead) return;
		if (activeInput === "note") {
			addNoteMutation.mutate({ leadId: lead.id, content: inputContent.trim() });
		} else if (activeInput === "call") {
			logCallMutation.mutate({ leadId: lead.id, content: inputContent.trim() });
		} else if (activeInput === "email") {
			logEmailMutation.mutate({
				leadId: lead.id,
				content: inputContent.trim(),
			});
		}
	};

	const isSubmitting =
		addNoteMutation.isPending ||
		logCallMutation.isPending ||
		logEmailMutation.isPending;

	const actionLabels: Record<"note" | "call" | "email", string> = {
		note: "Note",
		call: "Call Summary",
		email: "Email Summary",
	};

	const actionPlaceholders: Record<"note" | "call" | "email", string> = {
		note: "Add a note about this lead…",
		call: 'e.g. "Called John, interested in Unit 12A, will follow up Friday"',
		email: 'e.g. "Sent brochure for Breeze Hill — awaiting reply"',
	};

	return (
		<Sheet open={open} onOpenChange={(v) => !v && onClose()}>
			<SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
				<SheetHeader className="mb-4">
					<SheetTitle className="flex items-center gap-2">
						<RiUserLine size={20} />
						{lead.name}
					</SheetTitle>
					<SheetDescription>
						Lead details, activity timeline, and management actions
					</SheetDescription>
				</SheetHeader>

				{isLoading ? (
					<div className="flex items-center justify-center py-12">
						<RiLoader4Line className="size-6 animate-spin text-muted-foreground" />
					</div>
				) : (
					<div className="space-y-6">
						{/* Contact Info */}
						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-sm">Contact Info</CardTitle>
							</CardHeader>
							<CardContent className="grid grid-cols-2 gap-3 text-sm">
								<div>
									<span className="text-muted-foreground">Email</span>
									<p className="truncate font-medium">{lead.email}</p>
								</div>
								<div>
									<span className="text-muted-foreground">Phone</span>
									<p className="font-medium">{lead.phone}</p>
								</div>
								<div>
									<span className="text-muted-foreground">Source</span>
									<p className="font-medium">{lead.source}</p>
								</div>
								<div>
									<span className="text-muted-foreground">Type</span>
									<p className="font-medium capitalize">{lead.type}</p>
								</div>
								<div>
									<span className="text-muted-foreground">Property</span>
									<p className="font-medium">{lead.property}</p>
								</div>
								<div>
									<span className="text-muted-foreground">Lead Type</span>
									<p className="font-medium capitalize">{lead.leadType}</p>
								</div>
								<div>
									<span className="text-muted-foreground">Last Contact</span>
									<p className="font-medium">{formatDate(lead.lastContact)}</p>
								</div>
								<div>
									<span className="text-muted-foreground">Next Contact</span>
									<p className="font-medium">{formatDate(lead.nextContact)}</p>
								</div>
								<div>
									<span className="text-muted-foreground">Created</span>
									<p className="font-medium">{formatDate(lead.createdAt)}</p>
								</div>
								<div>
									<span className="text-muted-foreground">Assigned Agent</span>
									<p className="font-medium">
										{lead.agentName ?? "Unassigned"}
									</p>
								</div>
							</CardContent>
						</Card>

						{/* Pipeline Stage */}
						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-sm">Pipeline Stage</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="flex items-center gap-2">
									<StageBadge stage={lead.stage} />
									<StatusBadge status={lead.status} />
								</div>
								<div className="flex gap-2">
									<Select
										value={newStage || lead.stage}
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
											newStage === lead.stage ||
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
							</CardContent>
						</Card>

						{/* Assign to Agent */}
						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-sm">Assign to Agent</CardTitle>
							</CardHeader>
							<CardContent className="flex gap-2">
								<Select
									value={assignAgentId || lead.agentId || "__unassigned__"}
									onValueChange={setAssignAgentId}
								>
									<SelectTrigger className="flex-1">
										<SelectValue placeholder="Select agent…" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="__unassigned__">— Unassigned —</SelectItem>
										{agents.map((a) => (
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
										assignAgentId === (lead.agentId ?? "__unassigned__") ||
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

						{/* Tags */}
						{lead.tagNames.length > 0 && (
							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="text-sm">Tags</CardTitle>
								</CardHeader>
								<CardContent className="flex flex-wrap gap-1.5">
									{lead.tagNames.map((tag) => (
										<Badge key={tag} variant="secondary">
											{tag}
										</Badge>
									))}
								</CardContent>
							</Card>
						)}

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
								{/* Quick-log action buttons */}
								<div className="flex flex-wrap gap-2">
									<Button
										size="sm"
										variant={activeInput === "note" ? "default" : "outline"}
										className="h-8 gap-1.5 text-xs"
										onClick={() =>
											setActiveInput(activeInput === "note" ? null : "note")
										}
									>
										<RiStickyNoteLine className="size-3.5" />
										Add Note
									</Button>
									<Button
										size="sm"
										variant={activeInput === "call" ? "default" : "outline"}
										className="h-8 gap-1.5 text-xs"
										onClick={() =>
											setActiveInput(activeInput === "call" ? null : "call")
										}
									>
										<RiPhoneLine className="size-3.5" />
										Log Call
									</Button>
									<Button
										size="sm"
										variant={activeInput === "email" ? "default" : "outline"}
										className="h-8 gap-1.5 text-xs"
										onClick={() =>
											setActiveInput(activeInput === "email" ? null : "email")
										}
									>
										<RiMailLine className="size-3.5" />
										Log Email
									</Button>
								</div>

								{/* Expandable text input */}
								{activeInput && (
									<div className="space-y-2 rounded-md border bg-muted/30 p-3">
										<p className="font-medium text-xs">
											{actionLabels[activeInput]}
										</p>
										<Textarea
											placeholder={actionPlaceholders[activeInput]}
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
												onClick={handleSubmitAction}
											>
												{isSubmitting ? (
													<RiLoader4Line className="mr-1 size-4 animate-spin" />
												) : null}
												Save {actionLabels[activeInput]}
											</Button>
											<Button
												size="sm"
												variant="ghost"
												onClick={() => {
													setActiveInput(null);
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
																<p className="mt-1.5 whitespace-pre-line text-foreground/90 text-sm leading-relaxed">
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

