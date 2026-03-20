"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Lead } from "./lead-models";
import { PIPELINE_STAGES } from "./lead-constants";
import {
	Area,
	AreaChart,
	Cell,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { RiBarChartLine } from "@remixicon/react";

// Color palette — matches the original implementation order
const CHART_COLORS = [
	"#60a5fa", // blue-400
	"#fbbf24", // amber-400
	"#94a3b8", // slate-400
	"#c084fc", // purple-400
	"#2dd4bf", // teal-400
	"#fb923c", // orange-400
	"#4ade80", // green-400
	"#f87171", // red-400
	"#34d399", // emerald-400
	"#f472b6", // pink-400
];

// Axis tick color — a fixed light-gray that looks sharp in both light and dark
const TICK_COLOR = "#94a3b8";

function AreaTooltip({
	active,
	payload,
	label,
}: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
	if (!active || !payload?.length) return null;
	return (
		<div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
			<p className="mb-1 font-semibold text-foreground text-xs">{label}</p>
			<p className="text-muted-foreground text-xs">
				<span className="font-bold text-blue-400">{payload[0].value}</span>{" "}
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
		<div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
			<div className="flex items-center gap-2">
				<span
					className="size-2.5 shrink-0 rounded-full"
					style={{ backgroundColor: item.payload.color }}
				/>
				<p className="font-semibold text-foreground text-xs">{item.name}</p>
			</div>
			<p className="mt-0.5 text-muted-foreground text-xs">
				<span className="font-bold text-foreground">{item.value}</span> leads
			</p>
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
	const { stageData, monthlyData } = useMemo(() => {
		// Stage distribution — attach color to each datum for the custom tooltip
		const stageCounts: Record<string, number> = {};
		for (const lead of leads) {
			stageCounts[lead.stage] = (stageCounts[lead.stage] ?? 0) + 1;
		}

		const stageData = PIPELINE_STAGES.map((s, i) => ({
			name: s.label,
			value: stageCounts[s.value] ?? 0,
			color: CHART_COLORS[i % CHART_COLORS.length],
		})).filter((s) => s.value > 0);

		// Monthly trend (last 6 months)
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

		return { stageData, monthlyData };
	}, [leads]);

	const totalLeads = stageData.reduce((s, d) => s + d.value, 0);

	if (isLoading) {
		return (
			<div className="grid gap-4 lg:grid-cols-3">
				<Card className="lg:col-span-2">
					<CardHeader className="pb-3">
						<Skeleton className="h-4 w-40" />
						<Skeleton className="h-3 w-56" />
					</CardHeader>
					<CardContent>
						<Skeleton className="h-[200px] w-full rounded-lg" />
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-3">
						<Skeleton className="h-4 w-36" />
						<Skeleton className="h-3 w-48" />
					</CardHeader>
					<CardContent className="flex items-center justify-center">
						<Skeleton className="h-[180px] w-[180px] rounded-full" />
					</CardContent>
				</Card>
			</div>
		);
	}

	if (leads.length === 0) return null;

	return (
		<div className="grid gap-4 lg:grid-cols-3">
			{/* ── Monthly trend — area chart ── */}
			<Card className="lg:col-span-2">
				<CardHeader className="pb-2">
					<div className="flex items-center gap-2">
						<RiBarChartLine size={16} className="text-blue-400" />
						<CardTitle className="font-semibold text-sm">
							Monthly Lead Trend
						</CardTitle>
					</div>
					<CardDescription className="text-xs">
						Leads created over the last 6 months
					</CardDescription>
				</CardHeader>
				<CardContent className="pr-4 pb-4 pl-0">
					<ResponsiveContainer width="100%" height={210}>
						<AreaChart
							data={monthlyData}
							margin={{ top: 8, right: 8, bottom: 0, left: 4 }}
						>
							<defs>
								<linearGradient
									id="leadsGradient"
									x1="0"
									y1="0"
									x2="0"
									y2="1"
								>
									<stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
									<stop offset="95%" stopColor="#60a5fa" stopOpacity={0.02} />
								</linearGradient>
							</defs>
							<XAxis
								dataKey="month"
								tick={{ fontSize: 12, fill: TICK_COLOR, fontWeight: 500 }}
								axisLine={{ stroke: "#334155" }}
								tickLine={false}
								dy={6}
							/>
							<YAxis
								tick={{ fontSize: 12, fill: TICK_COLOR, fontWeight: 500 }}
								axisLine={false}
								tickLine={false}
								allowDecimals={false}
								width={32}
							/>
							{/* @ts-ignore — recharts custom tooltip */}
							<Tooltip
								content={<AreaTooltip />}
								cursor={{
									stroke: "#60a5fa",
									strokeWidth: 1,
									strokeDasharray: "4 4",
								}}
							/>
							<Area
								type="monotone"
								dataKey="leads"
								stroke="#60a5fa"
								strokeWidth={2.5}
								fill="url(#leadsGradient)"
								dot={{
									r: 4,
									fill: "#60a5fa",
									stroke: "#1e3a5f",
									strokeWidth: 2,
								}}
								activeDot={{
									r: 6,
									fill: "#60a5fa",
									stroke: "#fff",
									strokeWidth: 2,
								}}
							/>
						</AreaChart>
					</ResponsiveContainer>
				</CardContent>
			</Card>

			{/* ── Stage distribution — donut chart ── */}
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="font-semibold text-sm">
						Stage Distribution
					</CardTitle>
					<CardDescription className="text-xs">
						Leads by pipeline stage
					</CardDescription>
				</CardHeader>
				<CardContent className="pb-3">
					{/* Donut + center label */}
					<div className="relative">
						<ResponsiveContainer width="100%" height={180}>
							<PieChart>
								<Pie
									data={stageData}
									cx="50%"
									cy="50%"
									innerRadius={54}
									outerRadius={80}
									paddingAngle={3}
									dataKey="value"
									strokeWidth={0}
								>
									{stageData.map((entry, idx) => (
										<Cell key={`cell-${idx}`} fill={entry.color} />
									))}
								</Pie>
								{/* @ts-ignore */}
								<Tooltip content={<PieTooltip />} />
							</PieChart>
						</ResponsiveContainer>

						{/* Center total */}
						<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
							<span className="font-bold text-2xl text-foreground leading-none">
								{totalLeads}
							</span>
							<span className="mt-0.5 text-muted-foreground text-xs">
								total
							</span>
						</div>
					</div>

					{/* Legend — all visible stages */}
					<div className="mt-2 space-y-1.5">
						{stageData.map((s) => {
							const pct = totalLeads ? Math.round((s.value / totalLeads) * 100) : 0;
							return (
								<div key={s.name} className="flex items-center gap-2">
									<span
										className="size-2.5 shrink-0 rounded-sm"
										style={{ backgroundColor: s.color }}
									/>
									<span
										className="min-w-0 flex-1 truncate font-medium text-foreground/90 text-xs"
										title={s.name}
									>
										{s.name}
									</span>
									<span className="shrink-0 text-muted-foreground text-xs">
										{pct}%
									</span>
									<span className="w-5 shrink-0 text-right font-semibold text-foreground text-xs">
										{s.value}
									</span>
								</div>
							);
						})}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

