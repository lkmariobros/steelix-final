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
import { MetricCard } from "@/dashboards/admin/widgets/metric-card";
import { useUserRole } from "@/hooks/use-user-role";
import { accountRoleBadgeClass, formatAccountRole, isStaffAccountRole } from "@/lib/user-role";
import {
	agentStatusBadgeClass,
	formatAgentStatus,
	isPendingAgentStatus,
} from "@/lib/agent-status";
import { formatDateDMY } from "@/lib/date-format";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import {
	RiAddLine,
	RiBuilding2Line,
	RiDashboardLine,
	RiEyeLine,
	RiRefreshLine,
	RiSettings3Line,
	RiShieldUserLine,
	RiTeamLine,
	RiUserLine,
	RiUserStarLine,
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
}

type AccountRoleFilter =
	| "all"
	| "agent"
	| "team_lead"
	| "admin"
	| "super_admin";

export default function AdminAgentsPage() {
	const { session, isSuperAdmin, isAdmin } = useUserRole();
	const [roleFilter, setRoleFilter] = useState<AccountRoleFilter>("all");
	const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">(
		"all",
	);
	const [approvalFilter, setApprovalFilter] = useState<
		"all" | "pending_approval"
	>("all");

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

	const setActiveMutation = trpc.agents.setActive.useMutation({
		onSuccess: () => {
			utils.agents.list.invalidate();
			utils.agents.getStats.invalidate();
		},
		onError: (e) => toast.error(e.message || "Failed to update agent status"),
	});

	const approveAgentMutation = trpc.agents.approve.useMutation({
		onSuccess: () => {
			toast.success("Agent approved");
			setIsApproveDialogOpen(false);
			setApproveAgentId(null);
			setApproveAgentCode("");
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
			utils.agents.list.invalidate();
			utils.agents.getStats.invalidate();
		},
		onError: (e) => toast.error(e.message || "Failed to delete agent"),
	});

	const handleManageFromView = () => {
		setIsViewModalOpen(false);
		setIsManageDialogOpen(true);
	};

	// Fetch agents data
	const {
		data: agentsData,
		isLoading: isLoadingAgents,
		refetch: refetchAgents,
	} = trpc.agents.list.useQuery(
		{
			limit: 50,
			offset: 0,
			role: roleFilter === "all" ? undefined : roleFilter,
			isActive:
				activeFilter === "all"
					? undefined
					: activeFilter === "active",
			agentStatus:
				approvalFilter === "pending_approval" ? "pending_approval" : undefined,
			sortBy: "agentCode",
			sortOrder: "desc",
		},
		{
			enabled: !!session,
		},
	);

	// Get agent statistics
	const { data: agentStats, isLoading: isLoadingStats } =
		trpc.agents.getStats.useQuery(undefined, {
			enabled: !!session,
		});

	// Handle refresh
	const handleRefresh = async () => {
		await Promise.all([refetchAgents(), utils.agents.getStats.invalidate()]);
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

						{/* Agent Controls */}
						<div className="flex flex-wrap items-center gap-2">
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
						<div className="space-y-4">
							<div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
											<Skeleton className="h-9 w-20" />
										</div>
									</div>
								))}
							</div>
							<div className="grid items-stretch gap-4 sm:grid-cols-2">
								{["sk-branch-1", "sk-branch-2"].map((id) => (
									<div
										key={id}
										className="rounded-3xl border border-border/40 bg-card p-5 shadow-card"
									>
										<div className="flex justify-between gap-3">
											<div className="space-y-2">
												<Skeleton className="h-3 w-28" />
												<Skeleton className="h-8 w-16" />
											</div>
											<Skeleton className="size-10 rounded-xl" />
										</div>
										<div className="mt-4">
											<Skeleton className="h-5 w-28 rounded-full" />
										</div>
									</div>
								))}
							</div>
						</div>
					) : (
						(() => {
							const total = agentStats?.totalAgents || 0;
							const active = agentStats?.activeAgents || 0;
							const activeRate = total
								? Math.round((active / total) * 100)
								: 0;
							const teamLeads = agentStats?.teamLeads || 0;
							const admins =
								(agentStats?.admins || 0) + (agentStats?.superAdmins || 0);
							const genting =
								(agentStats as unknown as { gentingAgents?: number })
									?.gentingAgents || 0;
							const puchong =
								(agentStats as unknown as { puchongAgents?: number })
									?.puchongAgents || 0;

							return (
								<div className="space-y-4">
									<div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
										<MetricCard
											title="Total Agents"
											value={String(total)}
											changeLabel="Total registered"
											trend={total > 0 ? "up" : "neutral"}
											icon={<RiUserLine size={20} />}
											sparkline={[32, 40, 38, 50, 48, 55, 52, 60, 58, 65, 70, 72]}
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
											title="Team Leads"
											value={String(teamLeads)}
											changeLabel="Leadership roles"
											trend={teamLeads > 0 ? "up" : "neutral"}
											icon={<RiUserStarLine size={20} />}
											sparkline={[20, 25, 22, 30, 28, 35, 40, 38, 45, 42, 50, 48]}
										/>
										<MetricCard
											title="Admins"
											value={String(admins)}
											changeLabel={
												agentStats?.superAdmins
													? `${agentStats.admins} admin · ${agentStats.superAdmins} super`
													: "Admin users"
											}
											trend="neutral"
											icon={<RiShieldUserLine size={20} />}
											variant="gradient"
										/>
									</div>

									<div className="grid items-stretch gap-4 sm:grid-cols-2">
										<MetricCard
											title="Branch Genting"
											value={String(genting)}
											changeLabel="Agents in Genting"
											trend={genting > 0 ? "up" : "neutral"}
											icon={<RiBuilding2Line size={20} />}
											sparkline={[30, 34, 40, 38, 45, 42, 50, 48, 55, 52, 60, 58]}
										/>
										<MetricCard
											title="Branch Puchong"
											value={String(puchong)}
											changeLabel="Agents in Puchong"
											trend={puchong > 0 ? "up" : "neutral"}
											icon={<RiBuilding2Line size={20} />}
											sparkline={[25, 30, 28, 36, 40, 38, 45, 50, 48, 55, 52, 60]}
										/>
									</div>
								</div>
							);
						})()
					)}

					{/* Tier Distribution + Account Directory */}
					<div className="grid items-start gap-4 lg:grid-cols-3 lg:gap-5">
						<TierDashboardWidget className="w-full lg:col-span-1" />

						<Card className="gap-0 overflow-hidden rounded-3xl border-border/50 bg-card py-0 shadow-card lg:col-span-2">
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
									{agentsData?.agents ? (
										<span className="inline-flex items-center rounded-full bg-primary/12 px-2.5 py-1 font-medium text-[11px] text-primary">
											{agentsData.agents.length} shown
										</span>
									) : null}
								</div>
							</CardHeader>
							<CardContent className="p-4 sm:p-5">
								{isLoadingAgents ? (
									<div className="space-y-3">
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
								) : agentsData?.agents && agentsData.agents.length > 0 ? (
									<div className="space-y-2.5">
										{agentsData.agents.map((agentItem) => {
											const agent = agentItem.agent as AgentData;
											const isActive = agent.isActive ?? true;
											const isStaff = isStaffAccountRole(agent.role);

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
																	{agent.name || agent.email}
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
															</div>
															<p className="truncate text-muted-foreground text-xs sm:text-sm">
																{!isStaff && agent.agentCode ? (
																	<>
																		<span className="font-mono">
																			Code {agent.agentCode}
																		</span>
																		<span>{" · "}</span>
																	</>
																) : null}
																{agent.email}
																{agent.createdAt
																	? ` · Joined ${formatDateDMY(agent.createdAt)}`
																	: ""}
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
														{((isAdmin && agent.role !== "super_admin") ||
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
										{agentsData.hasMore && (
											<div className="pt-2 text-center">
												<Button
													variant="outline"
													className="rounded-full"
													onClick={() => {
														// TODO: Implement pagination
													}}
												>
													Load More
												</Button>
											</div>
										)}
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
						refetchAgents();
						utils.agents.getStats.invalidate();
					}}
				/>
			)}

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
						refetchAgents();
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
					utils.agents.list.invalidate();
					utils.agents.getStats.invalidate();
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
