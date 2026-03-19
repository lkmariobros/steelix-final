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
	AgentDashboardProvider,
	useAgentDashboard,
} from "@/contexts/agent-dashboard-context";
import { useTransactionModalActions } from "@/contexts/transaction-modal-context";
import {
	RiCalendarLine,
	RiLoader4Line,
	RiRefreshLine,
	RiSettings3Line,
} from "@remixicon/react";
import { useEffect, useState } from "react";

import { FinancialOverview } from "./components/financial-overview";
import { LeadershipBonusWidget } from "./components/leadership-bonus-widget";
import { RecentTransactions } from "./components/recent-transactions";
import { TeamLeaderboard } from "./components/team-leaderboard";
import { TransactionOverview } from "./components/transaction-overview";

// ─── Inner component (consumes context) ──────────────────────────────────────

function DashboardContent() {
	const { openCreateModal } = useTransactionModalActions();
	const { dateRange, setDateRange, isRefetching, refetch } =
		useAgentDashboard();

	const [timeFilter, setTimeFilter] = useState<string>("all");
	const [isCalendarOpen, setIsCalendarOpen] = useState(false);
	const [currentTime, setCurrentTime] = useState<string>("");

	// Avoid hydration mismatch for time display
	useEffect(() => {
		setCurrentTime(new Date().toLocaleTimeString());
	}, []);

	const handleTimeFilterChange = (value: string) => {
		setTimeFilter(value);
		const now = new Date();
		const offsets: Record<string, number> = {
			"7d": 7,
			"30d": 30,
			"90d": 90,
			"1y": 365,
		};
		const days = offsets[value];
		if (days) {
			setDateRange({
				startDate: new Date(now.getTime() - days * 86_400_000),
				endDate: now,
			});
		} else {
			setDateRange({});
		}
	};

	return (
		<div>
			{/* Header */}
			<div className="mb-6 flex items-center justify-between gap-4">
				<div className="space-y-1">
					<h1 className="font-semibold text-2xl">Agent Dashboard</h1>
					<p className="text-muted-foreground text-sm">
						Track your performance, manage your pipeline, and stay connected
						with your team.
					</p>
				</div>

				{/* Controls */}
				<div className="flex items-center gap-2">
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

					<Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
						<PopoverTrigger asChild>
							<Button variant="outline" size="sm">
								<RiCalendarLine className="size-4" />
								{dateRange.startDate && dateRange.endDate
									? `${dateRange.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${dateRange.endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
									: "Custom range"}
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-auto p-0" align="end">
							<Calendar
								mode="range"
								selected={{ from: dateRange.startDate, to: dateRange.endDate }}
								onSelect={(range) => {
									setDateRange({
										startDate: range?.from,
										endDate: range?.to,
									});
									if (range?.from && range?.to) {
										setTimeFilter("custom");
										setIsCalendarOpen(false);
									}
								}}
								numberOfMonths={2}
							/>
						</PopoverContent>
					</Popover>

					<Button
						variant="outline"
						size="sm"
						onClick={refetch}
						disabled={isRefetching}
					>
						<RiRefreshLine
							className={`size-4 ${isRefetching ? "animate-spin" : ""}`}
						/>
					</Button>

					<Button variant="outline" size="sm">
						<RiSettings3Line className="size-4" />
					</Button>
				</div>
			</div>

			{/* Grid */}
			<div className="grid gap-6">
				<div className="col-span-full">
					<FinancialOverview />
				</div>
				<div className="col-span-full">
					<TransactionOverview />
				</div>
				<div className="grid gap-6 md:grid-cols-2">
					<RecentTransactions limit={8} />
					<TeamLeaderboard />
				</div>
				<div className="col-span-full">
					<LeadershipBonusWidget />
				</div>
			</div>

			{/* Footer */}
			<div className="mt-8 border-t pt-6">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2 text-muted-foreground text-sm">
						{isRefetching && (
							<RiLoader4Line className="size-3.5 animate-spin" />
						)}
						Last updated: {currentTime || "Loading..."}
					</div>
					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm">
							Export Report
						</Button>
						<Button size="sm" onClick={() => openCreateModal()}>
							New Transaction
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}

// ─── Public export (wraps with provider) ─────────────────────────────────────

interface AgentDashboardProps {
	className?: string;
}

export function AgentDashboard({ className }: AgentDashboardProps) {
	return (
		<div className={className}>
			<AgentDashboardProvider transactionLimit={8}>
				<DashboardContent />
			</AgentDashboardProvider>
		</div>
	);
}
