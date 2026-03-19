"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	AdminDashboardProvider,
	useAdminDashboard,
} from "@/contexts/admin-dashboard-context";
import { cn } from "@/lib/utils";
import { RiCalendarLine, RiLoader4Line, RiRefreshLine } from "@remixicon/react";
import { format } from "date-fns";
import { useState } from "react";

import { AgentPerformanceGrid } from "./widgets/agent-performance-grid";
import { CommissionApprovalQueue } from "./widgets/commission-approval-queue";
import { DashboardSummary } from "./widgets/dashboard-summary";
import { UrgentTasksPanel } from "./widgets/urgent-tasks-panel";

// ─── Inner component (consumes context) ──────────────────────────────────────

function AdminDashboardContent({ className }: { className?: string }) {
	const { dateRange, setDateRange, isRefetching, refetch } =
		useAdminDashboard();
	const [timeFilter, setTimeFilter] = useState<string>("all");
	const [isCalendarOpen, setIsCalendarOpen] = useState(false);

	// Handle preset time filters
	const handleTimeFilterChange = (filter: string) => {
		setTimeFilter(filter);
		const now = new Date();
		const endOfToday = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate(),
			23,
			59,
			59,
		);

		const offsets: Record<string, number> = {
			today: 0,
			week: 7,
			month: 30,
			quarter: 90,
			year: 365,
		};
		const days = offsets[filter];

		if (days !== undefined) {
			setDateRange({
				startDate:
					days === 0
						? new Date(now.getFullYear(), now.getMonth(), now.getDate())
						: new Date(now.getTime() - days * 86_400_000),
				endDate: endOfToday,
			});
		} else {
			setDateRange({});
		}
	};

	// Format the active date range for display
	const formatDateRange = () => {
		if (dateRange.startDate && dateRange.endDate) {
			return `${format(dateRange.startDate, "MMM d")} – ${format(dateRange.endDate, "MMM d, yyyy")}`;
		}
		return "All time";
	};

	return (
		<div className={cn("flex flex-col gap-6", className)}>
			{/* Header */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-col gap-1">
					<h1 className="font-semibold text-2xl tracking-tight">
						Admin Dashboard
					</h1>
					<p className="text-muted-foreground text-sm">
						Manage commissions, monitor performance, and oversee operations
					</p>
				</div>

				{/* Controls */}
				<div className="flex flex-wrap items-center gap-2">
					{/* Preset filters */}
					<div className="flex items-center gap-1 rounded-md border p-1">
						{[
							{ key: "all", label: "All" },
							{ key: "today", label: "Today" },
							{ key: "week", label: "Week" },
							{ key: "month", label: "Month" },
							{ key: "quarter", label: "Quarter" },
							{ key: "year", label: "Year" },
						].map((f) => (
							<Button
								key={f.key}
								variant={timeFilter === f.key ? "default" : "ghost"}
								size="sm"
								onClick={() => handleTimeFilterChange(f.key)}
								className="h-7 px-2 text-xs"
							>
								{f.label}
							</Button>
						))}
					</div>

					{/* Custom date range */}
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
								selected={{ from: dateRange.startDate, to: dateRange.endDate }}
								onSelect={(range) => {
									setDateRange({ startDate: range?.from, endDate: range?.to });
									if (range?.from && range?.to) {
										setTimeFilter("custom");
										setIsCalendarOpen(false);
									}
								}}
								numberOfMonths={2}
								required={false}
							/>
						</PopoverContent>
					</Popover>

					{/* Refresh */}
					<Button
						variant="outline"
						size="sm"
						onClick={refetch}
						disabled={isRefetching}
						className="h-8 gap-2 text-xs"
					>
						<RiRefreshLine
							size={14}
							className={isRefetching ? "animate-spin" : ""}
						/>
						{isRefetching ? "Refreshing…" : "Refresh"}
					</Button>
				</div>
			</div>

			{/* Widgets — all read from context, tRPC batches them on mount */}
			<div className="grid gap-6">
				<div className="col-span-full">
					<DashboardSummary />
				</div>

				<div className="grid gap-6 lg:grid-cols-3">
					<div className="lg:col-span-2">
						<CommissionApprovalQueue />
					</div>
					<div className="lg:col-span-1">
						<UrgentTasksPanel />
					</div>
				</div>

				<div className="col-span-full">
					<AgentPerformanceGrid />
				</div>
			</div>

			{/* Footer */}
			{isRefetching && (
				<div className="flex items-center gap-2 text-muted-foreground text-sm">
					<RiLoader4Line className="size-3.5 animate-spin" />
					Refreshing data…
				</div>
			)}
		</div>
	);
}

// ─── Public export (wraps with provider) ─────────────────────────────────────

interface AdminDashboardProps {
	className?: string;
}

export function AdminDashboard({ className }: AdminDashboardProps) {
	return (
		<AdminDashboardProvider>
			<AdminDashboardContent className={className} />
		</AdminDashboardProvider>
	);
}
