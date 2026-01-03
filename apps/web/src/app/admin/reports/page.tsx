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
	RiBarChartLine,
	RiCalendarLine,
	RiDashboardLine,
	RiDownloadLine,
	RiFileTextLine,
	RiRefreshLine,
	RiShieldUserLine,
} from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";

export default function AdminReportsPage() {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();
	const [reportType, setReportType] = useState<string>("performance");
	const [timeRange, setTimeRange] = useState<string>("30d");

	// Memoize date calculations to prevent infinite query loops
	const dateRange = useMemo(() => {
		const endDate = new Date();
		const startDate = timeRange === '7d' ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) :
						  timeRange === '30d' ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) :
						  timeRange === '90d' ? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) :
						  new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
		return { startDate, endDate };
	}, [timeRange]);

	// Admin role checking
	const { data: roleData, isLoading: isRoleLoading } =
		trpc.admin.checkAdminRole.useQuery(undefined, {
			enabled: !!session,
			retry: false,
		}) as {
			data: { hasAdminAccess: boolean; role: string } | undefined;
			isLoading: boolean;
		};

	// Get dashboard statistics
	const { data: dashboardStats, isLoading: isLoadingStats } = trpc.reports.getDashboardStats.useQuery({
		startDate: dateRange.startDate,
		endDate: dateRange.endDate,
	}, {
		enabled: !!session && !!roleData?.hasAdminAccess,
		staleTime: 5 * 60 * 1000, // 5 minutes
		refetchOnWindowFocus: false,
	});

	// Get performance analytics
	const { data: performanceAnalytics, isLoading: isLoadingPerformance } = trpc.reports.getPerformanceAnalytics.useQuery({
		periodType: 'monthly',
		startDate: dateRange.startDate,
		endDate: dateRange.endDate,
	}, {
		enabled: !!session && !!roleData?.hasAdminAccess,
		staleTime: 5 * 60 * 1000, // 5 minutes
		refetchOnWindowFocus: false,
	});

	// Get utils for invalidation after mutations
	const utils = trpc.useUtils();

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
						You don&apos;t have permission to access reports and analytics.
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
	const handleRefresh = async () => {
		await Promise.all([
			utils.reports.getDashboardStats.invalidate(),
			utils.reports.getPerformanceAnalytics.invalidate(),
		]);
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
										<RiBarChartLine size={20} aria-hidden="true" />
										Reports & Analytics
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
					{/* Reports Page Header */}
					<div className="flex items-center justify-between gap-4">
						<div className="space-y-1">
							<h1 className="flex items-center gap-2 font-semibold text-2xl">
								<RiBarChartLine className="size-6" />
								Reports & Analytics
							</h1>
							<p className="text-muted-foreground text-sm">
								Comprehensive business intelligence, performance metrics, and
								detailed analytics.
							</p>
						</div>

						{/* Report Controls */}
						<div className="flex items-center gap-2">
							{/* Report Type Filter */}
							<Select value={reportType} onValueChange={setReportType}>
								<SelectTrigger className="w-40">
									<SelectValue placeholder="Report type" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="performance">Performance</SelectItem>
									<SelectItem value="financial">Financial</SelectItem>
									<SelectItem value="agents">Agent Reports</SelectItem>
									<SelectItem value="transactions">Transactions</SelectItem>
								</SelectContent>
							</Select>

							{/* Time Range Filter */}
							<Select value={timeRange} onValueChange={setTimeRange}>
								<SelectTrigger className="w-32">
									<SelectValue placeholder="Time range" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="7d">Last 7 days</SelectItem>
									<SelectItem value="30d">Last 30 days</SelectItem>
									<SelectItem value="90d">Last 90 days</SelectItem>
									<SelectItem value="1y">Last year</SelectItem>
								</SelectContent>
							</Select>

							{/* Refresh Button */}
							<Button variant="outline" size="sm" onClick={handleRefresh}>
								<RiRefreshLine className="size-4" />
							</Button>
						</div>
					</div>

					{/* Report Summary Cards */}
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="font-medium text-sm">
									Total Revenue
								</CardTitle>
								<RiBarChartLine className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								{isLoadingStats ? (
									<div className="space-y-2">
										<div className="h-8 w-24 bg-muted animate-pulse rounded" />
										<div className="h-3 w-32 bg-muted animate-pulse rounded" />
									</div>
								) : (
									<>
										<div className="font-bold text-2xl">
											${(dashboardStats?.transactions?.totalCommission || 0).toLocaleString()}
										</div>
										<p className="text-muted-foreground text-xs">
											Total transaction value
										</p>
									</>
								)}
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="font-medium text-sm">
									Transactions
								</CardTitle>
								<RiFileTextLine className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								{isLoadingStats ? (
									<div className="space-y-2">
										<div className="h-8 w-16 bg-muted animate-pulse rounded" />
										<div className="h-3 w-24 bg-muted animate-pulse rounded" />
									</div>
								) : (
									<>
										<div className="font-bold text-2xl">
											{dashboardStats?.transactions?.totalTransactions || 0}
										</div>
										<p className="text-muted-foreground text-xs">
											Total transactions
										</p>
									</>
								)}
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="font-medium text-sm">
									Avg Deal Size
								</CardTitle>
								<RiBarChartLine className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								{isLoadingStats ? (
									<div className="space-y-2">
										<div className="h-8 w-20 bg-muted animate-pulse rounded" />
										<div className="h-3 w-24 bg-muted animate-pulse rounded" />
									</div>
								) : (
									<>
										<div className="font-bold text-2xl">
											${(dashboardStats?.transactions?.averageCommission || 0).toLocaleString()}
										</div>
										<p className="text-muted-foreground text-xs">
											Average per transaction
										</p>
									</>
								)}
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="font-medium text-sm">
									Active Agents
								</CardTitle>
								<RiBarChartLine className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								{isLoadingStats ? (
									<div className="space-y-2">
										<div className="h-8 w-16 bg-muted animate-pulse rounded" />
										<div className="h-3 w-24 bg-muted animate-pulse rounded" />
									</div>
								) : (
									<>
										<div className="font-bold text-2xl">
											{dashboardStats?.agents?.totalAgents || 0}
										</div>
										<p className="text-muted-foreground text-xs">
											Active agents
										</p>
									</>
								)}
							</CardContent>
						</Card>
					</div>

					{/* Reports Interface */}
					<Card>
						<CardHeader>
							<CardTitle>Analytics Dashboard</CardTitle>
							<CardDescription>
								Comprehensive business intelligence and performance analytics
							</CardDescription>
						</CardHeader>
						<CardContent>
							{isLoadingPerformance ? (
								<div className="space-y-6">
									<div className="space-y-2">
										<div className="h-4 w-32 bg-muted animate-pulse rounded" />
										<div className="h-32 w-full bg-muted animate-pulse rounded" />
									</div>
									<div className="space-y-2">
										<div className="h-4 w-40 bg-muted animate-pulse rounded" />
										<div className="h-24 w-full bg-muted animate-pulse rounded" />
									</div>
								</div>
							) : performanceAnalytics && performanceAnalytics.periods && performanceAnalytics.periods.length > 0 ? (
								<div className="space-y-6">
									<div>
										<h4 className="font-medium mb-3">Performance Overview</h4>
										<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
											{performanceAnalytics.periods.slice(0, 6).map((metric, index) => (
												<div key={index} className="p-4 border rounded-lg">
													<div className="flex items-center justify-between mb-2">
														<span className="text-sm font-medium">
															Agent Performance
														</span>
														<span className="text-xs text-muted-foreground">
															{metric.periodStart ? new Date(metric.periodStart).toLocaleDateString() : 'N/A'}
														</span>
													</div>
													<div className="space-y-1">
														<div className="text-lg font-semibold">
															${Number(metric.totalCommissionEarned || 0).toLocaleString()}
														</div>
														<div className="text-sm text-muted-foreground">
															{metric.transactionCount || 0} transactions
														</div>
													</div>
												</div>
											))}
										</div>
									</div>

									<div>
										<h4 className="font-medium mb-3">Top Performers</h4>
										<div className="space-y-2">
											{dashboardStats?.topPerformers?.slice(0, 5).map((performer, index) => (
												<div key={index} className="flex items-center justify-between p-3 border rounded-lg">
													<div className="flex items-center gap-3">
														<div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
															<span className="text-sm font-medium text-primary">
																{index + 1}
															</span>
														</div>
														<div>
															<div className="font-medium">{performer.agentName}</div>
															<div className="text-sm text-muted-foreground">
																{performer.totalTransactions} transactions
															</div>
														</div>
													</div>
													<div className="text-right">
														<div className="font-semibold">
															${Number(performer.totalCommission || 0).toLocaleString()}
														</div>
														<div className="text-sm text-muted-foreground">
															Commission earned
														</div>
													</div>
												</div>
											)) || (
												<p className="text-muted-foreground text-center py-4">
													No performance data available
												</p>
											)}
										</div>
									</div>
								</div>
							) : (
								<div className="py-8 text-center">
									<RiBarChartLine
										size={48}
										className="mx-auto mb-4 text-muted-foreground"
									/>
									<h3 className="mb-2 font-semibold text-lg">
										No Analytics Data
									</h3>
									<p className="mb-4 text-muted-foreground">
										No analytics data available for the selected time period. Try adjusting your filters.
									</p>
									<div className="flex justify-center gap-2">
										<Button variant="outline" onClick={handleRefresh}>
											<RiRefreshLine className="mr-2 h-4 w-4" />
											Refresh Data
										</Button>
										<Button variant="outline">
											<RiDownloadLine className="mr-2 h-4 w-4" />
											Export Data
										</Button>
										<Button>
											<RiBarChartLine className="mr-2 h-4 w-4" />
											Generate Report
										</Button>
									</div>
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
