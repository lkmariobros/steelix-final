"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Lead } from "./lead-models";

export function StatsCards({
	leads,
	isLoading,
}: {
	leads: Lead[];
	isLoading: boolean;
}) {
	const stats = useMemo(() => {
		const total = leads.length;
		const active = leads.filter((l) => l.status === "active").length;
		const pending = leads.filter((l) => l.status === "pending").length;
		const inactive = leads.filter((l) => l.status === "inactive").length;
		const unclaimedCompany = leads.filter(
			(l) => l.leadType === "company" && !l.agentId,
		).length;
		const bookingsMade = leads.filter((l) => l.stage === "booking_made").length;
		const buyers = leads.filter((l) => l.type === "buyer").length;
		const tenants = leads.filter((l) => l.type === "tenant").length;
		const uniqueAgents = new Set(leads.map((l) => l.agentId).filter(Boolean))
			.size;
		return {
			total,
			active,
			pending,
			inactive,
			unclaimedCompany,
			bookingsMade,
			buyers,
			tenants,
			uniqueAgents,
		};
	}, [leads]);

	if (isLoading) {
		return (
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{[...Array(4)].map((_, i) => (
					<Card key={i} className="overflow-hidden">
						<CardHeader className="pb-2">
							<Skeleton className="h-3.5 w-28" />
							<Skeleton className="mt-2 h-9 w-16" />
						</CardHeader>
						<CardContent className="space-y-2">
							<Skeleton className="h-1.5 w-full rounded-full" />
							<Skeleton className="h-3 w-36" />
						</CardContent>
					</Card>
				))}
			</div>
		);
	}

	const activeRate = stats.total
		? Math.round((stats.active / stats.total) * 100)
		: 0;
	const bookingRate = stats.total
		? Math.round((stats.bookingsMade / stats.total) * 100)
		: 0;

	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<Card className="overflow-hidden">
				<CardHeader className="pb-2">
					<CardDescription>Total Leads</CardDescription>
					<CardTitle className="text-3xl">{stats.total}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-primary transition-all duration-500"
							style={{ width: "100%" }}
						/>
					</div>
					<p className="text-muted-foreground text-xs">
						{stats.buyers} buyers · {stats.tenants} tenants
					</p>
				</CardContent>
			</Card>
			<Card className="overflow-hidden">
				<CardHeader className="pb-2">
					<CardDescription>Active Leads</CardDescription>
					<CardTitle className="text-3xl">{stats.active}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-green-500 transition-all duration-500"
							style={{ width: `${activeRate}%` }}
						/>
					</div>
					<p className="text-muted-foreground text-xs">
						{activeRate}% active · {stats.pending} pending · {stats.inactive} inactive
					</p>
				</CardContent>
			</Card>
			<Card className="overflow-hidden">
				<CardHeader className="pb-2">
					<CardDescription>Bookings Made</CardDescription>
					<CardTitle className="text-3xl">{stats.bookingsMade}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-emerald-500 transition-all duration-500"
							style={{ width: `${bookingRate}%` }}
						/>
					</div>
					<p className="text-muted-foreground text-xs">
						{bookingRate}% conversion · {stats.unclaimedCompany} unclaimed co.
					</p>
				</CardContent>
			</Card>
			<Card className="overflow-hidden">
				<CardHeader className="pb-2">
					<CardDescription>Agents With Leads</CardDescription>
					<CardTitle className="text-3xl">{stats.uniqueAgents}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-blue-500 transition-all duration-500"
							style={{ width: stats.uniqueAgents ? "75%" : "0%" }}
						/>
					</div>
					<p className="text-muted-foreground text-xs">
						{stats.total} total leads tracked
					</p>
				</CardContent>
			</Card>
		</div>
	);
}

