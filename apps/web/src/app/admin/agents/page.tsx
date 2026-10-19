"use client";

import { HeaderActions } from "@/components/header-actions";
import { Separator } from "@/components/separator";
import {
	SidebarTrigger,
} from "@/components/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/tooltip";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MetricCard } from "@/dashboards/admin/widgets/metric-card";
import { useUserRole } from "@/hooks/use-user-role";
import { accountRoleBadgeClass, formatAccountRole, isStaffAccountRole } from "@/lib/user-role";
import {
	agentStatusBadgeClass,
	formatAgentStatus,
	isPendingAgentStatus,
} from "@/lib/agent-status";
import { formatAgentPickerLabel } from "@/lib/agent-display";
import { formatDateDMY } from "@/lib/date-format";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
	RiAddLine,
	RiBuilding2Line,
	RiDashboardLine,
	RiEyeLine,
	RiRefreshLine,
	RiSearchLine,
	RiSettings3Line,
	RiTeamLine,
	RiUserLine,
} from "@remixicon/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// Agent Tier Management Components
import {
	AgentManagementDialog,
	AgentRoleDialog,
	AgentViewModal,
	TierBadge,
	TierDashboardWidget,
} from "@/components/agent-tier";
import type { AgentTier } from "@/lib/agent-tier-config";
import { CreateAgentAccountDialog } from "@/features/erecruitment/create-agent-account-dialog";

const actionBtnClass =
	"size-8 shrink-0 rounded-full border-0 bg-primary/12 p-0 text-primary shadow-none hover:bg-primary/20 hover:text-primary";

function agentInitials(name: string | null | undefined, email: string) {
	const source = (name?.trim() || email || "?").trim();
	const parts = source.split(/\s+/).filter(Boolean);
	if (parts.length >= 2) {
		return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
	}
	return source.slice(0, 2).toUpperCase();
}

// Type for agent data from the API
interface AgentData {
	id: string;
	name: string | null;
	nickName?: string | null;
	email: string;
	phone?: string | null;
	branch?: string | null;
	role: string | null;
	agentTier: string | null;
	companyCommissionSplit: number | null;
	primaryCommissionSplit?: number | null;
	createdAt: string | null;
	isActive?: boolean | null;
	agentCode?: string | null;
	agentStatus?: string | null;
	recruitedBy?: string | null;
}

type RecruiterInfo = {
	id: string;
	name: string | null;
	nickName?: string | null;
	agentCode?: string | null;
} | null;

type LinkedAccountInfo = {
	id: string;
	label: string;
	agentCode: string | null;
	isActive: boolean;
};

type AgentListItem = {
	agent: AgentData;
	recruiter?: RecruiterInfo;
	linkedAccounts?: LinkedAccountInfo[];
};

type AccountRoleFilter =
	| "all"
	| "agent"
	| "team_lead"
	| "admin"
	| "super_admin";

const AGENTS_PAGE_SIZE = 50;

export default function AdminAgentsPage() {
	const { session, isSuperAdmin, isAdmin } = useUserRole();
	const [roleFilter, setRoleFilter] = useState<AccountRoleFilter>("all");
	const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">(
		"all",
	);
	const [approvalFilter, setApprovalFilter] = useState<
		"all" | "pending_approval"
	>("all");
	const [searchQuery, setSearchQuery] = useState("");
	const debouncedSearch = useDebouncedValue(searchQuery, 300);
	const [listOffset, setListOffset] = useState(0);
	const [accumulatedAgents, setAccumulatedAgents] = useState<AgentListItem[]>(
		[],
	);

	// State for dialogs
	const [selectedAgent, setSelectedAgent] = useState<AgentData | null>(null);
	const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
	const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
	const [isViewModalOpen, setIsViewModalOpen] = useState(false);
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
	const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
	const [approveAgentId, setApproveAgentId] = useState<string | null>(null);
	const [approveAgentCode, setApproveAgentCode] = useState("");
	const [resetAgentId, setResetAgentId] = useState<string | null>(null);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [deleteAgent, setDeleteAgent] = useState<AgentData | null>(null);
	const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
	const [deleteConfirmText, setDeleteConfirmText] = useState("");

	const [resetPassword, setResetPassword] = useState("");

	// For invalidation after mutations
	const utils = trpc.useUtils();

	// Handlers for agent actions
	const handleManageAgent = (agent: AgentData) => {
		setSelectedAgent(agent);
		setIsManageDialogOpen(true);
	};

	const handleChangeRole = (agent: AgentData) => {
		setSelectedAgent(agent);
		setIsRoleDialogOpen(true);
	};

	const handleViewAgent = (agent: AgentData) => {
		setSelectedAgent(agent);
		setIsViewModalOpen(true);
	};

	const resetAgentList = () => {
		setListOffset(0);
		setAccumulatedAgents([]);
	};

	const setActiveMutation = trpc.agents.setActive.useMutation({
		onSuccess: () => {
			resetAgentList();
			utils.agents.list.invalidate();
			utils.agents.getStats.invalidate();
			utils.agents.getAccountSettings.invalidate();
		},
		onError: (e) => toast.error(e.message || "Failed to update agent status"),
	});

	const accountSettingsQuery = trpc.agents.getAccountSettings.useQuery(
		undefined,
		{ enabled: !!session },
	);
	const oneActiveAccountPerAgent =
		accountSettingsQuery.data?.oneActiveAccountPerAgent ?? false;
	const setOneActiveRuleMutation =
		trpc.agents.setOneActiveAccountPerAgent.useMutation({
			onSuccess: (result) => {
				utils.agents.getAccountSettings.setData(undefined, result);
				if (!result.oneActiveAccountPerAgent) {
					toast.success("One active account per agent: off");
				} else if (result.agentsWithMultipleActiveAccounts > 0) {
					toast.warning(
						`Rule is on. ${result.agentsWithMultipleActiveAccounts} agent(s) still have more than one active account — please deactivate the old ones.`,
					);
				} else {
					toast.success("One active account per agent: on");
				}
			},
			onError: (e) => toast.error(e.message || "Failed to update setting"),
		});

	const approveAgentMutation = trpc.agents.approve.useMutation({
		onSuccess: () => {
			toast.success("Agent approved");
			setIsApproveDialogOpen(false);
			setApproveAgentId(null);
			setApproveAgentCode("");
			resetAgentList();
			utils.agents.list.invalidate();
			utils.agents.getStats.invalidate();
		},
		onError: (e) => toast.error(e.message || "Failed to approve agent"),
	});

	const nextAgentCodeQuery = trpc.agents.previewNextAgentCode.useQuery(
		undefined,
		{ enabled: isApproveDialogOpen },
	);

	useEffect(() => {
		if (isApproveDialogOpen && nextAgentCodeQuery.data?.agentCode) {
			setApproveAgentCode(nextAgentCodeQuery.data.agentCode);
		}
	}, [isApproveDialogOpen, nextAgentCodeQuery.data?.agentCode]);

	const resetPasswordMutation = trpc.agents.resetPassword.useMutation({
		onSuccess: () => {
			toast.success("Password updated");
			setIsResetPasswordOpen(false);
			setResetAgentId(null);
			setResetPassword("");
		},
		onError: (e) => toast.error(e.message || "Failed to reset password"),
	});

	const deleteAgentMutation = trpc.agents.delete.useMutation({
		onSuccess: () => {
			toast.success("Agent deleted");
			setIsDeleteDialogOpen(false);
			setDeleteAgent(null);
			setDeleteStep(1);
			setDeleteConfirmText("");
			resetAgentList();
			utils.agents.list.invalidate();
			utils.agents.getStats.invalidate();
		},
		onError: (e) => toast.error(e.message || "Failed to delete agent"),
	});

	const handleManageFromView = () => {
		setIsViewModalOpen(false);
		setIsManageDialogOpen(true);
	};

	// Reset paging when filters / search change
	useEffect(() => {
		setListOffset(0);
		setAccumulatedAgents([]);
	}, [roleFilter, activeFilter, approvalFilter, debouncedSearch]);

	// Fetch agents data
	const {
		data: agentsData,
		isLoading: isLoadingAgents,
		isFetching: isFetchingAgents,
		refetch: refetchAgents,
		error: agentsListError,
	} = trpc.agents.list.useQuery(
		{
			limit: AGENTS_PAGE_SIZE,
			offset: listOffset,
			role: roleFilter === "all" ? undefined : roleFilter,
			isActive:
				activeFilter === "all"
					? undefined
					: activeFilter === "active",
			agentStatus:
				approvalFilter === "pending_approval" ? "pending_approval" : undefined,
			searchQuery: debouncedSearch.trim() || undefined,
			sortBy: "agentCode",
			sortOrder: "desc",
		},
		{
			enabled: !!session,
		},
	);

	useEffect(() => {
		if (!agentsData?.agents) return;
		const page = agentsData.agents as AgentListItem[];
		if (listOffset === 0) {
			setAccumulatedAgents(page);
			return;
		}
		setAccumulatedAgents((prev) => {
			const seen = new Set(prev.map((row) => row.agent.id));
			const next = page.filter((row) => !seen.has(row.agent.id));
			return next.length > 0 ? [...prev, ...next] : prev;
		});
	}, [agentsData, listOffset]);

	const totalAgentsMatching = Number(agentsData?.total ?? 0);
	const hasMoreAgents =
		accumulatedAgents.length > 0 &&
		accumulatedAgents.length < totalAgentsMatching;
	const isInitialAgentsLoading =
		isLoadingAgents && listOffset === 0 && accumulatedAgents.length === 0;
	const isLoadingMoreAgents = isFetchingAgents && listOffset > 0;

	// Get agent statistics
	const { data: agentStats, isLoading: isLoadingStats } =
		trpc.agents.getStats.useQuery(undefined, {
			enabled: !!session,
		});

	// Handle refresh
	const handleRefresh = async () => {
		setAccumulatedAgents([]);
		if (listOffset !== 0) {
			setListOffset(0);
		} else {
			await refetchAgents();
		}
		await utils.agents.getStats.invalidate();
	};

	const handleLoadMore = () => {
		if (isFetchingAgents || !hasMoreAgents) return;
		setListOffset((prev) => prev + AGENTS_PAGE_SIZE);
	};

	return (
		<>
			<header className="sticky top-0 z-40 -mx-4 flex h-16 shrink-0 items-center gap-2 border-border/60 border-b bg-background px-4 backdrop-blur-md supports-backdrop-filter:bg-background/95 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
				<div className="flex flex-1 items-center gap-2 px-1 sm:px-0">
					<SidebarTrigger className="-ms-1 rounded-xl" />
					<Separator
						orientation="vertical"
						className="mr-2 data-[orientation=vertical]:h-4"
					/>
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem className="hidden md:block">
								<BreadcrumbLink href="/admin">
									<RiDashboardLine size={22} aria-hidden="true" />
									<span className="sr-only">Admin Dashboard</span>
								</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator className="hidden md:block" />
							<BreadcrumbItem>
								<BreadcrumbPage className="flex items-center gap-2 font-medium">
									<span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
										<RiTeamLine size={16} aria-hidden="true" />
									</span>
									Agent Management
								</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				</div>
				<div className="ml-auto flex gap-2">
					<HeaderActions />
				</div>
			</header>
			<div className="flex flex-1 flex-col gap-5 py-5 lg:gap-6 lg:py-7">
					{/* Agents Page Header */}
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div className="min-w-0 space-y-1">
							<h1 className="font-bold text-2xl tracking-tight">
								{isSuperAdmin ? "Account Management" : "Agent Management"}
							</h1>
							<p className="text-muted-foreground text-sm">
								{isSuperAdmin
									? "Manage all accounts — agents, team leads, and admins."
									: "Manage agent accounts, permissions, performance, and team assignments."}
							</p>
						</div>

						{/* Agent Controls — search first, then filters */}
						<div className="flex flex-wrap items-center gap-2">
							<div className="relative">
								<RiSearchLine className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
								<Input
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									placeholder="Search name, nickname, code…"
									className="h-9 w-56 rounded-full border-border/70 bg-card pl-9 shadow-card sm:w-64"
								/>
							</div>

							<Select
								value={roleFilter}
								onValueChange={(value) =>
									setRoleFilter(value as AccountRoleFilter)
								}
							>
								<SelectTrigger className="h-9 w-44 rounded-full border-border/70 bg-card shadow-card">
									<SelectValue placeholder="Account role" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All accounts</SelectItem>
									<SelectItem value="agent">Agents</SelectItem>
									<SelectItem value="team_lead">Team leads</SelectItem>
									<SelectItem value="admin">Admins</SelectItem>
									{isSuperAdmin && (
										<SelectItem value="super_admin">Super admins</SelectItem>
									)}
								</SelectContent>
							</Select>

							<Select
								value={approvalFilter}
								onValueChange={(value) =>
									setApprovalFilter(value as "all" | "pending_approval")
								}
							>
								<SelectTrigger className="h-9 w-44 rounded-full border-border/70 bg-card shadow-card">
									<SelectValue placeholder="Approval" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All approvals</SelectItem>
									<SelectItem value="pending_approval">
										Pending approval
										{agentStats?.pendingApprovals
											? ` (${agentStats.pendingApprovals})`
											: ""}
									</SelectItem>
								</SelectContent>
							</Select>

							<Select
								value={activeFilter}
								onValueChange={(value) =>
									setActiveFilter(value as "all" | "active" | "inactive")
								}
							>
								<SelectTrigger className="h-9 w-36 rounded-full border-border/70 bg-card shadow-card">
									<SelectValue placeholder="Status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All status</SelectItem>
									<SelectItem value="active">Active</SelectItem>
									<SelectItem value="inactive">Inactive</SelectItem>
								</SelectContent>
							</Select>

							<Button
								variant="outline"
								size="icon"
								className="size-9 rounded-full border-border/70 bg-card shadow-card"
								onClick={handleRefresh}
								aria-label="Refresh"
							>
								<RiRefreshLine className="size-4" />
							</Button>

							<Button
								size="sm"
								onClick={() => setIsCreateDialogOpen(true)}
								className="h-9 gap-1.5 rounded-full px-4"
							>
								<RiAddLine className="size-4" />
								Add agent
							</Button>
						</div>
					</div>

					{/* Agent Summary Cards */}
					{isLoadingStats ? (
						<div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
							{["sk-a1", "sk-a2", "sk-a3", "sk-a4"].map((id) => (
								<div
									key={id}
									className="rounded-3xl border border-border/40 bg-card p-5 shadow-card"
								>
									<div className="flex justify-between gap-3">
										<div className="space-y-2">
											<Skeleton className="h-3 w-24" />
											<Skeleton className="h-8 w-16" />
										</div>
										<Skeleton className="size-10 rounded-xl" />
									</div>
									<div className="mt-4 flex items-center justify-between">
										<Skeleton className="h-5 w-24 rounded-full" />
										<Skeleton className="h-4 w-20" />
									</div>
								</div>
							))}
						</div>
					) : (
						(() => {
							const total = agentStats?.totalAgents || 0;
							const active = agentStats?.activeAgents || 0;
							const activeRate = total
								? Math.round((active / total) * 100)
								: 0;
							const branchStats = agentStats as unknown as {
								gentingAgents?: number;
								puchongAgents?: number;
								gentingTotalAgents?: number;
								puchongTotalAgents?: number;
							};
							const genting = Number(branchStats?.gentingAgents) || 0;
							const puchong = Number(branchStats?.puchongAgents) || 0;
							const gentingTotal =
								Number(branchStats?.gentingTotalAgents) || 0;
							const puchongTotal =
								Number(branchStats?.puchongTotalAgents) || 0;

							return (
								<div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
									<MetricCard
										title="Total Agents"
										value={String(total)}
										changeLabel="Total registered"
										trend={total > 0 ? "up" : "neutral"}
										icon={<RiUserLine size={20} />}
										variant="gradient"
									/>
									<MetricCard
										title="Active Agents"
										value={String(active)}
										changeLabel={`${activeRate}% active rate`}
										trend={
											activeRate >= 50
												? "up"
												: activeRate > 0
													? "neutral"
													: "down"
										}
										icon={<RiTeamLine size={20} />}
										sparkline={[28, 35, 42, 40, 48, 55, 50, 62, 58, 68, 72, 78]}
									/>
									<MetricCard
										title="Branch Puchong"
										value={String(puchong)}
										changeLabel="Active agents"
										trend={puchong > 0 ? "up" : "neutral"}
										icon={<RiBuilding2Line size={20} />}
										footnote={`${puchongTotal} Total registered`}
									/>
									<MetricCard
										title="Branch Genting"
										value={String(genting)}
										changeLabel="Active agents"
										trend={genting > 0 ? "up" : "neutral"}
										icon={<RiBuilding2Line size={20} />}
										footnote={`${gentingTotal} Total registered`}
									/>
								</div>
							);
						})()
					)}

					{/* Tier Distribution + Account Directory */}
					<div className="grid items-start gap-4 lg:grid-cols-4 lg:gap-5">
						<TierDashboardWidget className="w-full lg:col-span-1" />

						<Card className="gap-0 overflow-hidden rounded-3xl border-border/50 bg-card py-0 shadow-card lg:col-span-3">
							<CardHeader className="border-border/40 border-b bg-muted/20 px-5 py-4 sm:px-6">
								<div className="flex flex-wrap items-start justify-between gap-2">
									<div className="space-y-1">
										<CardTitle className="text-base font-semibold">
											{isSuperAdmin ? "Account Directory" : "Agent Directory"}
										</CardTitle>
										<CardDescription>
											{isSuperAdmin
												? "View and manage agents, team leads, and admins."
												: "Manage agent accounts, tiers, and performance"}
										</CardDescription>
									</div>
									<div className="flex flex-wrap items-center gap-2">
										<label
											htmlFor="one-active-account-rule"
											className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-1 text-xs"
											title="When on, an agent with several accounts (same email or NRIC) can only have one active account at a time."
										>
											<Switch
												id="one-active-account-rule"
												checked={oneActiveAccountPerAgent}
												disabled={
													accountSettingsQuery.isLoading ||
													setOneActiveRuleMutation.isPending
												}
												onCheckedChange={(enabled) =>
													setOneActiveRuleMutation.mutate({ enabled })
												}
											/>
											<span className="font-medium">
												One active account per agent
											</span>
										</label>
										{accumulatedAgents.length > 0 ? (
											<span className="inline-flex items-center rounded-full bg-primary/12 px-2.5 py-1 font-medium text-[11px] text-primary">
												{totalAgentsMatching > 0
													? `${accumulatedAgents.length} of ${totalAgentsMatching} shown`
													: `${accumulatedAgents.length} shown`}
											</span>
										) : null}
									</div>
								</div>
								{oneActiveAccountPerAgent &&
								(accountSettingsQuery.data?.agentsWithMultipleActiveAccounts ??
									0) > 0 ? (
									<p className="mt-2 text-amber-700 text-xs dark:text-amber-300">
										{accountSettingsQuery.data?.agentsWithMultipleActiveAccounts}{" "}
										agent(s) still have more than one active account. Look for
										the "Linked" label and deactivate the old account.
									</p>
								) : null}
							</CardHeader>
							<CardContent className="p-0">
								{isInitialAgentsLoading ? (
									<div className="space-y-3 p-4 sm:p-5">
										{["sk-b1", "sk-b2", "sk-b3", "sk-b4", "sk-b5"].map((id) => (
											<div
												key={id}
												className="flex items-center justify-between rounded-2xl border border-border/40 bg-background p-4 shadow-sm"
											>
												<div className="flex items-center gap-3">
													<Skeleton className="size-11 rounded-full" />
													<div className="space-y-2">
														<Skeleton className="h-4 w-32" />
														<Skeleton className="h-3 w-52" />
													</div>
												</div>
												<div className="flex gap-2">
													<Skeleton className="size-8 rounded-full" />
													<Skeleton className="size-8 rounded-full" />
													<Skeleton className="h-8 w-20 rounded-full" />
												</div>
											</div>
										))}
									</div>
								) : agentsListError ? (
									<div className="px-5 py-10 text-center">
										<p className="mb-3 text-destructive text-sm">
											{agentsListError.message || "Failed to load agents"}
										</p>
										<Button
											variant="outline"
											className="rounded-full"
											onClick={handleRefresh}
										>
											<RiRefreshLine className="mr-2 size-4" />
											Retry
										</Button>
									</div>
								) : accumulatedAgents.length > 0 ? (
									<div className="max-h-[min(70vh,720px)] overflow-y-auto [scrollbar-gutter:stable]">
										<div className="space-y-2.5 p-4 sm:p-5">
										{accumulatedAgents.map((agentItem) => {
											const agent = agentItem.agent;
											const recruiter = agentItem.recruiter ?? null;
											const linkedAccounts = agentItem.linkedAccounts ?? [];
											const isActive = agent.isActive ?? true;
											const isStaff = isStaffAccountRole(agent.role);
											const isProtectedLeadDev =
												agent.email?.toLowerCase() ===
												"igorkuzmenko0412@gmail.com";
											const displayName = formatAgentPickerLabel({
												name: agent.name,
												nickName: agent.nickName,
												agentCode: isStaff ? null : agent.agentCode,
												email: agent.email,
											});
											const recruitLabel = recruiter
												? [
														recruiter.nickName?.trim() || recruiter.name?.trim(),
														recruiter.agentCode?.trim(),
													]
														.filter(Boolean)
														.join(" ")
												: "";

											return (
												<div
													key={agent.id}
													className="flex flex-col gap-3 rounded-2xl border border-border/40 bg-background p-4 shadow-sm transition-all hover:border-primary/25 hover:shadow-card sm:flex-row sm:items-center sm:justify-between"
												>
													<div className="flex min-w-0 items-start gap-3 sm:items-center">
														<span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 font-semibold text-primary text-sm">
															{agentInitials(agent.name, agent.email)}
														</span>
														<div className="min-w-0 space-y-1.5">
															<div className="flex flex-wrap items-center gap-1.5">
																<span className="truncate font-semibold text-sm">
																	{displayName}
																</span>
																<span
																	className={cn(
																		"rounded-full px-2.5 py-0.5 font-medium text-[11px]",
																		accountRoleBadgeClass(agent.role),
																	)}
																>
																	{formatAccountRole(agent.role)}
																</span>
																{isStaff ? (
																	<span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-[11px] text-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
																		Staff
																	</span>
																) : agent.agentTier ? (
																	<TierBadge
																		tier={agent.agentTier as AgentTier}
																		size="sm"
																		showIcon={true}
																	/>
																) : null}
																<span
																	className={cn(
																		"rounded-full px-2.5 py-0.5 font-medium text-[11px]",
																		agentStatusBadgeClass(agent.agentStatus),
																	)}
																>
																	{formatAgentStatus(agent.agentStatus)}
																</span>
																{linkedAccounts.length > 0 ? (
																	<Tooltip>
																		<TooltipTrigger asChild>
																			<span className="cursor-default rounded-full bg-amber-100 px-2.5 py-0.5 font-medium text-[11px] text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
																				Linked{" "}
																				{linkedAccounts
																					.map((l) => l.agentCode || "—")
																					.join(", ")}
																			</span>
																		</TooltipTrigger>
																		<TooltipContent className="max-w-xs">
																			<p className="mb-1 font-medium">
																				Same person (email or NRIC):
																			</p>
																			{linkedAccounts.map((l) => (
																				<p key={l.id}>
																					{l.label} —{" "}
																					{l.isActive ? "Active" : "Inactive"}
																				</p>
																			))}
																		</TooltipContent>
																	</Tooltip>
																) : null}
															</div>
															<p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-muted-foreground text-xs">
																{!isStaff && agent.agentCode ? (
																	<>
																		<span className="font-mono">
																			Code {agent.agentCode}
																		</span>
																		<span aria-hidden>·</span>
																	</>
																) : null}
																<span className="break-all">{agent.email}</span>
																{agent.createdAt ? (
																	<>
																		<span aria-hidden>·</span>
																		<span>
																			Joined {formatDateDMY(agent.createdAt)}
																		</span>
																	</>
																) : null}
																{recruitLabel ? (
																	<>
																		<span aria-hidden>·</span>
																		<span>
																			Recruit{" "}
																			<span className="font-medium text-foreground/80">
																				({recruitLabel})
																			</span>
																		</span>
																	</>
																) : null}
															</p>
														</div>
													</div>

													<div className="flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0">
														{isPendingAgentStatus(agent.agentStatus) && (
															<Button
																size="sm"
																className="h-8 rounded-full px-3"
																onClick={() => {
																	setApproveAgentId(agent.id);
																	setIsApproveDialogOpen(true);
																}}
																disabled={approveAgentMutation.isPending}
															>
																Approve
															</Button>
														)}
														{isSuperAdmin && agent.role !== "super_admin" && (
															<Button
																size="sm"
																variant="outline"
																className="h-8 rounded-full border-border/60 bg-muted/40 px-3 shadow-none"
																onClick={() => handleChangeRole(agent)}
															>
																Role
															</Button>
														)}
														{(agent.role === "agent" ||
															agent.role === "team_lead" ||
															!agent.role) && (
															<Tooltip>
																<TooltipTrigger asChild>
																	<Button
																		variant="ghost"
																		size="icon"
																		className={actionBtnClass}
																		title="Manage"
																		onClick={() => handleManageAgent(agent)}
																	>
																		<RiSettings3Line size={15} />
																		<span className="sr-only">Manage</span>
																	</Button>
																</TooltipTrigger>
																<TooltipContent>Manage</TooltipContent>
															</Tooltip>
														)}
														<Tooltip>
															<TooltipTrigger asChild>
																<Button
																	variant="ghost"
																	size="icon"
																	className={actionBtnClass}
																	title="View details"
																	onClick={() => handleViewAgent(agent)}
																>
																	<RiEyeLine size={15} />
																	<span className="sr-only">View</span>
																</Button>
															</TooltipTrigger>
															<TooltipContent>View details</TooltipContent>
														</Tooltip>
														<Button
															size="sm"
															variant="outline"
															className="h-8 rounded-full border-border/60 bg-muted/40 px-3 shadow-none"
															onClick={() => {
																setResetAgentId(agent.id);
																setIsResetPasswordOpen(true);
															}}
														>
															Reset
														</Button>
														<Button
															size="sm"
															variant="outline"
															className="h-8 rounded-full border-border/60 bg-muted/40 px-3 shadow-none"
															onClick={() => {
																setActiveMutation.mutate({
																	agentId: agent.id,
																	isActive: !isActive,
																});
															}}
														>
															{isActive ? "Deactivate" : "Activate"}
														</Button>
														{!isProtectedLeadDev &&
															((isAdmin && agent.role !== "super_admin") ||
																(isSuperAdmin &&
																	agent.role === "super_admin")) &&
															agent.id !== session?.user?.id && (
																<Button
																	size="sm"
																	variant="destructive"
																	className="h-8 shrink-0 rounded-full px-3"
																	onClick={() => {
																		setDeleteAgent(agent);
																		setDeleteStep(1);
																		setDeleteConfirmText("");
																		setIsDeleteDialogOpen(true);
																	}}
																	disabled={deleteAgentMutation.isPending}
																>
																	Delete
																</Button>
															)}
													</div>
												</div>
											);
										})}
										{hasMoreAgents ? (
											<div className="pt-2 text-center">
												<Button
													variant="outline"
													className="rounded-full"
													onClick={handleLoadMore}
													disabled={isLoadingMoreAgents}
												>
													{isLoadingMoreAgents
														? "Loading…"
														: `Load More (${accumulatedAgents.length} of ${totalAgentsMatching})`}
												</Button>
											</div>
										) : null}
										</div>
									</div>
								) : (
									<div className="py-12 text-center">
										<span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
											<RiTeamLine size={28} />
										</span>
										<h3 className="mb-2 font-semibold text-lg">
											No Agents Found
										</h3>
										<p className="mx-auto mb-5 max-w-sm text-muted-foreground text-sm">
											No agents match the current filter criteria. Try adjusting
											your filters.
										</p>
										<div className="flex justify-center gap-2">
											<Button
												variant="outline"
												className="rounded-full"
												onClick={handleRefresh}
											>
												<RiRefreshLine className="mr-2 size-4" />
												Refresh
											</Button>
											<Button
												className="rounded-full"
												onClick={() => setIsCreateDialogOpen(true)}
											>
												<RiAddLine className="mr-2 size-4" />
												Add New Agent
											</Button>
										</div>
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</div>

			{/* Agent Management Dialog */}
			{selectedAgent && (
				<AgentManagementDialog
					open={isManageDialogOpen}
					onOpenChange={setIsManageDialogOpen}
					agent={{
						id: selectedAgent.id,
						name: selectedAgent.name || "Unknown",
						email: selectedAgent.email,
						agentTier: (selectedAgent.agentTier as AgentTier) || null,
						role: selectedAgent.role,
						companyCommissionSplit: selectedAgent.companyCommissionSplit,
						primaryCommissionSplit: selectedAgent.primaryCommissionSplit,
					}}
					onSuccess={() => {
						resetAgentList();
						void refetchAgents();
						utils.agents.getStats.invalidate();
					}}
				/>
			)}1

			{selectedAgent && (
				<AgentRoleDialog
					open={isRoleDialogOpen}
					onOpenChange={setIsRoleDialogOpen}
					agent={{
						id: selectedAgent.id,
						name: selectedAgent.name || "Unknown",
						email: selectedAgent.email,
						role: selectedAgent.role,
					}}
					onSuccess={() => {
						resetAgentList();
						void refetchAgents();
						utils.agents.getStats.invalidate();
					}}
				/>
			)}

			{/* Agent View Modal */}
			{selectedAgent && (
				<AgentViewModal
					open={isViewModalOpen}
					onOpenChange={setIsViewModalOpen}
					agentId={selectedAgent.id}
					onManage={handleManageFromView}
				/>
			)}

			<CreateAgentAccountDialog
				open={isCreateDialogOpen}
				onOpenChange={setIsCreateDialogOpen}
				isSuperAdmin={isSuperAdmin}
				onSuccess={() => {
					resetAgentList();
					utils.agents.list.invalidate();
					utils.agents.getStats.invalidate();
					utils.agents.getAccountSettings.invalidate();
				}}
			/>

			{/* Reset Password Dialog */}
			<Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
				<DialogContent className="sm:max-w-[520px]">
					<DialogHeader>
						<DialogTitle>Reset password</DialogTitle>
						<DialogDescription>
							Set a new password for this agent. This overrides the current password.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-2">
						<Label>New password</Label>
						<Input
							type="password"
							value={resetPassword}
							onChange={(e) => setResetPassword(e.target.value)}
						/>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setIsResetPasswordOpen(false)}>
							Cancel
						</Button>
						<Button
							disabled={
								resetPasswordMutation.isPending ||
								!resetAgentId ||
								resetPassword.length < 8
							}
							onClick={() => {
								if (!resetAgentId) return;
								resetPasswordMutation.mutate({
									agentId: resetAgentId,
									newPassword: resetPassword,
								});
							}}
						>
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
				<DialogContent className="sm:max-w-[420px]">
					<DialogHeader>
						<DialogTitle>Approve agent</DialogTitle>
						<DialogDescription>
							Assign an agent code before activating this account.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-2">
						<Label>Agent code</Label>
						<Input
							value={approveAgentCode}
							onChange={(e) => setApproveAgentCode(e.target.value)}
							placeholder="DT00001"
							className="font-mono"
						/>
						<p className="text-muted-foreground text-xs">
							Preset from the next available code. You can edit before approving.
						</p>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsApproveDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={() =>
								approveAgentId &&
								approveAgentMutation.mutate({
									agentId: approveAgentId,
									agentCode: approveAgentCode.trim() || undefined,
								})
							}
							disabled={approveAgentMutation.isPending || !approveAgentCode.trim()}
						>
							Confirm approval
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Agent Double Confirm Dialog */}
			<Dialog
				open={isDeleteDialogOpen}
				onOpenChange={(open) => {
					setIsDeleteDialogOpen(open);
					if (!open) {
						setDeleteAgent(null);
						setDeleteStep(1);
						setDeleteConfirmText("");
					}
				}}
			>
				<DialogContent className="sm:max-w-[520px]">
					<DialogHeader>
						<DialogTitle>
							{deleteStep === 1 ? "Delete agent?" : "Final confirmation"}
						</DialogTitle>
						<DialogDescription>
							{deleteStep === 1 ? (
								<>
									This will permanently delete this agent account and associated
									auth records.
								</>
							) : (
								<>
									Type <span className="font-mono">DELETE</span> to confirm. This
									action cannot be undone.
								</>
							)}
						</DialogDescription>
					</DialogHeader>

					{deleteAgent && (
						<div className="rounded-lg border bg-muted/30 p-3 text-sm">
							<div className="font-medium">{deleteAgent.name || "Unknown"}</div>
							<div className="text-muted-foreground">{deleteAgent.email}</div>
						</div>
					)}

					{deleteStep === 2 && (
						<div className="space-y-2">
							<Label>Type DELETE to confirm</Label>
							<Input
								value={deleteConfirmText}
								onChange={(e) => setDeleteConfirmText(e.target.value)}
								placeholder="DELETE"
								className="font-mono"
							/>
						</div>
					)}

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsDeleteDialogOpen(false)}
							disabled={deleteAgentMutation.isPending}
						>
							Cancel
						</Button>
						{deleteStep === 1 ? (
							<Button
								variant="destructive"
								onClick={() => setDeleteStep(2)}
								disabled={!deleteAgent || deleteAgentMutation.isPending}
							>
								Continue
							</Button>
						) : (
							<Button
								variant="destructive"
								onClick={() => {
									if (!deleteAgent) return;
									deleteAgentMutation.mutate({ agentId: deleteAgent.id });
								}}
								disabled={
									!deleteAgent ||
									deleteAgentMutation.isPending ||
									deleteConfirmText.trim().toUpperCase() !== "DELETE"
								}
							>
								Delete forever
							</Button>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
