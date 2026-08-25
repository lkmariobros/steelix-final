"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import {
	RiArrowRightLine,
	RiCalendarLine,
	RiCheckboxCircleLine,
	RiFileList3Line,
	RiLoader4Line,
	RiRefreshLine,
} from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { FinancialOverview } from "./components/financial-overview";
import { LeadershipBonusWidget } from "./components/leadership-bonus-widget";
import { RecentTransactions } from "./components/recent-transactions";
import { TeamLeaderboard } from "./components/team-leaderboard";
import { TransactionOverview } from "./components/transaction-overview";

function DashboardContent() {
	const router = useRouter();
	const { openCreateModal } = useTransactionModalActions();
	const { data: profileData } = trpc.agents.getMyProfile.useQuery();
	const {
		dateRange,
		setDateRange,
		isRefetching,
		refetch,
		recentTransactions,
		salesPipeline,
	} = useAgentDashboard();

	const [timeFilter, setTimeFilter] = useState<string>("all");
	const [isCalendarOpen, setIsCalendarOpen] = useState(false);
	const [currentTime, setCurrentTime] = useState<string>("");
	const hasAnyTransaction = (recentTransactions?.length ?? 0) > 0;
	const hasActivePipeline =
		(salesPipeline?.pipeline?.reduce((sum, item) => sum + item.count, 0) ?? 0) >
		0;

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
			<div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div className="min-w-0 space-y-1.5">
					<div className="flex flex-wrap items-center gap-2.5">
						<h1 className="font-bold text-2xl tracking-tight">
							Agent Dashboard
						</h1>
						<span className="inline-flex items-center rounded-full bg-primary/12 px-2.5 py-1 font-medium text-[11px] text-primary">
							Branch: {profileData?.agent?.branch || "—"}
						</span>
					</div>
					<p className="text-muted-foreground text-sm">
						Track your performance, manage your pipeline, and stay connected
						with your team.
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<Select value={timeFilter} onValueChange={handleTimeFilterChange}>
						<SelectTrigger className="h-9 w-[148px] items-center justify-between rounded-full border-border/70 bg-card px-4 py-0 leading-none shadow-card">
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
							<Button
								variant="outline"
								className={cn(
									"inline-flex h-9 items-center justify-center gap-2 rounded-full border-border/70 bg-card px-4 py-0 leading-none shadow-card",
									!dateRange.startDate && "text-muted-foreground",
								)}
							>
								<RiCalendarLine className="size-4 shrink-0" />
								<span>
									{dateRange.startDate && dateRange.endDate
										? `${dateRange.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${dateRange.endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
										: "Custom range"}
								</span>
							</Button>
						</PopoverTrigger>
						<PopoverContent
							className="w-auto border-border/70 p-0 shadow-card"
							align="end"
						>
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
						onClick={refetch}
						disabled={isRefetching}
						className="inline-flex h-9 items-center justify-center gap-2 rounded-full border-border/70 bg-card px-4 py-0 leading-none shadow-card"
					>
						<RiRefreshLine
							className={cn(
								"size-4 shrink-0",
								isRefetching && "animate-spin",
							)}
						/>
						<span>{isRefetching ? "Refreshing" : "Refresh"}</span>
					</Button>
				</div>
			</div>

			<div className="grid gap-5 lg:gap-6">
				{!hasAnyTransaction && !hasActivePipeline && (
					<Card className="col-span-full gap-0 overflow-hidden border-border/70 border-dashed py-0 shadow-card">
						<CardHeader className="border-border/60 border-b px-5 py-4">
							<CardTitle className="text-base">Getting Started</CardTitle>
							<CardDescription>
								Follow these steps to populate your dashboard and start tracking
								commission performance.
							</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-3 p-5 md:grid-cols-3">
							{[
								{
									icon: <RiFileList3Line className="size-4" />,
									title: "1. Add listing / project",
									body: "Create internal listings so agents can select projects with preset details and referral commission defaults.",
									action: (
										<Button
											variant="outline"
											size="sm"
											className="h-8 gap-1.5 rounded-full px-3"
											onClick={() => router.push("/dashboard/listings")}
										>
											Open Listings
											<RiArrowRightLine className="size-3.5" />
										</Button>
									),
								},
								{
									icon: <RiCheckboxCircleLine className="size-4" />,
									title: "2. Create transaction",
									body: "Record a sale/lease, select a project in Step 1, and verify commission breakdown in Step 3.",
									action: (
										<Button
											size="sm"
											className="h-8 gap-1.5 rounded-full px-3"
											onClick={() => openCreateModal()}
										>
											New Transaction
											<RiArrowRightLine className="size-3.5" />
										</Button>
									),
								},
								{
									icon: <RiCalendarLine className="size-4" />,
									title: "3. Monitor pipeline",
									body: "After at least one transaction, use date filters and widgets to track pipeline health and pending commissions.",
									action: (
										<Button
											variant="outline"
											size="sm"
											className="h-8 gap-1.5 rounded-full px-3"
											onClick={() => router.push("/dashboard/transactions")}
										>
											View Transactions
											<RiArrowRightLine className="size-3.5" />
										</Button>
									),
								},
							].map((step) => (
								<div
									key={step.title}
									className="rounded-2xl border border-border/60 bg-card p-4 shadow-card"
								>
									<div className="mb-2 flex items-center gap-2 font-medium text-sm">
										<span className="flex size-7 items-center justify-center rounded-lg bg-primary/12 text-primary">
											{step.icon}
										</span>
										{step.title}
									</div>
									<p className="mb-3 text-muted-foreground text-xs leading-relaxed">
										{step.body}
									</p>
									{step.action}
								</div>
							))}
						</CardContent>
					</Card>
				)}

				<div className="col-span-full">
					<FinancialOverview />
				</div>
				<div className="col-span-full">
					<TransactionOverview />
				</div>
				<div className="grid gap-5 md:grid-cols-2 lg:gap-6">
					<RecentTransactions limit={8} />
					<TeamLeaderboard />
				</div>
				<div className="col-span-full">
					<LeadershipBonusWidget />
				</div>
			</div>

			<div className="mt-8 border-border/60 border-t pt-5">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-2 text-muted-foreground text-sm">
						{isRefetching && (
							<RiLoader4Line className="size-3.5 animate-spin" />
						)}
						Last updated: {currentTime || "Loading..."}
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							className="h-9 rounded-full border-border/70 px-4 shadow-card"
						>
							Export Report
						</Button>
						<Button
							size="sm"
							className="h-9 rounded-full px-4"
							onClick={() => openCreateModal()}
						>
							New Transaction
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}

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
