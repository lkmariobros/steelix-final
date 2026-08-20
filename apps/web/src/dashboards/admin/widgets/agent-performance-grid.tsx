"use client";

import { Avatar, AvatarFallback } from "@/components/avatar";
import { Badge } from "@/components/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminDashboard } from "@/contexts/admin-dashboard-context";
import { cn } from "@/lib/utils";
import {
	RiArrowDownLine,
	RiArrowUpDownLine,
	RiArrowUpLine,
	RiBarChartLine,
	RiSearchLine,
	RiTrophyLine,
} from "@remixicon/react";
import React, { useMemo, useState } from "react";

import {
	calculateApprovalRate,
	calculatePerformanceGrade,
	formatCurrency,
	formatPercentage,
} from "../admin-schema";
import { StripedProgress } from "./striped-progress";
import { TablePagination } from "./table-pagination";

interface AgentPerformanceGridProps {
	className?: string;
}

type SortField =
	| "name"
	| "transactions"
	| "commission"
	| "approvalRate"
	| "grade";
type SortDirection = "asc" | "desc";

const PAGE_SIZE = 6;

export function AgentPerformanceGrid({ className }: AgentPerformanceGridProps) {
	const {
		agentPerformance: rawPerformanceData,
		performanceLoading,
		hasError,
	} = useAdminDashboard();
	const [sortField, setSortField] = useState<SortField>("transactions");
	const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(0);

	const performanceData = useMemo(() => {
		if (!rawPerformanceData) return [];
		return rawPerformanceData.map((agent) => ({
			...agent,
			totalCommission: agent.totalCommission
				? Number(agent.totalCommission)
				: 0,
			avgCommission: agent.avgCommission ? Number(agent.avgCommission) : 0,
		}));
	}, [rawPerformanceData]);

	const handleSort = (field: SortField) => {
		if (sortField === field) {
			setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
		} else {
			setSortField(field);
			setSortDirection("desc");
		}
	};

	const filteredData = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return performanceData;
		return performanceData.filter((agent) => {
			const haystack = [agent.agentName, agent.agentEmail]
				.filter(Boolean)
				.join(" ")
				.toLowerCase();
			return haystack.includes(q);
		});
	}, [performanceData, search]);

	const sortedData = useMemo(() => {
		return [...filteredData].sort((a, b) => {
			let aVal: number | string;
			let bVal: number | string;
			switch (sortField) {
				case "name":
					aVal = a.agentName || "";
					bVal = b.agentName || "";
					break;
				case "transactions":
					aVal = a.totalTransactions;
					bVal = b.totalTransactions;
					break;
				case "commission":
					aVal = a.totalCommission || 0;
					bVal = b.totalCommission || 0;
					break;
				case "approvalRate":
					aVal = calculateApprovalRate(a.approvedCount, a.totalTransactions);
					bVal = calculateApprovalRate(b.approvedCount, b.totalTransactions);
					break;
				case "grade": {
					const gradeToNum = { A: 5, B: 4, C: 3, D: 2, F: 1 } as Record<
						string,
						number
					>;
					aVal =
						gradeToNum[
							calculatePerformanceGrade(
								a.totalTransactions,
								calculateApprovalRate(a.approvedCount, a.totalTransactions),
								a.avgCommission || 0,
							)
						] ?? 0;
					bVal =
						gradeToNum[
							calculatePerformanceGrade(
								b.totalTransactions,
								calculateApprovalRate(b.approvedCount, b.totalTransactions),
								b.avgCommission || 0,
							)
						] ?? 0;
					break;
				}
				default:
					aVal = 0;
					bVal = 0;
			}
			if (typeof aVal === "string" && typeof bVal === "string") {
				return sortDirection === "asc"
					? aVal.localeCompare(bVal)
					: bVal.localeCompare(aVal);
			}
			return sortDirection === "asc"
				? (aVal as number) - (bVal as number)
				: (bVal as number) - (aVal as number);
		});
	}, [filteredData, sortField, sortDirection]);

	const pageCount = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));
	const safePage = Math.min(page, pageCount - 1);
	const pageData = sortedData.slice(
		safePage * PAGE_SIZE,
		(safePage + 1) * PAGE_SIZE,
	);

	const handleSearchChange = (value: string) => {
		setSearch(value);
		setPage(0);
	};

	const getSortIcon = (field: SortField) => {
		if (sortField !== field) {
			return (
				<RiArrowUpDownLine size={12} className="text-muted-foreground/60" />
			);
		}
		return sortDirection === "asc" ? (
			<RiArrowUpLine size={14} className="text-primary" />
		) : (
			<RiArrowDownLine size={14} className="text-primary" />
		);
	};

	const getGradeColor = (grade: string) => {
		const colors: Record<string, string> = {
			A: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
			B: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
			C: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
			D: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
			F: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
		};
		return colors[grade] ?? "bg-muted text-muted-foreground";
	};

	if (performanceLoading) {
		return (
			<Card className={className}>
				<CardHeader className="border-b border-border/60 pb-4">
					<CardTitle className="flex items-center gap-2 text-base">
						<span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<RiBarChartLine size={16} />
						</span>
						Agent Performance
					</CardTitle>
				</CardHeader>
				<CardContent className="pt-4">
					<div className="space-y-3">
						{["sk-ag-1", "sk-ag-2", "sk-ag-3", "sk-ag-4", "sk-ag-5"].map(
							(id) => (
								<div
									key={id}
									className="flex items-center justify-between rounded-xl bg-muted/40 p-4"
								>
									<div className="flex items-center gap-3">
										<Skeleton className="h-10 w-10 rounded-full" />
										<div className="space-y-2">
											<Skeleton className="h-4 w-32" />
											<Skeleton className="h-3 w-24" />
										</div>
									</div>
									<div className="flex gap-4">
										<Skeleton className="h-4 w-16" />
										<Skeleton className="h-4 w-16" />
										<Skeleton className="h-4 w-16" />
									</div>
								</div>
							),
						)}
					</div>
				</CardContent>
			</Card>
		);
	}

	if (hasError) {
		return (
			<Card className={className}>
				<CardHeader className="border-b border-border/60 pb-4">
					<CardTitle className="flex items-center gap-2 text-base">
						<span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<RiBarChartLine size={16} />
						</span>
						Agent Performance
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-center py-8">
						<p className="text-muted-foreground text-sm">
							Failed to load agent performance data.
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className={className}>
			<CardHeader className="pb-3">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-2.5">
						<CardTitle className="flex items-center gap-2.5 text-base">
							<span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
								<RiBarChartLine size={18} />
							</span>
							Agent Performance
						</CardTitle>
						<Badge
							variant="secondary"
							className="rounded-full bg-primary/12 text-primary"
						>
							{performanceData.length} agents
						</Badge>
					</div>
					<div className="relative w-full sm:max-w-[220px]">
						<RiSearchLine
							size={16}
							className="-translate-y-1/2 absolute top-1/2 left-3 text-muted-foreground"
						/>
						<Input
							value={search}
							onChange={(e) => handleSearchChange(e.target.value)}
							placeholder="Search"
							className="h-9 rounded-xl border-border/70 bg-muted/30 pl-9"
						/>
					</div>
				</div>
			</CardHeader>
			<CardContent className="pt-0">
				{performanceData.length === 0 ? (
					<div className="flex items-center justify-center py-10">
						<p className="text-muted-foreground text-sm">
							No agent performance data available.
						</p>
					</div>
				) : sortedData.length === 0 ? (
					<div className="flex items-center justify-center py-10">
						<p className="text-muted-foreground text-sm">
							No matches for “{search.trim()}”.
						</p>
					</div>
				) : (
					<>
						<div className="overflow-x-auto rounded-xl border border-border/60">
							<Table className="w-full table-fixed min-w-[760px]">
								<TableHeader>
									<TableRow className="border-border/50 hover:bg-transparent">
										{(
											[
												["name", "Name", "w-[28%]"],
												["transactions", "Transactions", "w-[12%]"],
												["commission", "Commission", "w-[16%]"],
												["approvalRate", "Approval Rate", "w-[16%]"],
												["grade", "Grade", "w-[10%]"],
											] as [SortField, string, string][]
										).map(([field, label, width]) => (
											<TableHead
												key={field}
												className={cn(
													"h-11 bg-muted/50 font-semibold text-foreground text-xs",
													width,
												)}
											>
												<button
													type="button"
													onClick={() => handleSort(field)}
													className="inline-flex items-center gap-1.5 font-semibold text-foreground text-xs hover:text-primary"
												>
													{label}
													{getSortIcon(field)}
												</button>
											</TableHead>
										))}
										<TableHead className="h-11 w-[18%] bg-muted/50 font-semibold text-foreground text-xs">
											Status
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{pageData.map((agent, index) => {
										const globalIndex = safePage * PAGE_SIZE + index;
										const approvalRate = calculateApprovalRate(
											agent.approvedCount,
											agent.totalTransactions,
										);
										const grade = calculatePerformanceGrade(
											agent.totalTransactions,
											approvalRate,
											agent.avgCommission || 0,
										);
										const initial = (agent.agentName || "?")
											.charAt(0)
											.toUpperCase();
										const name = agent.agentName || "Unknown Agent";

										return (
											<TableRow
												key={agent.agentId}
												className="border-border/40 hover:bg-muted/20"
											>
												<TableCell className="max-w-0 py-3">
													<div className="flex min-w-0 items-center gap-2.5">
														<div className="relative shrink-0">
															<Avatar className="size-8 border border-border/50">
																<AvatarFallback className="bg-primary/10 font-semibold text-primary text-xs">
																	{initial}
																</AvatarFallback>
															</Avatar>
															{globalIndex < 3 && (
																<span className="-bottom-0.5 -right-0.5 absolute flex size-3.5 items-center justify-center rounded-full bg-card shadow-sm">
																	<RiTrophyLine
																		size={9}
																		className={
																			globalIndex === 0
																				? "text-amber-500"
																				: globalIndex === 1
																					? "text-slate-400"
																					: "text-amber-700"
																		}
																	/>
																</span>
															)}
														</div>
														<div className="min-w-0 flex-1 overflow-hidden">
															<p
																className="truncate font-medium text-foreground text-sm leading-snug"
																title={name}
															>
																{name}
															</p>
															<p
																className="mt-0.5 truncate text-muted-foreground text-xs leading-snug"
																title={agent.agentEmail || undefined}
															>
																{agent.agentEmail}
															</p>
														</div>
													</div>
												</TableCell>
												<TableCell className="py-3">
													<p className="font-semibold tabular-nums text-foreground text-sm">
														{agent.totalTransactions}
													</p>
													<p className="mt-0.5 text-muted-foreground text-xs">
														{agent.pendingCount} pending
													</p>
												</TableCell>
												<TableCell className="py-3">
													<p className="truncate font-semibold tabular-nums text-foreground text-sm">
														{formatCurrency(agent.totalCommission || 0)}
													</p>
													<p className="mt-0.5 truncate text-muted-foreground text-xs">
														{formatCurrency(agent.avgCommission || 0)} avg
													</p>
												</TableCell>
												<TableCell className="py-3">
													<div className="max-w-[7rem] space-y-1.5">
														<p className="font-semibold tabular-nums text-foreground text-sm">
															{formatPercentage(approvalRate)}
														</p>
														<StripedProgress
															value={approvalRate}
															tone="primary"
															height="sm"
														/>
													</div>
												</TableCell>
												<TableCell className="py-3">
													<Badge
														className={cn(
															"size-7 justify-center rounded-lg border-0 p-0 font-semibold",
															getGradeColor(grade),
														)}
													>
														{grade}
													</Badge>
												</TableCell>
												<TableCell className="py-3">
													{agent.pendingCount > 0 ? (
														<Badge className="rounded-full border-0 bg-amber-500/15 font-medium text-amber-700 text-xs dark:text-amber-300">
															{agent.pendingCount} pending
														</Badge>
													) : agent.totalTransactions === 0 ? (
														<Badge
															variant="outline"
															className="rounded-full text-xs"
														>
															No activity
														</Badge>
													) : (
														<Badge className="rounded-full border-0 bg-primary/12 font-medium text-primary text-xs">
															Up to date
														</Badge>
													)}
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</div>

						<TablePagination
							className="mt-4"
							page={safePage}
							pageSize={PAGE_SIZE}
							total={sortedData.length}
							onPageChange={setPage}
						/>
					</>
				)}
			</CardContent>
		</Card>
	);
}
