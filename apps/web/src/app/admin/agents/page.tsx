"use client";

import { HeaderActions } from "@/components/header-actions";
import { Separator } from "@/components/separator";
import {
	SidebarTrigger,
} from "@/components/sidebar";
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
import { useUserRole } from "@/hooks/use-user-role";
import { accountRoleBadgeClass, formatAccountRole } from "@/lib/user-role";
import { trpc } from "@/utils/trpc";
import {
	RiAddLine,
	RiDashboardLine,
	RiRefreshLine,
	RiSettings3Line,
	RiTeamLine,
	RiUserLine,
} from "@remixicon/react";
import { useState } from "react";
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
	createdAt: string | null;
	isActive?: boolean | null;
}

export default function AdminAgentsPage() {
	const { session, isSuperAdmin } = useUserRole();
	const [statusFilter, setStatusFilter] = useState<string>("active");

	// State for dialogs
	const [selectedAgent, setSelectedAgent] = useState<AgentData | null>(null);
	const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
	const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
	const [isViewModalOpen, setIsViewModalOpen] = useState(false);
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
	const [resetAgentId, setResetAgentId] = useState<string | null>(null);

	const [newAgentName, setNewAgentName] = useState("");
	const [newAgentEmail, setNewAgentEmail] = useState("");
	const [newAgentPhone, setNewAgentPhone] = useState("");
	const [newAgentBranch, setNewAgentBranch] = useState("");
	const [newAgentPassword, setNewAgentPassword] = useState("");
	const [newAgentRole, setNewAgentRole] = useState<"agent" | "team_lead" | "admin">("agent");
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

	const createAgentMutation = trpc.agents.create.useMutation({
		onSuccess: () => {
			toast.success("Agent account created");
			setIsCreateDialogOpen(false);
			setNewAgentName("");
			setNewAgentEmail("");
			setNewAgentPhone("");
			setNewAgentBranch("");
			setNewAgentPassword("");
			utils.agents.list.invalidate();
			utils.agents.getStats.invalidate();
		},
		onError: (e) => toast.error(e.message || "Failed to create agent"),
	});

	const setActiveMutation = trpc.agents.setActive.useMutation({
		onSuccess: () => {
			utils.agents.list.invalidate();
			utils.agents.getStats.invalidate();
		},
		onError: (e) => toast.error(e.message || "Failed to update agent status"),
	});

	const resetPasswordMutation = trpc.agents.resetPassword.useMutation({
		onSuccess: () => {
			toast.success("Password updated");
			setIsResetPasswordOpen(false);
			setResetAgentId(null);
			setResetPassword("");
		},
		onError: (e) => toast.error(e.message || "Failed to reset password"),
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
			limit: 20,
			offset: 0,
			role:
				statusFilter === "all"
					? undefined
					: statusFilter === "active"
						? "agent"
						: undefined,
			sortBy: "name",
			sortOrder: "asc",
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
				<header className="flex h-16 shrink-0 items-center gap-2 border-b">
					<div className="flex flex-1 items-center gap-2 px-3">
						<SidebarTrigger className="-ms-4" />
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
									<BreadcrumbPage className="flex items-center gap-2">
										<RiTeamLine size={20} aria-hidden="true" />
										Agent Management
									</BreadcrumbPage>
								</BreadcrumbItem>
							</BreadcrumbList>
						</Breadcrumb>
					</div>
					<div className="ml-auto flex gap-3">
						<HeaderActions />
					</div>
				</header>
				<div className="flex flex-1 flex-col gap-4 py-4 lg:gap-6 lg:py-6">
					{/* Agents Page Header */}
					<div className="flex items-center justify-between gap-4">
						<div className="space-y-1">
							<h1 className="flex items-center gap-2 font-semibold text-2xl">
								<RiTeamLine className="size-6" />
								Agent Management
							</h1>
							<p className="text-muted-foreground text-sm">
								Manage agent accounts, permissions, performance, and team
								assignments.
							</p>
						</div>

						{/* Agent Controls */}
						<div className="flex items-center gap-2">
							{/* Status Filter */}
							<Select value={statusFilter} onValueChange={setStatusFilter}>
								<SelectTrigger className="w-40">
									<SelectValue placeholder="Filter by status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="active">Active Agents</SelectItem>
									<SelectItem value="inactive">Inactive</SelectItem>
									<SelectItem value="pending">Pending Approval</SelectItem>
									<SelectItem value="all">All Agents</SelectItem>
								</SelectContent>
							</Select>

							{/* Refresh Button */}
							<Button variant="outline" size="sm" onClick={handleRefresh}>
								<RiRefreshLine className="size-4" />
							</Button>

							<Button
								size="sm"
								onClick={() => setIsCreateDialogOpen(true)}
								className="bg-green-600 hover:bg-green-700"
							>
								<RiAddLine className="mr-2 h-4 w-4" />
								Add agent
							</Button>
						</div>
					</div>

					{/* Agent Summary Cards */}
					{isLoadingStats ? (
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
							{["sk-a1", "sk-a2", "sk-a3", "sk-a4"].map((id) => (
								<Card key={id} className="overflow-hidden">
									<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
										<Skeleton className="h-3.5 w-24" />
										<Skeleton className="h-4 w-4 rounded" />
									</CardHeader>
									<CardContent className="space-y-2">
										<Skeleton className="h-8 w-16" />
										<Skeleton className="h-3 w-28" />
									</CardContent>
								</Card>
							))}
						</div>
					) : (
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="font-medium text-sm">
										Total Agents
									</CardTitle>
									<RiUserLine className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="font-bold text-2xl">
										{agentStats?.totalAgents || 0}
									</div>
									<p className="text-muted-foreground text-xs">
										Total registered
									</p>
								</CardContent>
							</Card>
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="font-medium text-sm">
										Active Agents
									</CardTitle>
									<RiTeamLine className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="font-bold text-2xl">
										{agentStats?.activeAgents || 0}
									</div>
									<p className="text-muted-foreground text-xs">
										{agentStats?.totalAgents
											? `${Math.round((agentStats.activeAgents / agentStats.totalAgents) * 100)}% active rate`
											: "Active agents"}
									</p>
								</CardContent>
							</Card>
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="font-medium text-sm">
										Team Leads
									</CardTitle>
									<RiUserLine className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="font-bold text-2xl">
										{agentStats?.teamLeads || 0}
									</div>
									<p className="text-muted-foreground text-xs">
										Leadership roles
									</p>
								</CardContent>
							</Card>
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="font-medium text-sm">Admins</CardTitle>
									<RiTeamLine className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="font-bold text-2xl">
										{agentStats?.admins || 0}
									</div>
									<p className="text-muted-foreground text-xs">Admin users</p>
								</CardContent>
							</Card>
						</div>
					)}

					{/* Tier Distribution Dashboard */}
					<div className="grid gap-4 lg:grid-cols-3">
						<TierDashboardWidget className="lg:col-span-1" />

						{/* Agent Management Interface */}
						<Card className="lg:col-span-2">
							<CardHeader>
								<CardTitle>Agent Directory</CardTitle>
								<CardDescription>
									Manage agent accounts, roles, permissions, and performance
									tracking
								</CardDescription>
							</CardHeader>
							<CardContent>
								{isLoadingAgents ? (
									<div className="space-y-3">
										{["sk-b1", "sk-b2", "sk-b3", "sk-b4", "sk-b5"].map((id) => (
											<div
												key={id}
												className="flex items-center justify-between rounded-lg border p-4"
											>
												<div className="flex items-center gap-3">
													<Skeleton className="h-10 w-10 rounded-full" />
													<div className="space-y-2">
														<Skeleton className="h-4 w-32" />
														<Skeleton className="h-3 w-52" />
													</div>
												</div>
												<div className="flex gap-2">
													<Skeleton className="h-8 w-20 rounded-md" />
													<Skeleton className="h-8 w-16 rounded-md" />
												</div>
											</div>
										))}
									</div>
								) : agentsData?.agents && agentsData.agents.length > 0 ? (
									<div className="space-y-4">
										{agentsData.agents.map((agentItem) => (
											<div
												key={agentItem.agent.id}
												className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
											>
												<div className="flex items-center gap-3">
													<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
														<RiUserLine className="h-5 w-5 text-primary" />
													</div>
													<div className="space-y-1">
														<div className="flex items-center gap-2">
															<span className="font-medium">
																{agentItem.agent.name}
															</span>
															<span
																className={`rounded-full px-2 py-1 text-xs ${accountRoleBadgeClass(agentItem.agent.role)}`}
															>
																{formatAccountRole(agentItem.agent.role)}
															</span>
															{agentItem.agent.agentTier && (
																<TierBadge
																	tier={agentItem.agent.agentTier as AgentTier}
																	size="sm"
																	showIcon={true}
																/>
															)}
														</div>
														<p className="text-muted-foreground text-sm">
															{agentItem.agent.email}
															{agentItem.agent.createdAt &&
																` • Joined ${new Date(agentItem.agent.createdAt).toLocaleDateString()}`}
														</p>
													</div>
												</div>
												<div className="flex gap-2">
													{isSuperAdmin && agentItem.agent.role !== "super_admin" && (
														<Button
															size="sm"
															variant="secondary"
															onClick={() =>
																handleChangeRole(agentItem.agent as AgentData)
															}
														>
															Role
														</Button>
													)}
													<Button
														size="sm"
														variant="outline"
														onClick={() =>
															handleManageAgent(agentItem.agent as AgentData)
														}
													>
														<RiSettings3Line className="mr-1 h-4 w-4" />
														Manage
													</Button>
													<Button
														size="sm"
														variant="outline"
														onClick={() =>
															handleViewAgent(agentItem.agent as AgentData)
														}
													>
														<RiUserLine className="mr-1 h-4 w-4" />
														View
													</Button>
													<Button
														size="sm"
														variant="outline"
														onClick={() => {
															setResetAgentId(agentItem.agent.id);
															setIsResetPasswordOpen(true);
														}}
													>
														Reset
													</Button>
													<Button
														size="sm"
														variant="outline"
														onClick={() => {
															const active =
																(agentItem.agent as AgentData).isActive ?? true;
															setActiveMutation.mutate({
																agentId: agentItem.agent.id,
																isActive: !active,
															});
														}}
													>
														{(agentItem.agent as AgentData).isActive === false
															? "Activate"
															: "Deactivate"}
													</Button>
												</div>
											</div>
										))}
										{agentsData.hasMore && (
											<div className="pt-4 text-center">
												<Button
													variant="outline"
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
									<div className="py-8 text-center">
										<RiTeamLine
											size={48}
											className="mx-auto mb-4 text-muted-foreground"
										/>
										<h3 className="mb-2 font-semibold text-lg">
											No Agents Found
										</h3>
										<p className="mb-4 text-muted-foreground">
											No agents match the current filter criteria. Try adjusting
											your filters.
										</p>
										<div className="flex justify-center gap-2">
											<Button variant="outline" onClick={handleRefresh}>
												<RiRefreshLine className="mr-2 h-4 w-4" />
												Refresh
											</Button>
											<Button onClick={() => setIsCreateDialogOpen(true)}>
												<RiAddLine className="mr-2 h-4 w-4" />
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

			{/* Create Agent Dialog */}
			<Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
				<DialogContent className="sm:max-w-[520px]">
					<DialogHeader>
						<DialogTitle>Create agent account</DialogTitle>
						<DialogDescription>
							Create a new agent (email must be unique; phone must be in +60 format).
						</DialogDescription>
					</DialogHeader>
					<div className="grid grid-cols-2 gap-3">
						<div className="col-span-2 space-y-2">
							<Label>Name</Label>
							<Input value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)} />
						</div>
						<div className="col-span-2 space-y-2">
							<Label>Email</Label>
							<Input
								type="email"
								value={newAgentEmail}
								onChange={(e) => setNewAgentEmail(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label>Phone (+60…)</Label>
							<Input value={newAgentPhone} onChange={(e) => setNewAgentPhone(e.target.value)} />
						</div>
						<div className="space-y-2">
							<Label>Branch</Label>
							<Input value={newAgentBranch} onChange={(e) => setNewAgentBranch(e.target.value)} />
						</div>
						<div className="col-span-2 space-y-2">
							<Label>Temporary password</Label>
							<Input
								type="password"
								value={newAgentPassword}
								onChange={(e) => setNewAgentPassword(e.target.value)}
							/>
						</div>
						{isSuperAdmin && (
							<div className="col-span-2 space-y-2">
								<Label>Account role</Label>
								<Select
									value={newAgentRole}
									onValueChange={(value) =>
										setNewAgentRole(value as "agent" | "team_lead" | "admin")
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="agent">Agent</SelectItem>
										<SelectItem value="team_lead">Team Lead</SelectItem>
										<SelectItem value="admin">Admin</SelectItem>
									</SelectContent>
								</Select>
							</div>
						)}
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
							Cancel
						</Button>
						<Button
							disabled={
								createAgentMutation.isPending ||
								!newAgentName.trim() ||
								!newAgentEmail.trim() ||
								newAgentPassword.length < 8
							}
							onClick={() => {
								createAgentMutation.mutate({
									name: newAgentName.trim(),
									email: newAgentEmail.trim(),
									phone: newAgentPhone.trim() || undefined,
									branch: newAgentBranch.trim() || undefined,
									password: newAgentPassword,
									role: isSuperAdmin ? newAgentRole : "agent",
								});
							}}
						>
							Create
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

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
		</>
	);
}
