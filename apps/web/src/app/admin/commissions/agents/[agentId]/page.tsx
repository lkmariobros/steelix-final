"use client";

import { HeaderActions } from "@/components/header-actions";
import { Separator } from "@/components/separator";
import { SidebarTrigger } from "@/components/sidebar";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/table";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { RiArrowLeftLine, RiDashboardLine } from "@remixicon/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { useTheme } from "next-themes";
import { useMemo } from "react";

function formatRm(n: number) {
	return new Intl.NumberFormat("en-MY", {
		style: "currency",
		currency: "MYR",
		minimumFractionDigits: 2,
	}).format(n);
}

function toNumber(v: unknown) {
	if (typeof v === "number") return v;
	if (typeof v === "string") {
		const n = Number.parseFloat(v);
		return Number.isNaN(n) ? 0 : n;
	}
	return 0;
}

const BAR_FILL = "#60a5fa"; // blue-400

export default function AdminAgentCommissionReportPage() {
	const { agentId } = useParams<{ agentId: string }>();
	const { data: session } = authClient.useSession();
	const { resolvedTheme } = useTheme();
	const isDark = resolvedTheme === "dark";

	const chartTheme = useMemo(
		() => ({
			gridStroke: isDark ? "#334155" : "#e2e8f0",
			tickColor: isDark ? "#94a3b8" : "#64748b",
			cursorFill: isDark ? "#0b1220" : "#f1f5f9",
			tooltip: {
				background: isDark ? "#0b1220" : "#ffffff",
				border: isDark ? "1px solid #1f2937" : "1px solid #e2e8f0",
				borderRadius: 8,
				color: isDark ? "#e5e7eb" : "#0f172a",
				boxShadow: isDark
					? "0 10px 30px -15px rgba(0,0,0,0.5)"
					: "0 10px 30px -15px rgba(15,23,42,0.15)",
			},
			tooltipLabel: isDark ? "#94a3b8" : "#64748b",
			tooltipItem: isDark ? "#e5e7eb" : "#0f172a",
		}),
		[isDark],
	);

	const report = trpc.commissionPayouts.adminAgentReport.useQuery(
		{ agentId },
		{ enabled: !!session && !!agentId },
	);

	const agentQ = trpc.agents.getById.useQuery(
		{ id: agentId },
		{ enabled: !!session && !!agentId },
	);

	const name = agentQ.data?.agent.name ?? agentId;
	const chartData = (report.data?.byMonth ?? []).map((m) => ({
		month: m.month,
		amount: m.amountRm,
	}));

	return (
		<>
				<header className="flex h-16 shrink-0 items-center gap-2 border-b">
					<div className="flex flex-1 items-center gap-2 px-3">
						<SidebarTrigger className="-ms-4" />
						<Separator orientation="vertical" className="mr-2 h-4" />
						<Breadcrumb>
							<BreadcrumbList>
								<BreadcrumbItem>
									<BreadcrumbLink href="/admin">
										<RiDashboardLine size={22} aria-hidden />
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator />
								<BreadcrumbItem>
									<BreadcrumbLink href="/admin/commissions">Commissions</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator />
								<BreadcrumbItem>
									<BreadcrumbPage>{name}</BreadcrumbPage>
								</BreadcrumbItem>
							</BreadcrumbList>
						</Breadcrumb>
					</div>
					<HeaderActions />
				</header>

				<div className="flex flex-col gap-4 py-6">
					<Button variant="ghost" className="w-fit gap-2" asChild>
						<Link href="/admin/commissions">
							<RiArrowLeftLine className="size-4" />
							Back
						</Link>
					</Button>

					<h1 className="font-semibold text-2xl">Commission history · {name}</h1>

					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{(
							[
								["Total transactions", report.data?.totalTransactions ?? 0],
								["Gross commission", formatRm(report.data?.totalGrossRm ?? 0)],
								["SST deducted", formatRm(report.data?.totalSstRm ?? 0)],
								["Net commission", formatRm(report.data?.totalNetRm ?? 0)],
								["Paid", formatRm(report.data?.totalPaidRm ?? 0)],
								["Outstanding", formatRm(report.data?.outstandingRm ?? 0)],
							] as const
						).map(([k, v]) => (
							<Card key={k}>
								<CardContent className="pt-4">
									<p className="text-muted-foreground text-xs">{k}</p>
									<p className="font-semibold text-lg">{v}</p>
								</CardContent>
							</Card>
						))}
					</div>

					<Card>
						<CardContent className="h-[320px] pt-6">
							<p className="mb-2 font-medium text-sm">Net commission by month (booking date)</p>
							{chartData.length === 0 ? (
								<p className="text-muted-foreground text-sm">No data yet.</p>
							) : (
								<ResponsiveContainer width="100%" height="100%">
									<BarChart data={chartData} margin={{ left: 8, right: 8 }}>
										<CartesianGrid
											strokeDasharray="3 3"
											stroke={chartTheme.gridStroke}
											opacity={0.6}
										/>
										<XAxis
											dataKey="month"
											tick={{
												fontSize: 11,
												fill: chartTheme.tickColor,
												fontWeight: 500,
											}}
											axisLine={{ stroke: chartTheme.gridStroke }}
											tickLine={false}
											dy={6}
										/>
										<YAxis
											tick={{
												fontSize: 11,
												fill: chartTheme.tickColor,
												fontWeight: 500,
											}}
											axisLine={false}
											tickLine={false}
											width={44}
										/>
										<Tooltip
											cursor={{ fill: chartTheme.cursorFill, opacity: 0.35 }}
											contentStyle={chartTheme.tooltip}
											labelStyle={{
												color: chartTheme.tooltipLabel,
												fontSize: 12,
											}}
											itemStyle={{ color: chartTheme.tooltipItem }}
											formatter={(v) => formatRm(toNumber(v))}
											labelFormatter={(l) => `Month ${String(l)}`}
										/>
										<Bar
											dataKey="amount"
											fill={BAR_FILL}
											radius={[4, 4, 0, 0]}
										/>
									</BarChart>
								</ResponsiveContainer>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardContent className="pt-4">
							<p className="mb-2 font-medium text-sm">All payout lines</p>
							<div className="rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Case</TableHead>
											<TableHead>Project</TableHead>
											<TableHead className="text-right">Net</TableHead>
											<TableHead>Status</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{(report.data?.payouts ?? []).map((p) => (
											<TableRow key={p.id}>
												<TableCell className="font-mono text-sm">{p.caseNo ?? "—"}</TableCell>
												<TableCell>{p.projectName ?? "—"}</TableCell>
												<TableCell className="text-right">
													{formatRm(toNumber(p.netCommission))}
												</TableCell>
												<TableCell>{p.status}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						</CardContent>
					</Card>
				</div>
		</>
	);
}
