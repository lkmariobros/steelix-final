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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import UserDropdown from "@/components/user-dropdown";
import {
	FinancialOverview,
	SalesPipeline,
	TransactionStatus,
} from "@/dashboards/agent";
import { MonthlyPerformance } from "@/dashboards/agent/components/monthly-performance";
import {
	RiBarChartLine,
	RiDashboardLine,
	RiRefreshLine,
} from "@remixicon/react";
import { useEffect, useState } from "react";

export default function PipelinePage() {
	const [timeFilter, setTimeFilter] = useState<string>("all");
	const [dateRange, setDateRange] = useState<{
		startDate?: Date;
		endDate?: Date;
	}>({});
	const [currentTime, setCurrentTime] = useState<string>("");

	// Update time on client side only to avoid hydration mismatch
	useEffect(() => {
		setCurrentTime(new Date().toLocaleTimeString());
	}, []);

	// Handle time filter changes
	const handleTimeFilterChange = (value: string) => {
		setTimeFilter(value);
		const now = new Date();

		switch (value) {
			case "7d":
				setDateRange({
					startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
					endDate: now,
				});
				break;
			case "30d":
				setDateRange({
					startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
					endDate: now,
				});
				break;
			case "90d":
				setDateRange({
					startDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
					endDate: now,
				});
				break;
			case "1y":
				setDateRange({
					startDate: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
					endDate: now,
				});
				break;
			default:
				setDateRange({});
				break;
		}
	};

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
									<BreadcrumbLink href="/dashboard">
										<RiDashboardLine size={22} aria-hidden="true" />
										<span className="sr-only">Dashboard</span>
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator className="hidden md:block" />
								<BreadcrumbItem>
									<BreadcrumbPage className="flex items-center gap-2">
										<RiBarChartLine size={18} />
										Pipeline Management
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
					{/* Pipeline Page Header */}
					<div className="flex items-center justify-between gap-4">
						<div className="space-y-1">
							<h1 className="flex items-center gap-2 font-semibold text-2xl">
								<RiBarChartLine className="size-6" />
								Pipeline Management
							</h1>
							<p className="text-muted-foreground text-sm">
								Detailed view of your sales pipeline, transaction status, and
								performance trends.
							</p>
						</div>

						{/* Pipeline Controls */}
						<div className="flex items-center gap-2">
							{/* Time Filter */}
							<Select value={timeFilter} onValueChange={handleTimeFilterChange}>
								<SelectTrigger className="w-32">
									<SelectValue placeholder="Time range" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All time</SelectItem>
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

					{/* Pipeline Dashboard Grid */}
					<div className="grid gap-6">
						{/* Financial Overview - Full Width */}
						<div className="col-span-full">
							<FinancialOverview dateRange={dateRange} />
						</div>

						{/* Monthly Performance - Full Width */}
						<div className="col-span-full">
							<MonthlyPerformance dateRange={dateRange} />
						</div>

						{/* Detailed Pipeline Views */}
						<div className="grid gap-6 lg:grid-cols-2">
							<SalesPipeline />
							<TransactionStatus />
						</div>
					</div>

					{/* Pipeline Actions Footer */}
					<div className="mt-8 border-t pt-6">
						<div className="flex items-center justify-between">
							<div className="text-muted-foreground text-sm">
								Pipeline last updated: {currentTime || "Loading..."}
							</div>
							<div className="flex items-center gap-2">
								<Button variant="outline" size="sm">
									Export Pipeline Report
								</Button>
								<Button size="sm">Add New Deal</Button>
							</div>
						</div>
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
