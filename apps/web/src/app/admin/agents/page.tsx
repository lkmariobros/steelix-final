"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/separator";
import {
	SidebarInset,
	SidebarProvider,
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
import UserDropdown from "@/components/user-dropdown";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import {
	RiAddLine,
	RiDashboardLine,
	RiRefreshLine,
	RiSettings3Line,
	RiShieldUserLine,
	RiTeamLine,
	RiUserLine,
} from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminAgentsPage() {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();
	const [statusFilter, setStatusFilter] = useState<string>("active");

	// Admin role checking
	const { data: roleData, isLoading: isRoleLoading } =
		trpc.admin.checkAdminRole.useQuery(undefined, {
			enabled: !!session,
			retry: false,
		}) as {
			data: { hasAdminAccess: boolean; role: string } | undefined;
			isLoading: boolean;
		};

	// Show loading while checking authentication and role
	if (isPending || isRoleLoading) {
		return (
			<div className="flex h-screen items-center justify-center">
				<div className="text-center">
					<div className="mx-auto h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
					<p className="mt-2 text-muted-foreground text-sm">Loading...</p>
				</div>
			</div>
		);
	}

	// Redirect if not authenticated
	if (!session) {
		router.push("/login");
		return null;
	}

	// Access denied if not admin
	if (!roleData || !roleData.hasAdminAccess) {
		return (
			<div className="flex h-screen items-center justify-center">
				<div className="text-center">
					<RiShieldUserLine
						size={48}
						className="mx-auto mb-4 text-muted-foreground"
					/>
					<h1 className="mb-2 font-semibold text-2xl">Access Denied</h1>
					<p className="mb-4 text-muted-foreground">
						You don&apos;t have permission to access agent management.
					</p>
					<p className="mb-4 text-muted-foreground text-sm">
						Current role: {roleData?.role || "Unknown"}
					</p>
					<button
						type="button"
						onClick={() => router.push("/dashboard")}
						className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
					>
						Go to Agent Dashboard
					</button>
				</div>
			</div>
		);
	}

	// Handle refresh
	const handleRefresh = () => {
		window.location.reload();
	};

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset className="overflow-hidden px-4 md:px-6 lg:px-8">
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
						<UserDropdown />
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
						</div>
					</div>

					{/* Agent Summary Cards */}
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="font-medium text-sm">
									Total Agents
								</CardTitle>
								<RiUserLine className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="font-bold text-2xl">47</div>
								<p className="text-muted-foreground text-xs">+3 this month</p>
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
								<div className="font-bold text-2xl">42</div>
								<p className="text-muted-foreground text-xs">89% active rate</p>
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="font-medium text-sm">
									Top Performer
								</CardTitle>
								<RiUserLine className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="font-bold text-2xl">$125K</div>
								<p className="text-muted-foreground text-xs">This month</p>
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="font-medium text-sm">
									Avg Performance
								</CardTitle>
								<RiTeamLine className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="font-bold text-2xl">$28K</div>
								<p className="text-muted-foreground text-xs">Per agent/month</p>
							</CardContent>
						</Card>
					</div>

					{/* Agent Management Interface */}
					<Card>
						<CardHeader>
							<CardTitle>Agent Directory</CardTitle>
							<CardDescription>
								Manage agent accounts, roles, permissions, and performance
								tracking
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="py-8 text-center">
								<RiTeamLine
									size={48}
									className="mx-auto mb-4 text-muted-foreground"
								/>
								<h3 className="mb-2 font-semibold text-lg">
									Agent Management System
								</h3>
								<p className="mb-4 text-muted-foreground">
									Comprehensive agent management tools including performance
									tracking, role assignments, and account administration
								</p>
								<div className="flex justify-center gap-2">
									<Button variant="outline">
										<RiSettings3Line className="mr-2 h-4 w-4" />
										Bulk Actions
									</Button>
									<Button variant="outline">
										<RiUserLine className="mr-2 h-4 w-4" />
										Export Agents
									</Button>
									<Button>
										<RiAddLine className="mr-2 h-4 w-4" />
										Add New Agent
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
