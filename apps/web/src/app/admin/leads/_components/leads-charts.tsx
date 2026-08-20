"use client";

import { useMemo, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Lead } from "./lead-models";
import { PIPELINE_STAGES } from "./lead-constants";
import { getLeadDisplayTags } from "./lead-models";
import {
	Area,
	AreaChart,
	CartesianGrid,
	Cell,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { RiBarChartBoxLine, RiPieChart2Line } from "@remixicon/react";

/** Brand-aligned palette (teal family + soft accents) */
const CHART_COLORS = [
	"#2a6b73",
	"#3d8f8a",
	"#5aa8a3",
	"#0ea5e9",
	"#38bdf8",
	"#f59e0b",
	"#f97316",
	"#10b981",
	"#64748b",
	"#94a3b8",
];

const PRIMARY = "#2a6b73";
const PRIMARY_SOFT = "#3d8f8a";

function AreaTooltip({
	active,
	payload,
	label,
}: {
	active?: boolean;
	payload?: Array<{ value: number }>;
	label?: string;
}) {
	if (!active || !payload?.length) return null;
	return (
		<div className="rounded-xl border border-border/70 bg-popover px-3 py-2 shadow-card">
			<p className="mb-1 font-semibold text-foreground text-xs">{label}</p>
			<p className="text-muted-foreground text-xs">
				<span className="font-bold tabular-nums text-primary">
					{payload[0].value}
				</span>{" "}
				leads
			</p>
		</div>
	);
}

function PieTooltip({
	active,
	payload,
}: {
	active?: boolean;
	payload?: Array<{ name: string; value: number; payload: { color: string } }>;
}) {
	if (!active || !payload?.length) return null;
	const item = payload[0];
	return (
		<div className="rounded-xl border border-border/70 bg-popover px-3 py-2 shadow-card">
			<div className="flex items-center gap-2">
				<span
					className="size-2.5 shrink-0 rounded-full"
					style={{ backgroundColor: item.payload.color }}
				/>
				<p className="font-semibold text-foreground text-xs">{item.name}</p>
			</div>
			<p className="mt-0.5 text-muted-foreground text-xs">
				<span className="font-bold tabular-nums text-foreground">
					{item.value}
				</span>{" "}
				leads
			</p>
		</div>
	);
}

function ChartCardShell({
	title,
	description,
	icon,
	children,
	className,
	action,
	compact,
}: {
	title: string;
	description: string;
	icon: ReactNode;
	children: ReactNode;
	className?: string;
	action?: ReactNode;
	compact?: boolean;
}) {
	return (
		<Card className={cn("flex h-full flex-col gap-0 py-0", className)}>
			<CardHeader className={cn(compact ? "shrink-0 px-4 pb-1 pt-3.5" : "shrink-0 px-4 pb-2 pt-4")}>
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<div className="flex items-center gap-2.5">
							<span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
								{icon}
							</span>
							<CardTitle className="font-semibold text-base">{title}</CardTitle>
						</div>
						<p className="mt-1 text-muted-foreground text-xs">{description}</p>
					</div>
					{action}
				</div>
			</CardHeader>
			<CardContent
				className={cn(
					"flex flex-1 flex-col px-4",
					compact ? "pb-3.5 pt-0" : "pb-4 pt-1",
				)}
			>
				{children}
			</CardContent>
		</Card>
	);
}

function DistributionLegend({
	items,
	total,
}: {
	items: Array<{ name: string; value: number; color: string }>;
	total: number;
}) {
	return (
		<div className="mt-1 space-y-0.5">
			{items.map((item) => {
				const pct = total ? Math.round((item.value / total) * 100) : 0;
				return (
					<div key={item.name} className="flex items-center gap-1.5 leading-tight">
						<span
							className="size-2 shrink-0 rounded-sm"
							style={{ backgroundColor: item.color }}
						/>
						<span
							className="min-w-0 flex-1 truncate font-medium text-foreground/90 text-[11px]"
							title={item.name}
						>
							{item.name}
						</span>
						<span className="shrink-0 text-muted-foreground text-[11px] tabular-nums">
							{pct}%
						</span>
						<span className="w-5 shrink-0 text-right font-semibold text-foreground text-[11px] tabular-nums">
							{item.value}
						</span>
					</div>
				);
			})}
		</div>
	);
}

function DistributionDonut({
	data,
	total,
}: {
	data: Array<{ name: string; value: number; color: string }>;
	total: number;
}) {
	return (
		<div className="relative mx-auto w-full max-w-[130px] shrink-0">
			<ResponsiveContainer width="100%" height={112}>
				<PieChart>
					<Pie
						data={data}
						cx="50%"
						cy="50%"
						innerRadius={34}
						outerRadius={48}
						paddingAngle={2}
						cornerRadius={3}
						dataKey="value"
						strokeWidth={0}
					>
						{data.map((entry) => (
							<Cell key={entry.name} fill={entry.color} />
						))}
					</Pie>
					<Tooltip content={<PieTooltip />} />
				</PieChart>
			</ResponsiveContainer>
			<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
				<span className="font-bold text-lg text-foreground tabular-nums leading-none">
					{total}
				</span>
				<span className="mt-0.5 text-muted-foreground text-[10px]">total</span>
			</div>
		</div>
	);
}

export function LeadsCharts({
	leads,
	isLoading,
}: {
	leads: Lead[];
	isLoading: boolean;
}) {
	const { resolvedTheme } = useTheme();
	const isDark = resolvedTheme === "dark";
	const tickColor = isDark ? "#94a3b8" : "#64748b";
	const gridStroke = isDark ? "#2a3538" : "#e8eef0";
	const dotStroke = isDark ? "#1a2a2c" : "#ffffff";

	const { stageData, monthlyData, categoryData, totalLeads } = useMemo(() => {
		const stageCounts: Record<string, number> = {};
		for (const lead of leads) {
			stageCounts[lead.stage] = (stageCounts[lead.stage] ?? 0) + 1;
		}

		const stageData = PIPELINE_STAGES.map((s, i) => ({
			name: s.label,
			value: stageCounts[s.value] ?? 0,
			color: CHART_COLORS[i % CHART_COLORS.length],
		})).filter((s) => s.value > 0);

		const now = new Date();
		const months: { key: string; label: string }[] = [];
		for (let i = 5; i >= 0; i--) {
			const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
			months.push({
				key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
				label: d.toLocaleDateString("en", { month: "short", year: "2-digit" }),
			});
		}

		const monthlyCounts: Record<string, number> = {};
		for (const lead of leads) {
			const d = new Date(lead.createdAt);
			const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
			monthlyCounts[key] = (monthlyCounts[key] ?? 0) + 1;
		}

		const monthlyData = months.map((m) => ({
			month: m.label,
			leads: monthlyCounts[m.key] ?? 0,
		}));

		const totalLeads = leads.length;

		const categoryCounts: Record<string, number> = {};
		for (const lead of leads) {
			const tags = getLeadDisplayTags(lead);
			if (tags.length === 0) {
				categoryCounts.Uncategorized =
					(categoryCounts.Uncategorized ?? 0) + 1;
				continue;
			}
			for (const t of tags) {
				categoryCounts[t] = (categoryCounts[t] ?? 0) + 1;
			}
		}

		const categoryData = Object.entries(categoryCounts)
			.map(([name, value], i) => ({
				name,
				value,
				color: CHART_COLORS[i % CHART_COLORS.length],
			}))
			.sort((a, b) => b.value - a.value)
			.slice(0, 10);

		return { stageData, monthlyData, categoryData, totalLeads };
	}, [leads]);

	if (isLoading) {
		return (
			<div className="grid items-stretch gap-4 lg:grid-cols-4">
				<Card className="h-full lg:col-span-2">
					<CardHeader className="pb-3">
						<Skeleton className="h-5 w-44" />
						<Skeleton className="h-3 w-56" />
					</CardHeader>
					<CardContent>
						<Skeleton className="h-[220px] w-full rounded-xl" />
					</CardContent>
				</Card>
				<Card className="h-full">
					<CardHeader className="pb-3">
						<Skeleton className="h-5 w-36" />
					</CardHeader>
					<CardContent className="flex justify-center">
						<Skeleton className="size-[140px] rounded-full" />
					</CardContent>
				</Card>
				<Card className="h-full">
					<CardHeader className="pb-3">
						<Skeleton className="h-5 w-40" />
					</CardHeader>
					<CardContent className="flex justify-center">
						<Skeleton className="size-[140px] rounded-full" />
					</CardContent>
				</Card>
			</div>
		);
	}

	if (leads.length === 0) return null;

	return (
		<div className="grid items-stretch gap-4 lg:grid-cols-4">
			<ChartCardShell
				className="lg:col-span-2"
				title="Monthly Lead Trend"
				description="Leads created over the last 6 months"
				icon={<RiBarChartBoxLine size={16} />}
			>
				<div className="relative min-h-[200px] w-full flex-1">
					<div className="absolute inset-0 pr-2">
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart
								data={monthlyData}
								margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
							>
							<defs>
								<linearGradient id="leadsAreaFill" x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stopColor={PRIMARY} stopOpacity={0.35} />
									<stop offset="55%" stopColor={PRIMARY_SOFT} stopOpacity={0.12} />
									<stop offset="100%" stopColor={PRIMARY} stopOpacity={0.02} />
								</linearGradient>
							</defs>
							<CartesianGrid
								strokeDasharray="3 6"
								vertical={false}
								stroke={gridStroke}
							/>
							<XAxis
								dataKey="month"
								tick={{ fontSize: 11, fill: tickColor, fontWeight: 500 }}
								axisLine={false}
								tickLine={false}
								dy={8}
							/>
							<YAxis
								tick={{ fontSize: 11, fill: tickColor, fontWeight: 500 }}
								axisLine={false}
								tickLine={false}
								allowDecimals={false}
								width={34}
							/>
							<Tooltip
								content={<AreaTooltip />}
								cursor={{
									stroke: PRIMARY,
									strokeWidth: 1,
									strokeDasharray: "4 4",
								}}
							/>
							<Area
								type="monotone"
								dataKey="leads"
								stroke={PRIMARY}
								strokeWidth={2.5}
								fill="url(#leadsAreaFill)"
								dot={{
									r: 3.5,
									fill: PRIMARY,
									stroke: dotStroke,
									strokeWidth: 2,
								}}
								activeDot={{
									r: 6,
									fill: PRIMARY,
									stroke: isDark ? "#fff" : "#fff",
									strokeWidth: 2,
								}}
							/>
						</AreaChart>
						</ResponsiveContainer>
					</div>
				</div>
			</ChartCardShell>

			<ChartCardShell
				title="Stage Distribution"
				description="Leads by pipeline stage"
				icon={<RiPieChart2Line size={16} />}
				compact
			>
				<div className="flex flex-1 flex-col">
					<DistributionDonut data={stageData} total={totalLeads} />
					<DistributionLegend items={stageData} total={totalLeads} />
				</div>
			</ChartCardShell>

			<ChartCardShell
				title="Category Distribution"
				description="Leads by category (top 10)"
				icon={<RiPieChart2Line size={16} />}
				compact
			>
				<div className="flex flex-1 flex-col">
					<DistributionDonut data={categoryData} total={totalLeads} />
					<DistributionLegend items={categoryData} total={totalLeads} />
				</div>
			</ChartCardShell>
		</div>
	);
}
