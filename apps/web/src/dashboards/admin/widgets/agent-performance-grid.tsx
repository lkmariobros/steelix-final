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
import { useAdminDashboard } from "@/contexts/admin-dashboard-context";
import {
	RiArrowDownLine,
	RiArrowUpLine,
	RiBarChartLine,
	RiTrophyLine,
} from "@remixicon/react";
import React, { useState } from "react";

import {
	calculateApprovalRate,
	calculatePerformanceGrade,
	formatCurrency,
	formatPercentage,
} from "../admin-schema";

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

export function AgentPerformanceGrid({ className }: AgentPerformanceGridProps) {
	const {
		agentPerformance: rawPerformanceData,
		isLoading,
		hasError,
	} = useAdminDashboard();
	const [sortField, setSortField] = useState<SortField>("transactions");
	const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

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

	const handleSort = (field: SortField) => {
		if (sortField === field) {
			setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
		} else {
			setSortField(field);
			setSortDirection("desc");
		}
	};

	const sortedData = React.useMemo(() => {
		return [...performanceData].sort((a, b) => {
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
	}, [performanceData, sortField, sortDirection]);

	const getSortIcon = (field: SortField) => {
		if (sortField !== field) return null;
		return sortDirection === "asc" ? (
			<RiArrowUpLine size={14} />
		) : (
			<RiArrowDownLine size={14} />
		);
	};

	const getGradeColor = (grade: string) => {
		const colors: Record<string, string> = {
			A: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
			B: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
			C: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
			D: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
			F: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
		};
		return (
			colors[grade] ??
			"bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
		);
	};

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
						{["sk-ag-1", "sk-ag-2", "sk-ag-3", "sk-ag-4", "sk-ag-5"].map(
							(id) => (
								<div
									key={id}
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
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<RiBarChartLine size={20} />
						Agent Performance Grid
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
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<RiBarChartLine size={20} />
						Agent Performance Grid
					</CardTitle>
					<Badge variant="secondary">{sortedData.length} agents</Badge>
				</div>
			</CardHeader>
			<CardContent>
				{sortedData.length === 0 ? (
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
									{(
										[
											"name",
											"transactions",
											"commission",
											"approvalRate",
											"grade",
										] as SortField[]
									).map((field) => (
										<TableHead key={field}>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleSort(field)}
												className="h-auto p-0 font-medium capitalize hover:bg-transparent"
											>
												{field === "approvalRate"
													? "Approval Rate"
													: field.charAt(0).toUpperCase() + field.slice(1)}
												{getSortIcon(field)}
											</Button>
										</TableHead>
									))}
									<TableHead>Status</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{sortedData.map((agent, index) => {
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
