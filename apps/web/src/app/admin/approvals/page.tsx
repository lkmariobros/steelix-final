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
	RiCheckLine,
	RiCheckboxCircleLine,
	RiCloseLine,
	RiDashboardLine,
	RiRefreshLine,
	RiShieldUserLine,
} from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminApprovalsPage() {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();
	const [statusFilter, setStatusFilter] = useState<string>("pending");

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
						You don&apos;t have permission to access commission approvals.
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
										<RiCheckboxCircleLine size={20} aria-hidden="true" />
										Commission Approvals
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
					{/* Approvals Page Header */}
					<div className="flex items-center justify-between gap-4">
						<div className="space-y-1">
							<h1 className="flex items-center gap-2 font-semibold text-2xl">
								<RiCheckboxCircleLine className="size-6" />
								Commission Approvals
							</h1>
							<p className="text-muted-foreground text-sm">
								Review and approve agent commission requests and transaction
								submissions.
							</p>
						</div>

						{/* Approval Controls */}
						<div className="flex items-center gap-2">
							{/* Status Filter */}
							<Select value={statusFilter} onValueChange={setStatusFilter}>
								<SelectTrigger className="w-40">
									<SelectValue placeholder="Filter by status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="pending">Pending Review</SelectItem>
									<SelectItem value="approved">Approved</SelectItem>
									<SelectItem value="rejected">Rejected</SelectItem>
									<SelectItem value="all">All Requests</SelectItem>
								</SelectContent>
							</Select>

							{/* Refresh Button */}
							<Button variant="outline" size="sm" onClick={handleRefresh}>
								<RiRefreshLine className="size-4" />
							</Button>
						</div>
					</div>

					{/* Approval Summary Cards */}
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="font-medium text-sm">
									Pending Approvals
								</CardTitle>
								<RiCheckboxCircleLine className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="font-bold text-2xl">12</div>
								<p className="text-muted-foreground text-xs">
									Awaiting your review
								</p>
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="font-medium text-sm">
									Approved Today
								</CardTitle>
								<RiCheckLine className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="font-bold text-2xl">8</div>
								<p className="text-muted-foreground text-xs">
									+3 from yesterday
								</p>
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="font-medium text-sm">
									Total Value
								</CardTitle>
								<RiCheckboxCircleLine className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="font-bold text-2xl">$234,567</div>
								<p className="text-muted-foreground text-xs">
									Pending approval
								</p>
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="font-medium text-sm">
									Average Time
								</CardTitle>
								<RiCheckboxCircleLine className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="font-bold text-2xl">2.4 days</div>
								<p className="text-muted-foreground text-xs">To approval</p>
							</CardContent>
						</Card>
					</div>

					{/* Approval Queue */}
					<Card>
						<CardHeader>
							<CardTitle>Approval Queue</CardTitle>
							<CardDescription>
								Commission requests and transactions awaiting your approval
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="py-8 text-center">
								<RiCheckboxCircleLine
									size={48}
									className="mx-auto mb-4 text-muted-foreground"
								/>
								<h3 className="mb-2 font-semibold text-lg">
									Commission Approval System
								</h3>
								<p className="mb-4 text-muted-foreground">
									Review and approve agent commission requests, transaction
									submissions, and deal approvals
								</p>
								<div className="flex justify-center gap-2">
									<Button variant="outline">
										<RiCheckLine className="mr-2 h-4 w-4" />
										Bulk Approve
									</Button>
									<Button variant="outline">
										<RiCloseLine className="mr-2 h-4 w-4" />
										Bulk Reject
									</Button>
									<Button>
										<RiRefreshLine className="mr-2 h-4 w-4" />
										Refresh Queue
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
