"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Simple utility function to avoid import issues
const formatCurrency = (amount: number): string => {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amount);
};

interface MonthlyPerformanceProps {
	dateRange?: {
		startDate?: Date;
		endDate?: Date;
	};
}

export function MonthlyPerformance({ dateRange }: MonthlyPerformanceProps) {
	// Mock data for monthly trends
	const monthlyTrend = [
		{ month: "2024-01", commission: 15000, deals: 2 },
		{ month: "2024-02", commission: 22000, deals: 3 },
		{ month: "2024-03", commission: 18000, deals: 2 },
		{ month: "2024-04", commission: 28000, deals: 4 },
		{ month: "2024-05", commission: 32000, deals: 3 },
		{ month: "2024-06", commission: 25000, deals: 3 },
	];

	const isLoading = false;
	const error = null;

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Monthly Performance</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-2">
						{Array.from({ length: 6 }).map((_, i) => (
							<div key={i} className="flex items-center justify-between py-2">
								<Skeleton className="h-4 w-20" />
								<div className="flex items-center gap-4">
									<div className="space-y-1 text-right">
										<Skeleton className="h-4 w-16" />
										<Skeleton className="h-3 w-12" />
									</div>
									<Skeleton className="h-2 w-20 rounded-full" />
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	if (error) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Monthly Performance</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">
						Failed to load monthly performance data. Please try again.
					</p>
				</CardContent>
			</Card>
		);
	}

	if (monthlyTrend.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Monthly Performance</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">
						No monthly performance data available.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Monthly Performance</CardTitle>
				{dateRange?.startDate && dateRange?.endDate && (
					<p className="text-muted-foreground text-sm">
						{dateRange.startDate.toLocaleDateString("en-US")} -{" "}
						{dateRange.endDate.toLocaleDateString("en-US")}
					</p>
				)}
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{monthlyTrend.slice(-6).map((month) => (
						<div
							key={month.month}
							className="flex items-center justify-between py-2"
						>
							<div className="font-medium text-sm">
								{new Date(`${month.month}-01`).toLocaleDateString("en-US", {
									month: "short",
									year: "numeric",
								})}
							</div>
							<div className="flex items-center gap-4">
								<div className="text-right">
									<div className="font-medium text-sm">
										{formatCurrency(month.commission)}
									</div>
									<div className="text-muted-foreground text-xs">
										{month.deals} deals
									</div>
								</div>
								<div className="h-2 w-20 rounded-full bg-muted">
									<div
										className="h-2 rounded-full bg-primary"
										style={{
											width: `${Math.min(
												(month.commission /
													Math.max(...monthlyTrend.map((m) => m.commission))) *
													100,
												100,
											)}%`,
										}}
									/>
								</div>
							</div>
						</div>
					))}
				</div>

				{/* Monthly Summary */}
				<div className="mt-4 border-t pt-4">
					<div className="grid grid-cols-3 gap-4 text-center">
						<div>
							<div className="font-semibold text-sm">
								{formatCurrency(
									monthlyTrend.reduce((sum, m) => sum + m.commission, 0),
								)}
							</div>
							<div className="text-muted-foreground text-xs">
								Total Commission
							</div>
						</div>
						<div>
							<div className="font-semibold text-sm">
								{monthlyTrend.reduce((sum, m) => sum + m.deals, 0)}
							</div>
							<div className="text-muted-foreground text-xs">Total Deals</div>
						</div>
						<div>
							<div className="font-semibold text-sm">
								{formatCurrency(
									monthlyTrend.reduce((sum, m) => sum + m.commission, 0) /
										monthlyTrend.length,
								)}
							</div>
							<div className="text-muted-foreground text-xs">Avg Monthly</div>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
