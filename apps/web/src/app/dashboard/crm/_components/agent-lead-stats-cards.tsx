"use client";

import { useMemo } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type AgentLeadStatRow = {
	status: string;
	stage: string;
};

export function AgentLeadStatsCards({
	leads,
	isLoading,
}: {
	leads: AgentLeadStatRow[];
	isLoading: boolean;
}) {
	const stats = useMemo(() => {
		const total = leads.length;
		const active = leads.filter((l) => l.status === "active").length;
		const inactive = leads.filter(
			(l) => l.status === "inactive" || l.status === "pending",
		).length;
		const potential = leads.filter((l) => l.stage === "potential_lead").length;
		const appointmentsMade = leads.filter(
			(l) => l.stage === "appointment_made",
		).length;
		return {
			total,
			active,
			inactive,
			potential,
			appointmentsMade,
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
	const potentialRate = stats.total
		? Math.round((stats.potential / stats.total) * 100)
		: 0;
	const appointmentRate = stats.total
		? Math.round((stats.appointmentsMade / stats.total) * 100)
		: 0;

	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<Card className="overflow-hidden">
				<CardHeader className="pb-2">
					<CardDescription>Total Lead</CardDescription>
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
						Your assigned leads
					</p>
				</CardContent>
			</Card>

			<Card className="overflow-hidden">
				<CardHeader className="pb-2">
					<CardDescription>Active Lead</CardDescription>
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
						{activeRate}% active · {stats.inactive} inactive
					</p>
				</CardContent>
			</Card>

			<Card className="overflow-hidden">
				<CardHeader className="pb-2">
					<CardDescription>Potential Lead</CardDescription>
					<CardTitle className="text-3xl">{stats.potential}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-teal-500 transition-all duration-500"
							style={{ width: `${potentialRate}%` }}
						/>
					</div>
					<p className="text-muted-foreground text-xs">
						{potentialRate}% of total leads
					</p>
				</CardContent>
			</Card>

			<Card className="overflow-hidden">
				<CardHeader className="pb-2">
					<CardDescription>Appointment Made</CardDescription>
					<CardTitle className="text-3xl">{stats.appointmentsMade}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-emerald-500 transition-all duration-500"
							style={{ width: `${appointmentRate}%` }}
						/>
					</div>
					<p className="text-muted-foreground text-xs">
						{appointmentRate}% of total leads
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
