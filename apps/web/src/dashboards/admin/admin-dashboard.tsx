"use client";

import { Separator } from "@/components/separator";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { RiCalendarLine, RiRefreshLine } from "@remixicon/react";
import { format } from "date-fns";
import { useState } from "react";

import { AgentPerformanceGrid } from "./widgets/agent-performance-grid";
// Import admin dashboard widgets
import { CommissionApprovalQueue } from "./widgets/commission-approval-queue";
import { DashboardSummary } from "./widgets/dashboard-summary";
import { UrgentTasksPanel } from "./widgets/urgent-tasks-panel";

// Import types
import type { DateRangeFilter } from "./admin-schema";

interface AdminDashboardProps {
	className?: string;
}

export function AdminDashboard({ className }: AdminDashboardProps) {
	const [dateRange, setDateRange] = useState<DateRangeFilter>({});
	const [timeFilter, setTimeFilter] = useState<string>("all");
	const [isCalendarOpen, setIsCalendarOpen] = useState(false);
	const [refreshKey, setRefreshKey] = useState(0);
	// Removed currentTime to fix hydration mismatch

	// Handle date range selection
	const handleDateRangeSelect = (
		range: { from?: Date; to?: Date } | undefined,
	) => {
		if (!range) {
			setDateRange({});
			return;
		}
		setDateRange({
			startDate: range.from,
			endDate: range.to,
		});
		// Only close the popover when both dates are selected
		if (range.from && range.to) {
			setTimeFilter("custom");
			setIsCalendarOpen(false);
		}
	};

	// Handle time filter change - uses dynamic date calculation
	const handleTimeFilterChange = (filter: string) => {
		setTimeFilter(filter);

		// Calculate date ranges dynamically based on current date
		const now = new Date();
		const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

		const getDateRange = (filterKey: string): { startDate?: Date; endDate?: Date } => {
			switch (filterKey) {
				case "today":
					return {
						startDate: startOfToday,
						endDate: endOfToday,
					};
				case "week":
					return {
						startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
						endDate: endOfToday,
					};
				case "month":
					return {
						startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
						endDate: endOfToday,
					};
				case "quarter":
					return {
						startDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
						endDate: endOfToday,
					};
				case "year":
					return {
						startDate: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
						endDate: endOfToday,
					};
				case "all":
				default:
					return {
						startDate: undefined,
						endDate: undefined,
					};
			}
		};

		setDateRange(getDateRange(filter));
	};

	// Handle manual refresh
	const handleRefresh = () => {
		setRefreshKey((prev) => prev + 1);
	};

	// Format date range for display
	const formatDateRange = () => {
		if (!dateRange.startDate && !dateRange.endDate) {
			return "All time";
		}

		if (dateRange.startDate && dateRange.endDate) {
			return `${format(dateRange.startDate, "MMM d")} - ${format(dateRange.endDate, "MMM d, yyyy")}`;
		}

		if (dateRange.startDate) {
			return `From ${format(dateRange.startDate, "MMM d, yyyy")}`;
		}

		if (dateRange.endDate) {
			return `Until ${format(dateRange.endDate, "MMM d, yyyy")}`;
		}

		return "All time";
	};

	return (
		<div className={cn("flex flex-col gap-6", className)}>
			{/* Dashboard Header */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-col gap-1">
					<h1 className="font-semibold text-2xl tracking-tight">
						Admin Dashboard
					</h1>
					<p className="text-muted-foreground text-sm">
						Manage commissions, monitor performance, and oversee operations
					</p>
				</div>

				{/* Dashboard Controls */}
				<div className="flex flex-wrap items-center gap-2">
					{/* Time Filter Buttons */}
					<div className="flex items-center gap-1 rounded-md border p-1">
						{[
							{ key: "all", label: "All" },
							{ key: "today", label: "Today" },
							{ key: "week", label: "Week" },
							{ key: "month", label: "Month" },
							{ key: "quarter", label: "Quarter" },
							{ key: "year", label: "Year" },
						].map((filter) => (
							<Button
								key={filter.key}
								variant={timeFilter === filter.key ? "default" : "ghost"}
								size="sm"
								onClick={() => handleTimeFilterChange(filter.key)}
								className="h-7 px-2 text-xs"
							>
								{filter.label}
							</Button>
						))}
					</div>

					{/* Custom Date Range Picker */}
					<Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
						<PopoverTrigger asChild>
							<Button variant="outline" size="sm" className="h-8 gap-2 text-xs">
								<RiCalendarLine size={14} />
								{formatDateRange()}
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-auto p-0" align="end">
							<Calendar
								mode="range"
								selected={{
									from: dateRange.startDate,
									to: dateRange.endDate,
								}}
								onSelect={handleDateRangeSelect}
								numberOfMonths={2}
								required={false}
							/>
						</PopoverContent>
					</Popover>

					<Separator orientation="vertical" className="h-6" />

					{/* Refresh Button */}
					<Button
						variant="outline"
						size="sm"
						onClick={handleRefresh}
						className="h-8 gap-2 text-xs"
					>
						<RiRefreshLine size={14} />
						Refresh
					</Button>
				</div>
			</div>

			{/* Dashboard Grid - Optimized Layout */}
			<div className="grid gap-6">
				{/* Dashboard Summary - Full Width */}
				<div className="col-span-full">
					<DashboardSummary dateRange={dateRange} refreshKey={refreshKey} />
				</div>

				{/* Second Row - Commission Queue and Urgent Tasks */}
				<div className="grid gap-6 lg:grid-cols-3">
					<div className="lg:col-span-2">
						<CommissionApprovalQueue
							dateRange={dateRange}
							refreshKey={refreshKey}
						/>
					</div>
					<div className="lg:col-span-1">
						<UrgentTasksPanel refreshKey={refreshKey} />
					</div>
				</div>

				{/* Third Row - Agent Performance Grid - Full Width */}
				<div className="col-span-full">
					<AgentPerformanceGrid dateRange={dateRange} refreshKey={refreshKey} />
				</div>
			</div>
		</div>
	);
}
