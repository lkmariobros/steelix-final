"use client";

import { useMemo, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
	RiCalendarCheckLine,
	RiCheckboxCircleLine,
	RiGroupLine,
	RiMoneyDollarCircleLine,
} from "@remixicon/react";
import { StripedProgress } from "@/dashboards/admin/widgets/striped-progress";
import type { Lead } from "./lead-models";

type Trend = "up" | "down" | "neutral";
type ProgressTone = "primary" | "success" | "warning" | "danger";

function LeadMetricCard({
	title,
	value,
	badge,
	trend = "neutral",
	icon,
	barPct,
	barTone = "primary",
	footer,
}: {
	title: string;
	value: string | number;
	badge: string;
	trend?: Trend;
	icon: ReactNode;
	barPct?: number;
	barTone?: ProgressTone;
	footer: string;
}) {
	const badgeClass =
		trend === "up"
			? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
			: trend === "down"
				? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
				: "bg-primary/12 text-primary";

	return (
		<div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card px-4 py-3.5 shadow-card transition-shadow hover:shadow-md">
			<div className="flex items-start justify-between gap-3">
				<div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
					{icon}
				</div>
				<span
					className={cn(
						"inline-flex items-center rounded-full px-2 py-0.5 font-medium text-[11px]",
						badgeClass,
					)}
				>
					{badge}
				</span>
			</div>

			<div className="mt-2.5 min-w-0 space-y-0.5">
				<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					{title}
				</p>
				<p className="font-semibold text-xl tracking-tight tabular-nums text-foreground sm:text-2xl">
					{value}
				</p>
			</div>

			<div className="mt-auto space-y-1.5 pt-3">
				{typeof barPct === "number" && (
					<StripedProgress value={barPct} tone={barTone} height="sm" />
				)}
				<p className="truncate text-muted-foreground text-xs">{footer}</p>
			</div>
		</div>
	);
}

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
		const inactive = leads.filter(
			(l) => l.status === "inactive" || l.status === "pending",
		).length;
		const appointmentsMade = leads.filter(
			(l) => l.stage === "appointment_made",
		).length;
		const bookingsMade = leads.filter((l) => l.stage === "booking_made").length;
		const buyers = leads.filter((l) => l.type === "buyer").length;
		const tenants = leads.filter((l) => l.type === "tenant").length;
		return {
			total,
			active,
			inactive,
			appointmentsMade,
			bookingsMade,
			buyers,
			tenants,
		};
	}, [leads]);

	if (isLoading) {
		return (
			<div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{["sk-1", "sk-2", "sk-3", "sk-4"].map((id) => (
					<Card key={id} className="gap-0 overflow-hidden py-5">
						<CardContent className="space-y-4">
							<div className="flex justify-between">
								<Skeleton className="size-10 rounded-xl" />
								<Skeleton className="h-5 w-14 rounded-full" />
							</div>
							<Skeleton className="h-3 w-24" />
							<Skeleton className="h-8 w-16" />
							<Skeleton className="h-2 w-full rounded-full" />
						</CardContent>
					</Card>
				))}
			</div>
		);
	}

	const activeRate = stats.total
		? Math.round((stats.active / stats.total) * 100)
		: 0;
	const appointmentRate = stats.total
		? Math.round((stats.appointmentsMade / stats.total) * 100)
		: 0;
	const bookingRate = stats.total
		? Math.round((stats.bookingsMade / stats.total) * 100)
		: 0;

	return (
		<div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<LeadMetricCard
				title="Total Leads"
				value={stats.total}
				badge={`${stats.total} total`}
				trend={stats.total > 0 ? "up" : "neutral"}
				icon={<RiGroupLine size={20} />}
				barPct={100}
				barTone="primary"
				footer={`${stats.buyers} buyers · ${stats.tenants} tenants`}
			/>
			<LeadMetricCard
				title="Active Leads"
				value={stats.active}
				badge={`${activeRate}% active`}
				trend={activeRate >= 30 ? "up" : activeRate > 0 ? "neutral" : "down"}
				icon={<RiCheckboxCircleLine size={20} />}
				barPct={activeRate}
				barTone="success"
				footer={`${activeRate}% active · ${stats.inactive} inactive`}
			/>
			<LeadMetricCard
				title="Appointment Made"
				value={stats.appointmentsMade}
				badge={`${appointmentRate}% of total`}
				trend={appointmentRate > 0 ? "up" : "neutral"}
				icon={<RiCalendarCheckLine size={20} />}
				barPct={appointmentRate}
				barTone="primary"
				footer={`${appointmentRate}% of total leads`}
			/>
			<LeadMetricCard
				title="Booking Made"
				value={stats.bookingsMade}
				badge={`${bookingRate}% conversion`}
				trend={bookingRate > 0 ? "up" : "neutral"}
				icon={<RiMoneyDollarCircleLine size={20} />}
				barPct={bookingRate}
				barTone="primary"
				footer={`${bookingRate}% conversion`}
			/>
		</div>
	);
}
