"use client";

import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/utils/trpc";
import {
	RiArrowDownLine,
	RiArrowUpLine,
	RiBarChartLine,
	RiTrophyLine,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";

// Import types and utilities
import type { AgentPerformance, DateRangeFilter } from "../admin-schema";
import {
	calculateApprovalRate,
	calculatePerformanceGrade,
	formatCurrency,
	formatPercentage,
} from "../admin-schema";

interface AgentPerformanceGridProps {
	dateRange?: DateRangeFilter;
	refreshKey?: number;
	className?: string;
}

type SortField =
	| "name"
	| "transactions"
	| "commission"
	| "approvalRate"
	| "grade";
type SortDirection = "asc" | "desc";

export function AgentPerformanceGrid({
	dateRange,
	refreshKey,
	className,
}: AgentPerformanceGridProps) {
	const [sortField, setSortField] = useState<SortField>("transactions");
	const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

	// Real tRPC query - replaces mock data
	const {
		data: rawPerformanceData,
		isLoading,
		error,
		refetch,
	} = useQuery(
		trpc.admin.getAgentPerformance.queryOptions(
			{
				dateRange,
			},
			{
				refetchOnWindowFocus: false,
				staleTime: 30000, // 30 seconds
			},
		),
	);

	// Type-safe data processing - handle string commission values from database
	const performanceData = React.useMemo(() => {
		if (!rawPerformanceData) return [];

		return rawPerformanceData.map((agent) => ({
			...agent,
			totalCommission: agent.totalCommission
				? Number(agent.totalCommission)
				: 0,
			avgCommission: agent.avgCommission ? Number(agent.avgCommission) : 0,
		}));
	}, [rawPerformanceData]);

	// Refetch when refreshKey changes
	React.useEffect(() => {
		if (refreshKey !== undefined) {
			refetch();
		}
	}, [refreshKey, refetch]);

	// Handle sorting
	const handleSort = (field: SortField) => {
		if (sortField === field) {
			setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
		} else {
			setSortField(field);
			setSortDirection("desc");
		}
	};

	// Sort performance data
	const sortedPerformanceData = React.useMemo(() => {
		if (!performanceData) return [];

		return [...performanceData].sort((a, b) => {
			let aValue: number | string;
			let bValue: number | string;

			switch (sortField) {
				case "name":
					aValue = a.agentName || "";
					bValue = b.agentName || "";
					break;
				case "transactions":
					aValue = a.totalTransactions;
					bValue = b.totalTransactions;
					break;
				case "commission":
					aValue = a.totalCommission || 0;
					bValue = b.totalCommission || 0;
					break;
				case "approvalRate":
					aValue = calculateApprovalRate(a.approvedCount, a.totalTransactions);
					bValue = calculateApprovalRate(b.approvedCount, b.totalTransactions);
					break;
				case "grade": {
					const aGrade = calculatePerformanceGrade(
						a.totalTransactions,
						calculateApprovalRate(a.approvedCount, a.totalTransactions),
						a.avgCommission || 0,
					);
					const bGrade = calculatePerformanceGrade(
						b.totalTransactions,
						calculateApprovalRate(b.approvedCount, b.totalTransactions),
						b.avgCommission || 0,
					);
					// Convert grades to numbers for sorting (A=5, B=4, C=3, D=2, F=1)
					const gradeToNumber = { A: 5, B: 4, C: 3, D: 2, F: 1 };
					aValue = gradeToNumber[aGrade];
					bValue = gradeToNumber[bGrade];
					break;
				}
				default:
					aValue = 0;
					bValue = 0;
			}

			if (typeof aValue === "string" && typeof bValue === "string") {
				return sortDirection === "asc"
					? aValue.localeCompare(bValue)
					: bValue.localeCompare(aValue);
			}

			return sortDirection === "asc"
				? (aValue as number) - (bValue as number)
				: (bValue as number) - (aValue as number);
		});
	}, [performanceData, sortField, sortDirection]);

	// Get sort icon
	const getSortIcon = (field: SortField) => {
		if (sortField !== field) return null;
		return sortDirection === "asc" ? (
			<RiArrowUpLine size={14} />
		) : (
			<RiArrowDownLine size={14} />
		);
	};

	// Get performance grade color
	const getGradeColor = (grade: string) => {
		switch (grade) {
			case "A":
				return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
			case "B":
				return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
			case "C":
				return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
			case "D":
				return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
			case "F":
				return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
			default:
				return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
		}
	};

	// Loading state
	if (isLoading) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<RiBarChartLine size={20} />
						Agent Performance Grid
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{Array.from({ length: 5 }).map((_, i) => (
							<div
								key={i}
								className="flex items-center justify-between rounded-lg border p-4"
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
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	// Error state
	if (error) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<RiBarChartLine size={20} />
						Agent Performance Grid
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-center py-8">
						<p className="text-muted-foreground text-sm">
							Failed to load agent performance data. Please try again.
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className={className}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<RiBarChartLine size={20} />
						Agent Performance Grid
					</CardTitle>
					<Badge variant="secondary">
						{sortedPerformanceData.length} agents
					</Badge>
				</div>
			</CardHeader>
			<CardContent>
				{sortedPerformanceData.length === 0 ? (
					<div className="flex items-center justify-center py-8">
						<p className="text-muted-foreground text-sm">
							No agent performance data available.
						</p>
					</div>
				) : (
					<div className="rounded-md border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => handleSort("name")}
											className="h-auto p-0 font-medium hover:bg-transparent"
										>
											Agent
											{getSortIcon("name")}
										</Button>
									</TableHead>
									<TableHead>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => handleSort("transactions")}
											className="h-auto p-0 font-medium hover:bg-transparent"
										>
											Transactions
											{getSortIcon("transactions")}
										</Button>
									</TableHead>
									<TableHead>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => handleSort("commission")}
											className="h-auto p-0 font-medium hover:bg-transparent"
										>
											Total Commission
											{getSortIcon("commission")}
										</Button>
									</TableHead>
									<TableHead>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => handleSort("approvalRate")}
											className="h-auto p-0 font-medium hover:bg-transparent"
										>
											Approval Rate
											{getSortIcon("approvalRate")}
										</Button>
									</TableHead>
									<TableHead>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => handleSort("grade")}
											className="h-auto p-0 font-medium hover:bg-transparent"
										>
											Grade
											{getSortIcon("grade")}
										</Button>
									</TableHead>
									<TableHead>Status</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{sortedPerformanceData.map((agent, index) => {
									const approvalRate = calculateApprovalRate(
										agent.approvedCount,
										agent.totalTransactions,
									);
									const grade = calculatePerformanceGrade(
										agent.totalTransactions,
										approvalRate,
										agent.avgCommission || 0,
									);

									return (
										<TableRow key={agent.agentId}>
											<TableCell>
												<div className="flex items-center gap-3">
													<div className="relative">
														<Avatar className="h-10 w-10">
															<span className="font-medium text-sm">
																{(agent.agentName || "?")
																	.charAt(0)
																	.toUpperCase()}
															</span>
														</Avatar>
														{index < 3 && (
															<div className="-top-1 -right-1 absolute">
																<RiTrophyLine
																	size={16}
																	className={
																		index === 0
																			? "text-yellow-500"
																			: index === 1
																				? "text-gray-400"
																				: "text-amber-600"
																	}
																/>
															</div>
														)}
													</div>
													<div>
														<div className="font-medium">
															{agent.agentName || "Unknown Agent"}
														</div>
														<div className="text-muted-foreground text-sm">
															{agent.agentEmail}
														</div>
													</div>
												</div>
											</TableCell>
											<TableCell>
												<div className="space-y-1">
													<div className="font-medium">
														{agent.totalTransactions}
													</div>
													<div className="text-muted-foreground text-xs">
														{agent.pendingCount} pending
													</div>
												</div>
											</TableCell>
											<TableCell>
												<div className="space-y-1">
													<div className="font-medium">
														{formatCurrency(agent.totalCommission || 0)}
													</div>
													<div className="text-muted-foreground text-xs">
														{formatCurrency(agent.avgCommission || 0)} avg
													</div>
												</div>
											</TableCell>
											<TableCell>
												<div className="space-y-1">
													<div className="font-medium">
														{formatPercentage(approvalRate)}
													</div>
													<div className="text-muted-foreground text-xs">
														{agent.approvedCount}/{agent.totalTransactions}{" "}
														approved
													</div>
												</div>
											</TableCell>
											<TableCell>
												<Badge className={getGradeColor(grade)}>{grade}</Badge>
											</TableCell>
											<TableCell>
												<div className="flex flex-col gap-1">
													{agent.pendingCount > 0 && (
														<Badge variant="secondary" className="text-xs">
															{agent.pendingCount} pending
														</Badge>
													)}
													{agent.totalTransactions === 0 && (
														<Badge variant="outline" className="text-xs">
															No activity
														</Badge>
													)}
													{agent.totalTransactions > 0 &&
														agent.pendingCount === 0 && (
															<Badge
																variant="secondary"
																className="text-green-600 text-xs"
															>
																Up to date
															</Badge>
														)}
												</div>
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
