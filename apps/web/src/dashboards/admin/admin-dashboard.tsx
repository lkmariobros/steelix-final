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
import { formatDateDMY } from "@/lib/date-format";
import { RiCalendarLine, RiLoader4Line, RiRefreshLine } from "@remixicon/react";
import { useState } from "react";

import { AgentPerformanceGrid } from "./widgets/agent-performance-grid";
import { CommissionApprovalQueue } from "./widgets/commission-approval-queue";
import { DashboardSummary } from "./widgets/dashboard-summary";
import { DealMixPanel } from "./widgets/deal-mix-panel";

function AdminDashboardContent({ className }: { className?: string }) {
	const { dateRange, setDateRange, isRefetching, refetch } =
		useAdminDashboard();
	const [timeFilter, setTimeFilter] = useState<string>("quarter");
	const [isCalendarOpen, setIsCalendarOpen] = useState(false);

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

	const formatDateRange = () => {
		if (dateRange.startDate && dateRange.endDate) {
			return `${formatDateDMY(dateRange.startDate)} – ${formatDateDMY(dateRange.endDate)}`;
		}
		return "All time";
	};

	const filters = [
		{ key: "all", label: "All" },
		{ key: "today", label: "Today" },
		{ key: "week", label: "Week" },
		{ key: "month", label: "Month" },
		{ key: "quarter", label: "Quarter" },
		{ key: "year", label: "Year" },
	];

	return (
		<div className={cn("flex min-w-0 flex-col gap-6", className)}>
			<div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
				<div className="flex min-w-0 flex-col gap-1.5">
					<h1 className="font-semibold text-2xl tracking-tight text-foreground sm:text-[1.75rem]">
						Admin Dashboard
					</h1>
					<p className="max-w-xl text-muted-foreground text-sm">
						Manage commissions, monitor performance, and oversee operations
					</p>
				</div>

				<div className="flex min-w-0 flex-wrap items-center gap-2">
					<div className="flex max-w-full flex-wrap items-center gap-0.5 rounded-full border border-border/70 bg-card p-1 shadow-card">
						{filters.map((f) => (
							<button
								key={f.key}
								type="button"
								onClick={() => handleTimeFilterChange(f.key)}
								className={cn(
									"h-8 shrink-0 rounded-full px-2.5 font-medium text-xs transition-colors sm:px-3",
									timeFilter === f.key
										? "bg-primary text-primary-foreground shadow-sm"
										: "text-muted-foreground hover:bg-muted hover:text-foreground",
								)}
							>
								{f.label}
							</button>
						))}
					</div>

					<Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="h-9 max-w-full gap-2 truncate rounded-full border-border/70 bg-card shadow-card"
							>
								<RiCalendarLine size={14} className="shrink-0" />
								<span className="truncate">{formatDateRange()}</span>
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-0" align="end">
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
								numberOfMonths={1}
								required={false}
							/>
						</PopoverContent>
					</Popover>

					<Button
						variant="outline"
						size="sm"
						onClick={refetch}
						disabled={isRefetching}
						className="h-9 gap-2 rounded-full border-border/70 bg-card shadow-card"
					>
						<RiRefreshLine
							size={14}
							className={isRefetching ? "animate-spin" : ""}
						/>
						<span className="hidden sm:inline">
							{isRefetching ? "Refreshing…" : "Refresh"}
						</span>
					</Button>
				</div>
			</div>

			<div className="grid min-w-0 gap-5">
				<div className="col-span-full min-w-0">
					<DashboardSummary />
				</div>

				{/* Stack until xl so MacBook + sidebar doesn't crush the queue table */}
				<div className="grid min-w-0 items-stretch gap-5 xl:grid-cols-3">
					<div className="flex min-h-0 min-w-0 xl:col-span-2">
						<CommissionApprovalQueue className="w-full min-w-0" />
					</div>
					<div className="flex min-h-0 min-w-0 xl:col-span-1">
						<DealMixPanel className="w-full min-w-0" />
					</div>
				</div>

				<div className="col-span-full min-w-0">
					<AgentPerformanceGrid />
				</div>
			</div>

			{isRefetching && (
				<div className="flex items-center gap-2 text-muted-foreground text-sm">
					<RiLoader4Line className="size-3.5 animate-spin" />
					Refreshing data…
				</div>
			)}
		</div>
	);
}

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
