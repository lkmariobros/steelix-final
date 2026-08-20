"use client";

import { HeaderActions } from "@/components/header-actions";
import { Separator } from "@/components/separator";
import { SidebarTrigger } from "@/components/sidebar";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/table";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetricCard } from "@/dashboards/admin/widgets/metric-card";
import { authClient } from "@/lib/auth-client";
import { formatCurrency } from "@/lib/format-currency";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import {
	RiBarChartLine,
	RiDashboardLine,
	RiDownloadLine,
	RiFileTextLine,
	RiGroupLine,
	RiMoneyDollarCircleLine,
	RiRefreshLine,
	RiSearchLine,
	RiShakeHandsLine,
	RiUserLine,
} from "@remixicon/react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

const thClass =
	"h-11 bg-muted/50 px-4 font-semibold text-foreground/80 text-xs tracking-wide";
const tdClass = "px-4 py-3.5 align-middle text-sm";

function statusPill(status: string | null | undefined) {
	const s = (status ?? "").toLowerCase();
	const className =
		s === "completed" || s === "approved" || s === "verified"
			? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-300"
			: s === "pending" || s.includes("pending")
				? "bg-amber-100 text-amber-800 dark:bg-amber-900/35 dark:text-amber-300"
				: s === "draft"
					? "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300"
					: "bg-muted text-muted-foreground";
	return (
		<span
			className={cn(
				"inline-flex rounded-full px-2.5 py-0.5 font-medium text-[11px] capitalize",
				className,
			)}
		>
			{(status ?? "—").replace(/_/g, " ")}
		</span>
	);
}

export default function AdminReportsPage() {
	const { data: session } = authClient.useSession();
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
										<RiBarChartLine size={16} aria-hidden="true" />
									</span>
									Reports & Analytics
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
				<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div className="min-w-0 space-y-1">
						<h1 className="font-bold text-2xl tracking-tight">
							Reports & Analytics
						</h1>
						<p className="text-muted-foreground text-sm">
							Business intelligence, co-broking reports, and client management.
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<Select value={timeRange} onValueChange={setTimeRange}>
							<SelectTrigger className="h-9 w-[148px] rounded-full border-border/70 bg-card shadow-card">
								<SelectValue placeholder="Time range" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="7d">Last 7 days</SelectItem>
								<SelectItem value="30d">Last 30 days</SelectItem>
								<SelectItem value="90d">Last 90 days</SelectItem>
								<SelectItem value="1y">Last year</SelectItem>
							</SelectContent>
						</Select>

						<Button
							variant="outline"
							size="icon"
							aria-label="Refresh reports"
							onClick={handleRefresh}
							className="size-9 rounded-full border-border/70 bg-card shadow-card"
						>
							<RiRefreshLine className="size-4" />
						</Button>
					</div>
				</div>

				<Tabs
					value={activeTab}
					onValueChange={setActiveTab}
					className="space-y-5"
				>
					<TabsList className="h-auto w-full justify-start gap-1 rounded-full border border-border/60 bg-muted/40 p-1 shadow-sm lg:w-auto">
						<TabsTrigger
							value="analytics"
							className="gap-1.5 rounded-full px-3.5 py-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
						>
							<RiBarChartLine className="size-3.5" />
							<span className="hidden sm:inline">Analytics</span>
						</TabsTrigger>
						<TabsTrigger
							value="co-broking"
							className="gap-1.5 rounded-full px-3.5 py-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
						>
							<RiShakeHandsLine className="size-3.5" />
							<span className="hidden sm:inline">Co-Broking</span>
						</TabsTrigger>
						<TabsTrigger
							value="clients"
							className="gap-1.5 rounded-full px-3.5 py-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
						>
							<RiUserLine className="size-3.5" />
							<span className="hidden sm:inline">Clients</span>
						</TabsTrigger>
					</TabsList>

						{/* Analytics Tab */}
						<TabsContent value="analytics" className="space-y-5">
							{isLoadingStats ? (
								<div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
									{["sk-a1", "sk-a2", "sk-a3", "sk-a4"].map((id) => (
										<div
											key={id}
											className="overflow-hidden rounded-3xl border border-border/40 bg-card p-5 shadow-card"
										>
											<div className="mb-3 flex items-start justify-between">
												<Skeleton className="h-3.5 w-24" />
												<Skeleton className="size-9 rounded-xl" />
											</div>
											<Skeleton className="mb-2 h-8 w-28" />
											<Skeleton className="h-3 w-32" />
										</div>
									))}
								</div>
							) : (
								<div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
									<MetricCard
										title="Total Revenue"
										value={formatCurrency(
											dashboardStats?.transactions?.totalCommission,
										)}
										changeLabel="Total commission value"
										trend="up"
										icon={<RiMoneyDollarCircleLine size={20} />}
										sparkline={[40, 48, 42, 55, 50, 62, 58, 70, 64, 72, 68, 80]}
										variant="gradient"
									/>
									<MetricCard
										title="Transactions"
										value={String(
											dashboardStats?.transactions?.totalTransactions || 0,
										)}
										changeLabel="Total transactions"
										trend="neutral"
										icon={<RiFileTextLine size={20} />}
										sparkline={[28, 35, 32, 40, 38, 48, 45, 52, 50, 58, 55, 62]}
									/>
									<MetricCard
										title="Avg Commission"
										value={formatCurrency(
											dashboardStats?.transactions?.averageCommission,
										)}
										changeLabel="Average per transaction"
										trend="neutral"
										icon={<RiBarChartLine size={20} />}
										sparkline={[35, 42, 38, 50, 45, 55, 52, 60, 58, 65, 62, 70]}
									/>
									<MetricCard
										title="Active Agents"
										value={String(dashboardStats?.agents?.totalAgents || 0)}
										changeLabel="Active agents"
										trend="up"
										icon={<RiGroupLine size={20} />}
										sparkline={[30, 32, 36, 40, 38, 44, 48, 46, 52, 55, 58, 60]}
									/>
								</div>
							)}

							<Card className="gap-0 overflow-hidden border-border/70 py-0 shadow-card">
								<CardHeader className="border-border/60 border-b px-5 py-4">
									<CardTitle className="text-base">
										Performance Analytics
									</CardTitle>
									<CardDescription>
										Agent performance and top performers overview
									</CardDescription>
								</CardHeader>
								<CardContent className="p-5">
									{isLoadingPerformance ? (
										<div className="space-y-6">
											<div className="space-y-3">
												<Skeleton className="h-4 w-40" />
												<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
													{["sk-b1", "sk-b2", "sk-b3"].map((id) => (
														<div
															key={id}
															className="space-y-2 rounded-2xl border border-border/60 p-4 shadow-card"
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
														className="flex items-center justify-between rounded-2xl border border-border/60 p-3 shadow-card"
													>
														<div className="flex items-center gap-3">
															<Skeleton className="size-8 rounded-full" />
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
									) : (performanceAnalytics?.periods &&
											performanceAnalytics.periods.length > 0) ||
										(performanceAnalytics?.transactions &&
											performanceAnalytics.transactions.length > 0) ? (
										<div className="space-y-6">
											{(performanceAnalytics.periods ?? []).length > 0 && (
												<div>
													<h4 className="mb-3 font-medium text-sm">
														Performance Overview
													</h4>
													<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
														{(performanceAnalytics.periods ?? [])
															.slice(0, 6)
															.map((metric, idx) => (
																<div
																	key={
																		metric.periodStart ?? metric.period ?? idx
																	}
																	className="rounded-2xl border border-border/60 bg-card p-4 shadow-card"
																>
																	<div className="mb-2 flex items-center justify-between gap-2">
																		<span className="font-medium text-sm">
																			Period Performance
																		</span>
																		<span className="text-muted-foreground text-xs">
																			{metric.periodStart
																				? new Date(
																						metric.periodStart,
																					).toLocaleDateString()
																				: (metric.period ?? "N/A")}
																		</span>
																	</div>
																	<div className="space-y-1">
																		<div className="font-semibold text-lg tracking-tight">
																			{formatCurrency(metric.totalCommission)}
																		</div>
																		<div className="text-muted-foreground text-sm">
																			{metric.totalTransactions || 0}{" "}
																			transactions
																		</div>
																	</div>
																</div>
															))}
													</div>
												</div>
											)}

											{performanceAnalytics?.transactions &&
												performanceAnalytics.transactions.length > 0 && (
													<div>
														<h4 className="mb-3 font-medium text-sm">
															Transactions in period
														</h4>
														<div className="overflow-hidden rounded-2xl border border-border/60">
															<Table>
																<TableHeader>
																	<TableRow className="hover:bg-transparent">
																		<TableHead className={thClass}>
																			Case / Agent
																		</TableHead>
																		<TableHead className={thClass}>
																			Client / Property
																		</TableHead>
																		<TableHead className={thClass}>
																			Status
																		</TableHead>
																		<TableHead
																			className={cn(thClass, "text-right")}
																		>
																			Commission
																		</TableHead>
																		<TableHead
																			className={cn(thClass, "text-right")}
																		>
																			Date
																		</TableHead>
																	</TableRow>
																</TableHeader>
																<TableBody>
																	{(performanceAnalytics.transactions ?? [])
																		.slice(0, 20)
																		.map((txn) => (
																			<TableRow
																				key={txn.id}
																				className="border-border/50 hover:bg-muted/40"
																			>
																				<TableCell className={tdClass}>
																					<Link
																						href={`/admin/transactions/case/${txn.id}`}
																						className="block hover:underline"
																					>
																						<div className="font-medium">
																							{txn.caseNo ||
																								txn.id.slice(0, 8)}
																						</div>
																						<div className="text-muted-foreground text-xs">
																							{txn.agentName || "—"}
																						</div>
																					</Link>
																				</TableCell>
																				<TableCell className={tdClass}>
																					<div>{txn.clientName || "—"}</div>
																					<div className="text-muted-foreground text-xs">
																						{txn.propertyAddress || "—"}
																					</div>
																				</TableCell>
																				<TableCell className={tdClass}>
																					{statusPill(txn.status)}
																				</TableCell>
																				<TableCell
																					className={cn(
																						tdClass,
																						"text-right font-medium",
																					)}
																				>
																					{formatCurrency(txn.commissionAmount)}
																				</TableCell>
																				<TableCell
																					className={cn(
																						tdClass,
																						"text-right text-muted-foreground",
																					)}
																				>
																					{txn.transactionDate
																						? new Date(
																								txn.transactionDate,
																							).toLocaleDateString()
																						: txn.createdAt
																							? new Date(
																									txn.createdAt,
																								).toLocaleDateString()
																							: "—"}
																				</TableCell>
																			</TableRow>
																		))}
																</TableBody>
															</Table>
														</div>
													</div>
												)}

											<div>
												<h4 className="mb-3 font-medium text-sm">
													Top Performers
												</h4>
												<div className="space-y-2">
													{dashboardStats?.topPerformers
														?.slice(0, 5)
														.map((performer, idx) => (
															<div
																key={performer.agentId ?? idx}
																className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-3 shadow-card"
															>
																<div className="flex items-center gap-3">
																	<div className="flex size-8 items-center justify-center rounded-full bg-primary/12 text-primary">
																		<span className="font-semibold text-sm">
																			{idx + 1}
																		</span>
																	</div>
																	<div>
																		<div className="font-medium">
																			{performer.agentName}
																		</div>
																		<div className="text-muted-foreground text-sm">
																			{performer.totalTransactions}{" "}
																			transactions
																		</div>
																	</div>
																</div>
																<div className="text-right">
																	<div className="font-semibold">
																		{formatCurrency(performer.totalCommission)}
																	</div>
																	<div className="text-muted-foreground text-sm">
																		Commission earned
																	</div>
																</div>
															</div>
														)) || (
														<p className="py-4 text-center text-muted-foreground text-sm">
															No performance data available
														</p>
													)}
												</div>
											</div>
										</div>
									) : (
										<div className="py-10 text-center">
											<div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted/50">
												<RiBarChartLine
													size={28}
													className="text-muted-foreground"
												/>
											</div>
											<h3 className="mb-2 font-semibold text-lg">
												No Analytics Data
											</h3>
											<p className="mb-4 text-muted-foreground text-sm">
												No analytics data available for the selected time
												period.
											</p>
											<Button
												variant="outline"
												onClick={handleRefresh}
												className="h-9 gap-1.5 rounded-full border-border/70 px-4 shadow-card"
											>
												<RiRefreshLine className="size-4" />
												Refresh Data
											</Button>
										</div>
									)}
								</CardContent>
							</Card>
						</TabsContent>

						{/* Co-Broking Tab */}
						<TabsContent value="co-broking" className="space-y-5">
							<Card className="gap-0 overflow-hidden border-border/70 py-0 shadow-card">
								<CardHeader className="border-border/60 border-b px-5 py-4">
									<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
										<div>
											<CardTitle className="flex items-center gap-2 text-base">
												<span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
													<RiShakeHandsLine className="size-4" />
												</span>
												Co-Broking Reports
											</CardTitle>
											<CardDescription className="mt-1">
												Track co-broking transactions with external agencies
											</CardDescription>
										</div>
										<Button
											variant="outline"
											onClick={handleExportCoBroking}
											disabled={!coBrokingData?.transactions?.length}
											className="h-9 gap-1.5 rounded-full border-border/70 bg-card px-4 shadow-card"
										>
											<RiDownloadLine className="size-4" />
											Export CSV
										</Button>
									</div>
								</CardHeader>
								<CardContent className="space-y-4 p-5">
									<div className="flex flex-wrap gap-3">
										<div className="relative min-w-[200px] flex-1">
											<RiSearchLine className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
											<Input
												placeholder="Search by agency name..."
												value={agencySearch}
												onChange={(e) => setAgencySearch(e.target.value)}
												className="h-10 rounded-xl border-border/70 bg-muted/30 pl-9 shadow-none focus-visible:bg-background"
											/>
										</div>
									</div>

									{isLoadingCoBroking ? (
										<div className="overflow-hidden rounded-2xl border border-border/60">
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
											<div className="divide-y divide-border/50">
												{["sk-r1", "sk-r2", "sk-r3", "sk-r4", "sk-r5"].map(
													(id) => (
														<div
															key={id}
															className="grid grid-cols-7 gap-4 px-4 py-3.5"
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
										<div className="overflow-hidden rounded-2xl border border-border/60">
											<Table>
												<TableHeader>
													<TableRow className="hover:bg-transparent">
														<TableHead className={thClass}>Our Agent</TableHead>
														<TableHead className={thClass}>
															Partner Agency
														</TableHead>
														<TableHead className={thClass}>
															Partner Agent
														</TableHead>
														<TableHead className={thClass}>Property</TableHead>
														<TableHead className={cn(thClass, "text-right")}>
															Split %
														</TableHead>
														<TableHead className={cn(thClass, "text-right")}>
															Commission
														</TableHead>
														<TableHead className={thClass}>Status</TableHead>
													</TableRow>
												</TableHeader>
												<TableBody>
													{coBrokingData.transactions.map((t) => (
														<TableRow
															key={t.id}
															className="border-border/50 hover:bg-muted/40"
														>
															<TableCell
																className={cn(tdClass, "font-medium")}
															>
																<Link
																	href={`/admin/transactions/case/${t.id}`}
																	className="hover:underline"
																>
																	{t.agentName}
																</Link>
															</TableCell>
															<TableCell className={tdClass}>
																{t.coBrokingData?.agencyName || "—"}
															</TableCell>
															<TableCell className={tdClass}>
																{t.coBrokingData?.agentName || "—"}
															</TableCell>
															<TableCell
																className={cn(
																	tdClass,
																	"max-w-[200px] truncate",
																)}
															>
																{t.propertyData?.address || "—"}
															</TableCell>
															<TableCell
																className={cn(tdClass, "text-right")}
															>
																{t.coBrokingData?.commissionSplit || 0}%
															</TableCell>
															<TableCell
																className={cn(
																	tdClass,
																	"text-right font-medium",
																)}
															>
																{formatCurrency(t.commissionAmount)}
															</TableCell>
															<TableCell className={tdClass}>
																{statusPill(t.status)}
															</TableCell>
														</TableRow>
													))}
												</TableBody>
											</Table>
										</div>
									) : (
										<div className="py-10 text-center">
											<div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted/50">
												<RiShakeHandsLine
													size={28}
													className="text-muted-foreground"
												/>
											</div>
											<h3 className="mb-2 font-semibold text-lg">
												No Co-Broking Transactions
											</h3>
											<p className="text-muted-foreground text-sm">
												No co-broking transactions found for the selected
												period.
											</p>
										</div>
									)}

									{coBrokingData?.summary && (
										<div className="grid items-stretch gap-4 md:grid-cols-3">
											<MetricCard
												title="Total Co-Broking Deals"
												value={String(
													coBrokingData.summary.totalCoBrokingDeals,
												)}
												changeLabel="Deals in selected period"
												trend="neutral"
												icon={<RiShakeHandsLine size={20} />}
												sparkline={[
													22, 28, 26, 34, 32, 40, 38, 45, 42, 50, 48, 55,
												]}
											/>
											<MetricCard
												title="Total Commission"
												value={formatCurrency(
													coBrokingData.summary.totalCoBrokingCommission,
												)}
												changeLabel="Co-broking commission"
												trend="up"
												icon={<RiMoneyDollarCircleLine size={20} />}
												sparkline={[
													30, 36, 34, 44, 42, 52, 48, 58, 55, 64, 60, 72,
												]}
												variant="gradient"
											/>
											<MetricCard
												title="Partner Agencies"
												value={String(
													coBrokingData.summary.uniquePartnerAgencies,
												)}
												changeLabel="Unique partner agencies"
												trend="neutral"
												icon={<RiGroupLine size={20} />}
												sparkline={[
													18, 22, 20, 26, 24, 30, 28, 34, 32, 38, 36, 40,
												]}
											/>
										</div>
									)}
								</CardContent>
							</Card>
						</TabsContent>

						{/* Clients Tab */}
						<TabsContent value="clients" className="space-y-5">
							<Card className="gap-0 overflow-hidden border-border/70 py-0 shadow-card">
								<CardHeader className="border-border/60 border-b px-5 py-4">
									<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
										<div>
											<CardTitle className="flex items-center gap-2 text-base">
												<span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
													<RiUserLine className="size-4" />
												</span>
												Client Export
											</CardTitle>
											<CardDescription className="mt-1">
												Export client data with transaction history
											</CardDescription>
										</div>
										<Button
											variant="outline"
											onClick={handleExportClients}
											disabled={!clientData?.clients?.length}
											className="h-9 gap-1.5 rounded-full border-border/70 bg-card px-4 shadow-card"
										>
											<RiDownloadLine className="size-4" />
											Export CSV
										</Button>
									</div>
								</CardHeader>
								<CardContent className="space-y-4 p-5">
									<div className="flex flex-wrap gap-2.5">
										<div className="relative min-w-[200px] flex-1">
											<RiSearchLine className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
											<Input
												placeholder="Search clients..."
												value={searchQuery}
												onChange={(e) => setSearchQuery(e.target.value)}
												className="h-10 rounded-xl border-border/70 bg-muted/30 pl-9 shadow-none focus-visible:bg-background"
											/>
										</div>
										<Select
											value={clientTypeFilter}
											onValueChange={setClientTypeFilter}
										>
											<SelectTrigger className="h-10 w-40 rounded-full border-border/70 bg-card shadow-card">
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
										<div className="overflow-hidden rounded-2xl border border-border/60">
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
											<div className="divide-y divide-border/50">
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
														className="grid grid-cols-7 gap-4 px-4 py-3.5"
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
										<div className="overflow-hidden rounded-2xl border border-border/60">
											<Table>
												<TableHeader>
													<TableRow className="hover:bg-transparent">
														<TableHead className={thClass}>
															Client Name
														</TableHead>
														<TableHead className={thClass}>Email</TableHead>
														<TableHead className={thClass}>Phone</TableHead>
														<TableHead className={thClass}>Type</TableHead>
														<TableHead className={thClass}>Source</TableHead>
														<TableHead className={cn(thClass, "text-right")}>
															Transactions
														</TableHead>
														<TableHead className={cn(thClass, "text-right")}>
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
															className="border-border/50 hover:bg-muted/40"
														>
															<TableCell
																className={cn(tdClass, "font-medium")}
															>
																{c.client?.name || "—"}
															</TableCell>
															<TableCell className={tdClass}>
																{c.client?.email || "—"}
															</TableCell>
															<TableCell className={tdClass}>
																{c.client?.phone || "—"}
															</TableCell>
															<TableCell className={tdClass}>
																<span className="inline-flex rounded-full bg-primary/12 px-2.5 py-0.5 font-medium text-[11px] text-primary capitalize">
																	{c.client?.type || "—"}
																</span>
															</TableCell>
															<TableCell className={tdClass}>
																{c.client?.source || "—"}
															</TableCell>
															<TableCell
																className={cn(tdClass, "text-right")}
															>
																{c.transactions?.length || 0}
															</TableCell>
															<TableCell
																className={cn(
																	tdClass,
																	"text-right font-medium",
																)}
															>
																{formatCurrency(
																	c.transactions?.reduce(
																		(sum, t) =>
																			sum + Number(t.commissionAmount || 0),
																		0,
																	),
																)}
															</TableCell>
														</TableRow>
													))}
												</TableBody>
											</Table>
										</div>
									) : (
										<div className="py-10 text-center">
											<div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted/50">
												<RiUserLine
													size={28}
													className="text-muted-foreground"
												/>
											</div>
											<h3 className="mb-2 font-semibold text-lg">
												No Clients Found
											</h3>
											<p className="text-muted-foreground text-sm">
												No clients found matching your search criteria.
											</p>
										</div>
									)}

									{clientData?.clientTypeSummary && (
										<div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
											<MetricCard
												title="Total Clients"
												value={String(clientData.totalClients ?? 0)}
												changeLabel="Clients in selected period"
												trend="neutral"
												icon={<RiUserLine size={20} />}
												sparkline={[
													25, 30, 28, 36, 34, 42, 40, 48, 45, 52, 50, 58,
												]}
												variant="gradient"
											/>
											<MetricCard
												title="Buyers"
												value={String(
													clientData.clientTypeSummary?.buyer?.count || 0,
												)}
												changeLabel="Buyer clients"
												trend="up"
												icon={<RiUserLine size={20} />}
												sparkline={[
													20, 24, 22, 28, 30, 34, 32, 38, 40, 44, 42, 48,
												]}
											/>
											<MetricCard
												title="Sellers"
												value={String(
													clientData.clientTypeSummary?.seller?.count || 0,
												)}
												changeLabel="Seller clients"
												trend="neutral"
												icon={<RiUserLine size={20} />}
												sparkline={[
													18, 22, 26, 24, 30, 28, 34, 32, 38, 36, 42, 40,
												]}
											/>
											<MetricCard
												title="Tenants / Landlords"
												value={String(
													(clientData.clientTypeSummary?.tenant?.count || 0) +
														(clientData.clientTypeSummary?.landlord?.count ||
															0),
												)}
												changeLabel="Rental-side clients"
												trend="neutral"
												icon={<RiGroupLine size={20} />}
												sparkline={[
													15, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38,
												]}
											/>
										</div>
									)}
								</CardContent>
							</Card>
						</TabsContent>
					</Tabs>
				</div>
		</>
	);
}
