"use client";

import { useMemo, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PIPELINE_STAGES } from "./lead-constants";
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

export type LeadsChartData = {
	total: number;
	byStage: Record<string, number>;
	monthlyTrend?: Array<{ key: string; label: string; count: number }>;
	byCategory?: Array<{ name: string; count: number }>;
};

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
				<span className="font-semibold text-foreground text-xs">{item.name}</span>
			</div>
			<p className="mt-1 text-muted-foreground text-xs">
				<span className="font-bold tabular-nums text-primary">{item.value}</span>{" "}
				leads
			</p>
		</div>
	);
}

function ChartCardShell({
	title,
	description,
	icon,
	className,
	children,
}: {
	title: string;
	description?: string;
	icon: ReactNode;
	className?: string;
	children: ReactNode;
}) {
	return (
		<Card className={cn("flex h-full flex-col gap-0 overflow-hidden py-0", className)}>
			<CardHeader className="space-y-1 border-border/50 border-b px-5 py-4">
				<div className="flex items-center gap-2">
					<span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
						{icon}
					</span>
					<div className="min-w-0">
						<CardTitle className="truncate text-sm">{title}</CardTitle>
						{description ? (
							<p className="truncate text-muted-foreground text-xs">{description}</p>
						) : null}
					</div>
				</div>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col px-5 py-4">{children}</CardContent>
		</Card>
	);
}

function DonutChart({
	data,
	total,
}: {
	data: Array<{ name: string; value: number; color: string }>;
	total: number;
}) {
	return (
		<div className="relative mx-auto size-[140px]">
			<ResponsiveContainer width="100%" height="100%">
				<PieChart>
					<Pie
						data={data}
						dataKey="value"
						nameKey="name"
						cx="50%"
						cy="50%"
						innerRadius={42}
						outerRadius={62}
						paddingAngle={2}
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
	chartData,
	isLoading,
}: {
	chartData: LeadsChartData | null | undefined;
	isLoading: boolean;
}) {
	const { resolvedTheme } = useTheme();
	const isDark = resolvedTheme === "dark";
	const tickColor = isDark ? "#94a3b8" : "#64748b";
	const gridStroke = isDark ? "#2a3538" : "#e8eef0";
	const dotStroke = isDark ? "#1a2a2c" : "#ffffff";

	const { stageData, monthlyData, categoryData, totalLeads } = useMemo(() => {
		const byStage = chartData?.byStage ?? {};
		const stageData = PIPELINE_STAGES.map((s, i) => ({
			name: s.label,
			value: byStage[s.value] ?? 0,
			color: CHART_COLORS[i % CHART_COLORS.length],
		})).filter((s) => s.value > 0);

		const monthlyData = (chartData?.monthlyTrend ?? []).map((m) => ({
			month: m.label,
			leads: m.count,
		}));

		const categoryData = (chartData?.byCategory ?? []).map((c, i) => ({
			name: c.name,
			value: c.count,
			color: CHART_COLORS[i % CHART_COLORS.length],
		}));

		return {
			stageData,
			monthlyData,
			categoryData,
			totalLeads: chartData?.total ?? 0,
		};
	}, [chartData]);

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

	if (!chartData || totalLeads === 0) return null;

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
										<stop
											offset="55%"
											stopColor={PRIMARY_SOFT}
											stopOpacity={0.12}
										/>
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
									tick={{ fill: tickColor, fontSize: 11 }}
									tickLine={false}
									axisLine={false}
								/>
								<YAxis
									allowDecimals={false}
									tick={{ fill: tickColor, fontSize: 11 }}
									tickLine={false}
									axisLine={false}
									width={28}
								/>
								<Tooltip content={<AreaTooltip />} />
								<Area
									type="monotone"
									dataKey="leads"
									stroke={PRIMARY}
									strokeWidth={2}
									fill="url(#leadsAreaFill)"
									dot={{ r: 3, fill: PRIMARY, stroke: dotStroke, strokeWidth: 2 }}
									activeDot={{ r: 5 }}
								/>
							</AreaChart>
						</ResponsiveContainer>
					</div>
				</div>
			</ChartCardShell>

			<ChartCardShell title="By Pipeline Stage" icon={<RiPieChart2Line size={16} />}>
				<DonutChart data={stageData} total={totalLeads} />
			</ChartCardShell>

			<ChartCardShell title="By Category" icon={<RiPieChart2Line size={16} />}>
				{categoryData.length > 0 ? (
					<DonutChart
						data={categoryData}
						total={categoryData.reduce((s, c) => s + c.value, 0)}
					/>
				) : (
					<p className="py-10 text-center text-muted-foreground text-xs">
						No category data
					</p>
				)}
			</ChartCardShell>
		</div>
	);
}
