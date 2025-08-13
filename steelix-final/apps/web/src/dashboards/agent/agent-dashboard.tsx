"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	RiCalendarLine,
	RiRefreshLine,
	RiSettings3Line,
} from "@remixicon/react";
import { useEffect, useState } from "react";
import { useTransactionModalActions } from "@/contexts/transaction-modal-context";

// Import dashboard widgets
import { FinancialOverview } from "./components/financial-overview";
import { RecentTransactions } from "./components/recent-transactions";
import { SalesPipeline } from "./components/sales-pipeline";
import { TeamLeaderboard } from "./components/team-leaderboard";
import { TransactionStatus } from "./components/transaction-status";

interface AgentDashboardProps {
	className?: string;
}

export function AgentDashboard({ className }: AgentDashboardProps) {
	const { openCreateModal } = useTransactionModalActions();
	const [dateRange, setDateRange] = useState<{
		startDate?: Date;
		endDate?: Date;
	}>({});
	const [timeFilter, setTimeFilter] = useState<string>("all");
	const [isCalendarOpen, setIsCalendarOpen] = useState(false);
	const [currentTime, setCurrentTime] = useState<string>("");

	// Update time on client side only to avoid hydration mismatch
	useEffect(() => {
		setCurrentTime(new Date().toLocaleTimeString());
	}, []);

	// Handle opening transaction modal
	const handleNewTransaction = () => {
		openCreateModal();
	};

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
		// This would trigger a refetch of all queries
		window.location.reload();
	};

	return (
		<div className={className}>
			{/* Dashboard Header */}
			<div className="mb-6 flex items-center justify-between gap-4">
				<div className="space-y-1">
					<h1 className="font-semibold text-2xl">Agent Dashboard</h1>
					<p className="text-muted-foreground text-sm">
						Track your performance, manage your pipeline, and stay connected
						with your team.
					</p>
				</div>

				{/* Dashboard Controls */}
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

					{/* Custom Date Range */}
					<Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
						<PopoverTrigger asChild>
							<Button variant="outline" size="sm">
								<RiCalendarLine className="size-4" />
								{dateRange.startDate && dateRange.endDate
									? `${dateRange.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${dateRange.endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
									: "Custom range"}
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-auto p-0" align="end">
							<Calendar
								mode="range"
								selected={{
									from: dateRange.startDate,
									to: dateRange.endDate,
								}}
								onSelect={(range) => {
									if (range?.from && range?.to) {
										setDateRange({
											startDate: range.from,
											endDate: range.to,
										});
										setTimeFilter("custom");
									}
									setIsCalendarOpen(false);
								}}
								numberOfMonths={2}
							/>
						</PopoverContent>
					</Popover>

					{/* Refresh Button */}
					<Button variant="outline" size="sm" onClick={handleRefresh}>
						<RiRefreshLine className="size-4" />
					</Button>

					{/* Settings Button */}
					<Button variant="outline" size="sm">
						<RiSettings3Line className="size-4" />
					</Button>
				</div>
			</div>

			{/* Dashboard Grid - Optimized Layout */}
			<div className="grid gap-6">
				{/* Financial Overview - Full Width */}
				<div className="col-span-full">
					<FinancialOverview dateRange={dateRange} />
				</div>

				{/* Second Row - Sales Pipeline and Transaction Status */}
				<div className="grid gap-6 md:grid-cols-2">
					<SalesPipeline />
					<TransactionStatus />
				</div>

				{/* Third Row - Recent Transactions and Team Leaderboard */}
				<div className="grid gap-6 md:grid-cols-2">
					<RecentTransactions limit={8} />
					<TeamLeaderboard />
				</div>
			</div>

			{/* Quick Actions Footer */}
			<div className="mt-8 border-t pt-6">
				<div className="flex items-center justify-between">
					<div className="text-muted-foreground text-sm">
						Last updated: {currentTime || "Loading..."}
					</div>
					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm">
							Export Report
						</Button>
						<Button size="sm" onClick={handleNewTransaction}>
							New Transaction
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
