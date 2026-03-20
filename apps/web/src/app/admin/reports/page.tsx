"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { HeaderActions } from "@/components/header-actions";
import { Separator } from "@/components/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/sidebar";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/table";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { LoadingScreen } from "@/components/ui/loading-spinner";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import {
	RiBarChartLine,
	RiDashboardLine,
	RiDownloadLine,
	RiFileTextLine,
	RiGroupLine,
	RiRefreshLine,
	RiSearchLine,
	RiShakeHandsLine,
	RiUserLine,
} from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

export default function AdminReportsPage() {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();
	const [activeTab, setActiveTab] = useState<string>("analytics");
	const [timeRange, setTimeRange] = useState<string>("30d");

	// Advanced filters state
	const [clientTypeFilter, setClientTypeFilter] = useState<string>("all");
	const [searchQuery, setSearchQuery] = useState<string>("");
	const [agencySearch, setAgencySearch] = useState<string>("");

	// Memoize date calculations to prevent infinite query loops
	const dateRange = useMemo(() => {
		const endDate = new Date();
		const startDate =
			timeRange === "7d"
				? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
				: timeRange === "30d"
					? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
					: timeRange === "90d"
						? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
						: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
		return { startDate, endDate };
	}, [timeRange]);

	// Get dashboard statistics
	const { data: dashboardStats, isLoading: isLoadingStats } =
		trpc.reports.getDashboardStats.useQuery(
			{
				startDate: dateRange.startDate,
				endDate: dateRange.endDate,
			},
			{
				enabled: !!session,
				staleTime: 5 * 60 * 1000,
				refetchOnWindowFocus: false,
			},
		);

	// Get performance analytics
	const { data: performanceAnalytics, isLoading: isLoadingPerformance } =
		trpc.reports.getPerformanceAnalytics.useQuery(
			{
				periodType: "monthly",
				startDate: dateRange.startDate,
				endDate: dateRange.endDate,
			},
			{
				enabled: !!session,
				staleTime: 5 * 60 * 1000,
				refetchOnWindowFocus: false,
			},
		);

	// Get co-broking reports
	const { data: coBrokingData, isLoading: isLoadingCoBroking } =
		trpc.reports.getCoBrokingReports.useQuery(
			{
				startDate: dateRange.startDate,
				endDate: dateRange.endDate,
				agencyName: agencySearch || undefined,
			},
			{
				enabled: !!session && activeTab === "co-broking",
				staleTime: 5 * 60 * 1000,
				refetchOnWindowFocus: false,
			},
		);

	// Get client data
	const { data: clientData, isLoading: isLoadingClients } =
		trpc.reports.getClientData.useQuery(
			{
				startDate: dateRange.startDate,
				endDate: dateRange.endDate,
				clientType:
					clientTypeFilter !== "all"
						? ((clientTypeFilter === "owner" ? "buyer" : clientTypeFilter) as
								| "buyer"
								| "seller"
								| "tenant"
								| "landlord")
						: undefined,
				searchQuery: searchQuery || undefined,
			},
			{
				enabled: !!session && activeTab === "clients",
				staleTime: 5 * 60 * 1000,
				refetchOnWindowFocus: false,
			},
		);

	// Get utils for invalidation after mutations
	const utils = trpc.useUtils();

	// CSV Export function
	const exportToCSV = useCallback(
		(data: Record<string, unknown>[], filename: string) => {
			if (!data || data.length === 0) return;

			const headers = Object.keys(data[0] as Record<string, unknown>);
			const csvContent = [
				headers.join(","),
				...data.map((row) =>
					headers
						.map((header) => {
							const value = (row as Record<string, unknown>)[header];
							if (value === null || value === undefined) return "";
							if (typeof value === "object")
								return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
							if (
								typeof value === "string" &&
								(value.includes(",") || value.includes('"'))
							) {
								return `"${value.replace(/"/g, '""')}"`;
							}
							return String(value);
						})
						.join(","),
				),
			].join("\n");

			const blob = new Blob([csvContent], {
				type: "text/csv;charset=utf-8;",
			});
			const link = document.createElement("a");
			link.href = URL.createObjectURL(blob);
			link.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
			link.click();
		},
		[],
	);

	// Export handlers
	const handleExportCoBroking = useCallback(() => {
		if (!coBrokingData?.transactions) return;
		const exportData = coBrokingData.transactions.map((t) => ({
			transactionId: t.id,
			ourAgent: t.agentName,
			partnerAgentName: t.coBrokingData?.agentName || "",
			partnerAgencyName: t.coBrokingData?.agencyName || "",
			partnerContact: t.coBrokingData?.contactInfo || "",
			commissionSplit: t.coBrokingData?.commissionSplit || 0,
			propertyAddress: t.propertyData?.address || "",
			commissionAmount: t.commissionAmount,
			transactionType: t.transactionType,
			status: t.status,
			transactionDate: t.transactionDate,
		}));
		exportToCSV(exportData, "co_broking_report");
	}, [coBrokingData, exportToCSV]);

	const handleExportClients = useCallback(() => {
		if (!clientData?.clients) return;
		const exportData = clientData.clients.flatMap((c) =>
			c.transactions.map((t) => ({
				clientName: c.client?.name || "",
				clientEmail: c.client?.email || "",
				clientPhone: c.client?.phone || "",
				clientType: c.client?.type || "",
				clientSource: c.client?.source || "",
				transactionId: t.id,
				agentName: t.agentName,
				propertyAddress: t.propertyAddress || "",
				propertyPrice: t.propertyPrice || "",
				commissionAmount: t.commissionAmount,
				transactionType: t.transactionType,
				status: t.status,
				transactionDate: t.transactionDate,
			})),
		);
		exportToCSV(exportData, "client_export");
	}, [clientData, exportToCSV]);

	// Show loading while checking authentication
	if (isPending) {
		return <LoadingScreen text="Loading..." />;
	}

	// Redirect if not authenticated
	if (!session) {
		router.push("/login");
		return null;
	}

	// Handle refresh
	const handleRefresh = async () => {
		await Promise.all([
			utils.reports.getDashboardStats.invalidate(),
			utils.reports.getPerformanceAnalytics.invalidate(),
			utils.reports.getCoBrokingReports.invalidate(),
			utils.reports.getClientData.invalidate(),
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
						<HeaderActions />
					</div>
				</header>
				<div className="flex flex-1 flex-col gap-4 py-4 lg:gap-6 lg:py-6">
					{/* Reports Page Header */}
					<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
						<div className="space-y-1">
							<h1 className="flex items-center gap-2 font-semibold text-2xl">
								<RiBarChartLine className="size-6" />
								Reports & Analytics
							</h1>
							<p className="text-muted-foreground text-sm">
								Business intelligence, co-broking reports, and client
								management.
							</p>
						</div>

						{/* Global Controls */}
						<div className="flex flex-wrap items-center gap-2">
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

					{/* Main Tabs Interface */}
					<Tabs
						value={activeTab}
						onValueChange={setActiveTab}
						className="space-y-4"
					>
						<TabsList className="grid w-full grid-cols-3 lg:inline-flex lg:w-auto">
							<TabsTrigger value="analytics" className="gap-2">
								<RiBarChartLine className="size-4" />
								<span className="hidden sm:inline">Analytics</span>
							</TabsTrigger>
							<TabsTrigger value="co-broking" className="gap-2">
								<RiShakeHandsLine className="size-4" />
								<span className="hidden sm:inline">Co-Broking</span>
							</TabsTrigger>
							<TabsTrigger value="clients" className="gap-2">
								<RiUserLine className="size-4" />
								<span className="hidden sm:inline">Clients</span>
							</TabsTrigger>
						</TabsList>

						{/* Analytics Tab */}
						<TabsContent value="analytics" className="space-y-4">
							{/* Summary Cards */}
							{isLoadingStats ? (
								<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
									{["sk-a1", "sk-a2", "sk-a3", "sk-a4"].map((id) => (
										<Card key={id} className="overflow-hidden">
											<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
												<Skeleton className="h-3.5 w-24" />
												<Skeleton className="h-4 w-4 rounded" />
											</CardHeader>
											<CardContent className="space-y-2">
												<Skeleton className="h-8 w-20" />
												<Skeleton className="h-3 w-32" />
											</CardContent>
										</Card>
									))}
								</div>
							) : (
								<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
									<Card>
										<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
											<CardTitle className="font-medium text-sm">
												Total Revenue
											</CardTitle>
											<RiBarChartLine className="h-4 w-4 text-muted-foreground" />
										</CardHeader>
										<CardContent>
											<div className="font-bold text-2xl">
												$
												{(
													dashboardStats?.transactions?.totalCommission || 0
												).toLocaleString()}
											</div>
											<p className="text-muted-foreground text-xs">
												Total commission value
											</p>
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
											<div className="font-bold text-2xl">
												{dashboardStats?.transactions?.totalTransactions || 0}
											</div>
											<p className="text-muted-foreground text-xs">
												Total transactions
											</p>
										</CardContent>
									</Card>
									<Card>
										<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
											<RiBarChartLine className="h-4 w-4 text-muted-foreground" />
										</CardHeader>
										<CardContent>
											<div className="font-bold text-2xl">
												$
												{(
													dashboardStats?.transactions?.averageCommission || 0
												).toLocaleString()}
											</div>
											<p className="text-muted-foreground text-xs">
												Average per transaction
											</p>
										</CardContent>
									</Card>
									<Card>
										<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
											<CardTitle className="font-medium text-sm">
												Active Agents
											</CardTitle>
											<RiGroupLine className="h-4 w-4 text-muted-foreground" />
										</CardHeader>
										<CardContent>
											<div className="font-bold text-2xl">
												{dashboardStats?.agents?.totalAgents || 0}
											</div>
											<p className="text-muted-foreground text-xs">
												Active agents
											</p>
										</CardContent>
									</Card>
								</div>
							)}

							{/* Performance & Top Performers */}
							<Card>
								<CardHeader>
									<CardTitle>Performance Analytics</CardTitle>
									<CardDescription>
										Agent performance and top performers overview
									</CardDescription>
								</CardHeader>
								<CardContent>
									{isLoadingPerformance ? (
										<div className="space-y-6">
											<div className="space-y-3">
												<Skeleton className="h-4 w-40" />
												<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
													{["sk-b1", "sk-b2", "sk-b3"].map((id) => (
														<div
															key={id}
															className="space-y-2 rounded-lg border p-4"
														>
															<div className="flex items-center justify-between">
																<Skeleton className="h-3.5 w-28" />
																<Skeleton className="h-3 w-16" />
															</div>
															<Skeleton className="h-6 w-24" />
															<Skeleton className="h-3 w-20" />
														</div>
													))}
												</div>
											</div>
											<div className="space-y-3">
												<Skeleton className="h-4 w-32" />
												{["sk-c1", "sk-c2", "sk-c3", "sk-c4"].map((id) => (
													<div
														key={id}
														className="flex items-center justify-between rounded-lg border p-3"
													>
														<div className="flex items-center gap-3">
															<Skeleton className="h-8 w-8 rounded-full" />
															<div className="space-y-1.5">
																<Skeleton className="h-4 w-32" />
																<Skeleton className="h-3 w-24" />
															</div>
														</div>
														<div className="space-y-1 text-right">
															<Skeleton className="ml-auto h-4 w-20" />
															<Skeleton className="ml-auto h-3 w-28" />
														</div>
													</div>
												))}
											</div>
										</div>
									) : performanceAnalytics?.periods &&
										performanceAnalytics.periods.length > 0 ? (
										<div className="space-y-6">
											<div>
												<h4 className="mb-3 font-medium">
													Performance Overview
												</h4>
												<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
													{performanceAnalytics.periods
														.slice(0, 6)
														.map((metric, idx) => (
															<div
																key={
																	("periodStart" in metric
																		? String(metric.periodStart)
																		: metric.period) ?? idx
																}
																className="rounded-lg border p-4"
															>
																<div className="mb-2 flex items-center justify-between">
																	<span className="font-medium text-sm">
																		Period Performance
																	</span>
																	<span className="text-muted-foreground text-xs">
																		{"periodStart" in metric &&
																		metric.periodStart
																			? new Date(
																					metric.periodStart as string,
																				).toLocaleDateString()
																			: (metric.period ?? "N/A")}
																	</span>
																</div>
																<div className="space-y-1">
																	<div className="font-semibold text-lg">
																		$
																		{Number(
																			("totalCommissionEarned" in metric
																				? metric.totalCommissionEarned
																				: metric.totalCommission) || 0,
																		).toLocaleString()}
																	</div>
																	<div className="text-muted-foreground text-sm">
																		{Number(
																			"transactionCount" in metric
																				? metric.transactionCount
																				: metric.totalTransactions || 0,
																		)}{" "}
																		transactions
																	</div>
																</div>
															</div>
														))}
												</div>
											</div>

											<div>
												<h4 className="mb-3 font-medium">Top Performers</h4>
												<div className="space-y-2">
													{dashboardStats?.topPerformers
														?.slice(0, 5)
														.map((performer, idx) => (
															<div
																key={performer.agentId ?? idx}
																className="flex items-center justify-between rounded-lg border p-3"
															>
																<div className="flex items-center gap-3">
																	<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
																		<span className="font-medium text-primary text-sm">
																			{idx + 1}
																		</span>
																	</div>
																	<div>
																		<div className="font-medium">
																			{performer.agentName}
																		</div>
																		<div className="text-muted-foreground text-sm">
																			{performer.totalTransactions} transactions
																		</div>
																	</div>
																</div>
																<div className="text-right">
																	<div className="font-semibold">
																		$
																		{Number(
																			performer.totalCommission || 0,
																		).toLocaleString()}
																	</div>
																	<div className="text-muted-foreground text-sm">
																		Commission earned
																	</div>
																</div>
															</div>
														)) || (
														<p className="py-4 text-center text-muted-foreground">
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
												No analytics data available for the selected time
												period.
											</p>
											<Button variant="outline" onClick={handleRefresh}>
												<RiRefreshLine className="mr-2 h-4 w-4" />
												Refresh Data
											</Button>
										</div>
									)}
								</CardContent>
							</Card>
						</TabsContent>

						{/* Co-Broking Tab */}
						<TabsContent value="co-broking" className="space-y-4">
							{/* Filters */}
							<Card>
								<CardHeader className="pb-3">
									<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
										<div>
											<CardTitle className="flex items-center gap-2">
												<RiShakeHandsLine className="size-5" />
												Co-Broking Reports
											</CardTitle>
											<CardDescription>
												Track co-broking transactions with external agencies
											</CardDescription>
										</div>
										<Button
											variant="outline"
											onClick={handleExportCoBroking}
											disabled={!coBrokingData?.transactions?.length}
										>
											<RiDownloadLine className="mr-2 h-4 w-4" />
											Export CSV
										</Button>
									</div>
								</CardHeader>
								<CardContent>
									<div className="mb-4 flex flex-wrap gap-3">
										<div className="relative min-w-[200px] flex-1">
											<RiSearchLine className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
											<Input
												placeholder="Search by agency name..."
												value={agencySearch}
												onChange={(e) => setAgencySearch(e.target.value)}
												className="pl-9"
											/>
										</div>
									</div>

									{isLoadingCoBroking ? (
										<div className="overflow-hidden rounded-md border">
											<div className="grid grid-cols-7 gap-4 bg-muted/50 px-4 py-3">
												{[
													"sk-h1",
													"sk-h2",
													"sk-h3",
													"sk-h4",
													"sk-h5",
													"sk-h6",
													"sk-h7",
												].map((id) => (
													<Skeleton key={id} className="h-3.5 w-full" />
												))}
											</div>
											<div className="divide-y">
												{["sk-r1", "sk-r2", "sk-r3", "sk-r4", "sk-r5"].map(
													(id) => (
														<div
															key={id}
															className="grid grid-cols-7 gap-4 px-4 py-3"
														>
															<Skeleton className="h-4 w-full" />
															<Skeleton className="h-4 w-full" />
															<Skeleton className="h-4 w-4/5" />
															<Skeleton className="h-4 w-5/6" />
															<Skeleton className="ml-auto h-4 w-10" />
															<Skeleton className="ml-auto h-4 w-16" />
															<Skeleton className="ml-auto h-5 w-16 rounded-full" />
														</div>
													),
												)}
											</div>
										</div>
									) : coBrokingData?.transactions &&
										coBrokingData.transactions.length > 0 ? (
										<div className="rounded-md border">
											<Table>
												<TableHeader>
													<TableRow>
														<TableHead>Our Agent</TableHead>
														<TableHead>Partner Agency</TableHead>
														<TableHead>Partner Agent</TableHead>
														<TableHead>Property</TableHead>
														<TableHead className="text-right">
															Split %
														</TableHead>
														<TableHead className="text-right">
															Commission
														</TableHead>
														<TableHead>Status</TableHead>
													</TableRow>
												</TableHeader>
												<TableBody>
													{coBrokingData.transactions.map((t) => (
														<TableRow key={t.id}>
															<TableCell className="font-medium">
																{t.agentName}
															</TableCell>
															<TableCell>
																{t.coBrokingData?.agencyName || "-"}
															</TableCell>
															<TableCell>
																{t.coBrokingData?.agentName || "-"}
															</TableCell>
															<TableCell className="max-w-[200px] truncate">
																{t.propertyData?.address || "-"}
															</TableCell>
															<TableCell className="text-right">
																{t.coBrokingData?.commissionSplit || 0}%
															</TableCell>
															<TableCell className="text-right font-medium">
																$
																{Number(
																	t.commissionAmount || 0,
																).toLocaleString()}
															</TableCell>
															<TableCell>
																<Badge
																	variant={
																		t.status === "completed"
																			? "default"
																			: "secondary"
																	}
																>
																	{t.status}
																</Badge>
															</TableCell>
														</TableRow>
													))}
												</TableBody>
											</Table>
										</div>
									) : (
										<div className="py-8 text-center">
											<RiShakeHandsLine
												size={48}
												className="mx-auto mb-4 text-muted-foreground"
											/>
											<h3 className="mb-2 font-semibold text-lg">
												No Co-Broking Transactions
											</h3>
											<p className="text-muted-foreground">
												No co-broking transactions found for the selected
												period.
											</p>
										</div>
									)}

									{/* Summary Stats */}
									{coBrokingData?.summary && (
										<div className="mt-4 grid gap-4 md:grid-cols-3">
											<div className="rounded-lg border p-4">
												<div className="text-muted-foreground text-sm">
													Total Co-Broking Deals
												</div>
												<div className="font-bold text-2xl">
													{coBrokingData.summary.totalCoBrokingDeals}
												</div>
											</div>
											<div className="rounded-lg border p-4">
												<div className="text-muted-foreground text-sm">
													Total Commission
												</div>
												<div className="font-bold text-2xl">
													$
													{Number(
														coBrokingData.summary.totalCoBrokingCommission || 0,
													).toLocaleString()}
												</div>
											</div>
											<div className="rounded-lg border p-4">
												<div className="text-muted-foreground text-sm">
													Partner Agencies
												</div>
												<div className="font-bold text-2xl">
													{coBrokingData.summary.uniquePartnerAgencies}
												</div>
											</div>
										</div>
									)}
								</CardContent>
							</Card>
						</TabsContent>

						{/* Clients Tab */}
						<TabsContent value="clients" className="space-y-4">
							<Card>
								<CardHeader className="pb-3">
									<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
										<div>
											<CardTitle className="flex items-center gap-2">
												<RiUserLine className="size-5" />
												Client Export
											</CardTitle>
											<CardDescription>
												Export client data with transaction history
											</CardDescription>
										</div>
										<Button
											variant="outline"
											onClick={handleExportClients}
											disabled={!clientData?.clients?.length}
										>
											<RiDownloadLine className="mr-2 h-4 w-4" />
											Export CSV
										</Button>
									</div>
								</CardHeader>
								<CardContent>
									{/* Filters */}
									<div className="mb-4 flex flex-wrap gap-3">
										<div className="relative min-w-[200px] flex-1">
											<RiSearchLine className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
											<Input
												placeholder="Search clients..."
												value={searchQuery}
												onChange={(e) => setSearchQuery(e.target.value)}
												className="pl-9"
											/>
										</div>
										<Select
											value={clientTypeFilter}
											onValueChange={setClientTypeFilter}
										>
											<SelectTrigger className="w-40">
												<SelectValue placeholder="Client type" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="all">All Types</SelectItem>
												<SelectItem value="buyer">Buyer</SelectItem>
												<SelectItem value="seller">Seller</SelectItem>
												<SelectItem value="landlord">Landlord</SelectItem>
												<SelectItem value="tenant">Tenant</SelectItem>
											</SelectContent>
										</Select>
									</div>

									{isLoadingClients ? (
										<div className="overflow-hidden rounded-md border">
											<div className="grid grid-cols-7 gap-4 bg-muted/50 px-4 py-3">
												{[
													"sk-h1",
													"sk-h2",
													"sk-h3",
													"sk-h4",
													"sk-h5",
													"sk-h6",
													"sk-h7",
												].map((id) => (
													<Skeleton key={id} className="h-3.5 w-full" />
												))}
											</div>
											<div className="divide-y">
												{[
													"sk-r1",
													"sk-r2",
													"sk-r3",
													"sk-r4",
													"sk-r5",
													"sk-r6",
												].map((id) => (
													<div
														key={id}
														className="grid grid-cols-7 gap-4 px-4 py-3"
													>
														<Skeleton className="h-4 w-full" />
														<Skeleton className="h-4 w-5/6" />
														<Skeleton className="h-4 w-4/5" />
														<Skeleton className="h-5 w-16 rounded-full" />
														<Skeleton className="h-4 w-full" />
														<Skeleton className="ml-auto h-4 w-8" />
														<Skeleton className="ml-auto h-4 w-16" />
													</div>
												))}
											</div>
										</div>
									) : clientData?.clients && clientData.clients.length > 0 ? (
										<div className="rounded-md border">
											<Table>
												<TableHeader>
													<TableRow>
														<TableHead>Client Name</TableHead>
														<TableHead>Email</TableHead>
														<TableHead>Phone</TableHead>
														<TableHead>Type</TableHead>
														<TableHead>Source</TableHead>
														<TableHead className="text-right">
															Transactions
														</TableHead>
														<TableHead className="text-right">
															Total Value
														</TableHead>
													</TableRow>
												</TableHeader>
												<TableBody>
													{clientData.clients.map((c) => (
														<TableRow
															key={
																c.client?.email ??
																c.transactions?.[0]?.id ??
																String(Math.random())
															}
														>
															<TableCell className="font-medium">
																{c.client?.name || "-"}
															</TableCell>
															<TableCell>{c.client?.email || "-"}</TableCell>
															<TableCell>{c.client?.phone || "-"}</TableCell>
															<TableCell>
																<Badge variant="outline">
																	{c.client?.type || "-"}
																</Badge>
															</TableCell>
															<TableCell>{c.client?.source || "-"}</TableCell>
															<TableCell className="text-right">
																{c.transactions?.length || 0}
															</TableCell>
															<TableCell className="text-right font-medium">
																$
																{c.transactions
																	?.reduce(
																		(sum, t) =>
																			sum + Number(t.commissionAmount || 0),
																		0,
																	)
																	.toLocaleString()}
															</TableCell>
														</TableRow>
													))}
												</TableBody>
											</Table>
										</div>
									) : (
										<div className="py-8 text-center">
											<RiUserLine
												size={48}
												className="mx-auto mb-4 text-muted-foreground"
											/>
											<h3 className="mb-2 font-semibold text-lg">
												No Clients Found
											</h3>
											<p className="text-muted-foreground">
												No clients found matching your search criteria.
											</p>
										</div>
									)}

									{/* Summary Stats */}
									{clientData?.clientTypeSummary && (
										<div className="mt-4 grid gap-4 md:grid-cols-4">
											<div className="rounded-lg border p-4">
												<div className="text-muted-foreground text-sm">
													Total Clients
												</div>
												<div className="font-bold text-2xl">
													{clientData.totalClients}
												</div>
											</div>
											<div className="rounded-lg border p-4">
												<div className="text-muted-foreground text-sm">
													Buyers
												</div>
												<div className="font-bold text-2xl">
													{clientData.clientTypeSummary?.buyer?.count || 0}
												</div>
											</div>
											<div className="rounded-lg border p-4">
												<div className="text-muted-foreground text-sm">
													Sellers
												</div>
												<div className="font-bold text-2xl">
													{clientData.clientTypeSummary?.seller?.count || 0}
												</div>
											</div>
											<div className="rounded-lg border p-4">
												<div className="text-muted-foreground text-sm">
													Tenants/Landlords
												</div>
												<div className="font-bold text-2xl">
													{(clientData.clientTypeSummary?.tenant?.count || 0) +
														(clientData.clientTypeSummary?.landlord?.count ||
															0)}
												</div>
											</div>
										</div>
									)}
								</CardContent>
							</Card>
						</TabsContent>
					</Tabs>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
