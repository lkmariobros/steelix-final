"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { HeaderActions } from "@/components/header-actions";
import { Separator } from "@/components/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/sidebar";
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
import { LoadingScreen } from "@/components/ui/loading-spinner";
import { useRedirectUnauthenticated } from "@/hooks/use-redirect-unauthenticated";
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

const GRID_STROKE = "#334155"; // slate-700
const TICK_COLOR = "#94a3b8"; // slate-400
const BAR_FILL = "#60a5fa"; // blue-400

export default function AdminAgentCommissionReportPage() {
	const { agentId } = useParams<{ agentId: string }>();
	const { data: session, isPending } = authClient.useSession();
	useRedirectUnauthenticated(session, isPending);

	const report = trpc.commissionPayouts.adminAgentReport.useQuery(
		{ agentId },
		{ enabled: !!session && !!agentId },
	);

	const agentQ = trpc.agents.getById.useQuery(
		{ id: agentId },
		{ enabled: !!session && !!agentId },
	);

	if (isPending) return <LoadingScreen text="Loading..." />;
	if (!session) return <LoadingScreen text="Redirecting..." />;

	const name = agentQ.data?.agent.name ?? agentId;
	const chartData = (report.data?.byMonth ?? []).map((m) => ({
		month: m.month,
		amount: m.amountRm,
	}));

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset className="overflow-hidden px-4 md:px-6 lg:px-8">
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
											stroke={GRID_STROKE}
											opacity={0.6}
										/>
										<XAxis
											dataKey="month"
											tick={{ fontSize: 11, fill: TICK_COLOR, fontWeight: 500 }}
											axisLine={{ stroke: GRID_STROKE }}
											tickLine={false}
											dy={6}
										/>
										<YAxis
											tick={{ fontSize: 11, fill: TICK_COLOR, fontWeight: 500 }}
											axisLine={false}
											tickLine={false}
											width={44}
										/>
										<Tooltip
											cursor={{ fill: "#0b1220", opacity: 0.35 }}
											contentStyle={{
												background: "#0b1220",
												border: "1px solid #1f2937",
												borderRadius: 8,
												color: "#e5e7eb",
												boxShadow:
													"0 10px 30px -15px rgba(0,0,0,0.5)",
											}}
											labelStyle={{
												color: "#94a3b8",
												fontSize: 12,
											}}
											itemStyle={{ color: "#e5e7eb" }}
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
			</SidebarInset>
		</SidebarProvider>
	);
}
