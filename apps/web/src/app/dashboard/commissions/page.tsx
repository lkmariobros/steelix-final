"use client";

import { HeaderActions } from "@/components/header-actions";
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
import { Input } from "@/components/ui/input";
import { LoadingScreen } from "@/components/ui/loading-spinner";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarTrigger } from "@/components/sidebar";
import { MetricCard } from "@/dashboards/admin/widgets/metric-card";
import { useRedirectUnauthenticated } from "@/hooks/use-redirect-unauthenticated";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import {
	RiDashboardLine,
	RiEyeLine,
	RiMoneyDollarCircleLine,
	RiSearchLine,
	RiTimeLine,
	RiWallet3Line,
} from "@remixicon/react";
import Link from "next/link";
import { useMemo, useState } from "react";

function formatRm(n: number | string) {
	return new Intl.NumberFormat("en-MY", {
		style: "currency",
		currency: "MYR",
		minimumFractionDigits: 2,
	}).format(typeof n === "string" ? Number.parseFloat(n) : n);
}

const thClass =
	"h-11 bg-muted/50 px-4 font-semibold text-foreground/80 text-xs tracking-wide";
const tdClass = "px-4 py-3.5 align-middle text-sm";

const actionBtnClass =
	"size-8 shrink-0 rounded-full border-0 bg-primary/12 p-0 text-primary shadow-none hover:bg-primary/20 hover:text-primary";

function statusBadge(status: string) {
	const map: Record<string, { label: string; className: string }> = {
		pending_approval: {
			label: "Pending Approval",
			className:
				"bg-amber-100 text-amber-800 dark:bg-amber-900/35 dark:text-amber-300",
		},
		approved: {
			label: "Approved",
			className: "bg-sky-100 text-sky-800 dark:bg-sky-900/35 dark:text-sky-300",
		},
		released: {
			label: "Released",
			className:
				"bg-violet-100 text-violet-800 dark:bg-violet-900/35 dark:text-violet-300",
		},
		paid: {
			label: "Paid",
			className:
				"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-300",
		},
		on_hold: {
			label: "On Hold",
			className: "bg-muted text-muted-foreground",
		},
		voided: {
			label: "Voided",
			className: "bg-rose-100 text-rose-800 dark:bg-rose-900/35 dark:text-rose-300",
		},
	};
	const m = map[status] ?? {
		label: status.replaceAll("_", " "),
		className: "bg-muted text-muted-foreground",
	};
	return (
		<span
			className={cn(
				"inline-flex rounded-full px-2.5 py-0.5 font-medium text-[11px]",
				m.className,
			)}
		>
			{m.label}
		</span>
	);
}

export default function AgentCommissionsPage() {
	const { data: session, isPending } = authClient.useSession();
	useRedirectUnauthenticated(session?.user?.id, isPending);

	const [search, setSearch] = useState("");
	const [status, setStatus] = useState<string>("__all__");
	const [page, setPage] = useState(0);
	const pageSize = 20;

	const args = useMemo(
		() => ({
			search: search.trim() || undefined,
			status:
				status === "__all__"
					? undefined
					: (status as
							| "pending_approval"
							| "approved"
							| "released"
							| "paid"
							| "on_hold"
							| "voided"),
			limit: pageSize,
			offset: page * pageSize,
		}),
		[search, status, page],
	);

	const list = trpc.commissionPayouts.agentList.useQuery(args, {
		enabled: !!session,
	});
	const summary = trpc.commissionPayouts.agentSummary.useQuery(undefined, {
		enabled: !!session,
	});

	if (isPending) return <LoadingScreen text="Loading..." />;
	if (!session) return <LoadingScreen text="Redirecting..." />;

	const items = list.data?.items ?? [];
	const total = list.data?.total ?? 0;
	const earned = summary.data?.totalEarnedRm ?? 0;
	const received = summary.data?.totalReceivedRm ?? 0;
	const outstanding = summary.data?.outstandingRm ?? 0;

	return (
		<>
			<header className="sticky top-0 z-40 -mx-4 flex h-16 shrink-0 items-center gap-2 border-border/60 border-b bg-background px-4 backdrop-blur-md supports-backdrop-filter:bg-background/95 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
				<div className="flex flex-1 items-center gap-2 px-1 sm:px-0">
					<SidebarTrigger className="-ms-1 rounded-xl" />
					<Separator
						orientation="vertical"
						className="mr-2 data-[orientation=vertical]:h-4"
					/>
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem className="hidden md:block">
								<BreadcrumbLink href="/dashboard">
									<RiDashboardLine size={22} aria-hidden />
									<span className="sr-only">Dashboard</span>
								</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator className="hidden md:block" />
							<BreadcrumbItem>
								<BreadcrumbPage className="flex items-center gap-2 font-medium">
									<span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
										<RiMoneyDollarCircleLine size={16} />
									</span>
									My commissions
								</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				</div>
				<div className="ml-auto flex gap-2">
					<HeaderActions />
				</div>
			</header>

			<div className="flex flex-1 flex-col gap-5 py-5 lg:gap-6 lg:py-7">
				<div className="min-w-0">
					<h1 className="font-bold text-2xl tracking-tight">
						My commissions
					</h1>
					<p className="mt-0.5 text-muted-foreground text-sm">
						Read-only view of your payout status (RM).
					</p>
				</div>

				{summary.isLoading ? (
					<div className="grid items-stretch gap-4 sm:grid-cols-3">
						{["sk-a", "sk-b", "sk-c"].map((id) => (
							<div
								key={id}
								className="overflow-hidden rounded-3xl border border-border/40 bg-card p-5 shadow-card"
							>
								<div className="mb-3 flex items-start justify-between">
									<Skeleton className="h-3.5 w-24" />
									<Skeleton className="size-11 rounded-2xl" />
								</div>
								<Skeleton className="mb-2 h-8 w-28" />
								<Skeleton className="h-5 w-32 rounded-full" />
							</div>
						))}
					</div>
				) : (
					<div className="grid items-stretch gap-4 sm:grid-cols-3">
						<MetricCard
							title="Total earned"
							value={formatRm(earned)}
							changeLabel="Gross commission earned"
							trend={earned > 0 ? "up" : "neutral"}
							icon={<RiMoneyDollarCircleLine size={20} />}
							sparkline={[40, 48, 42, 55, 50, 62, 58, 70, 64, 72, 68, 80]}
							variant="gradient"
						/>
						<MetricCard
							title="Total received"
							value={formatRm(received)}
							changeLabel="Paid to your account"
							trend={received > 0 ? "up" : "neutral"}
							icon={<RiWallet3Line size={20} />}
							sparkline={[28, 35, 32, 40, 38, 48, 45, 52, 50, 58, 55, 62]}
						/>
						<MetricCard
							title="Outstanding"
							value={formatRm(outstanding)}
							changeLabel="Awaiting payment"
							trend={outstanding > 0 ? "neutral" : "up"}
							icon={<RiTimeLine size={20} />}
							sparkline={[35, 42, 38, 50, 45, 55, 52, 60, 58, 65, 62, 70]}
						/>
					</div>
				)}

				<Card className="gap-0 overflow-hidden border-border/70 py-0 shadow-card">
					<CardContent className="flex flex-col gap-4 p-5">
						<div className="flex flex-wrap items-center gap-2.5">
							<div className="relative min-w-[min(100%,220px)] w-full flex-1 basis-full sm:basis-0">
								<RiSearchLine className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
								<Input
									className="h-10 rounded-xl border-border/70 bg-muted/30 pl-9 shadow-none focus-visible:bg-background"
									placeholder="Search case or project…"
									value={search}
									onChange={(e) => {
										setSearch(e.target.value);
										setPage(0);
									}}
								/>
							</div>
							<Select
								value={status}
								onValueChange={(v) => {
									setStatus(v);
									setPage(0);
								}}
							>
								<SelectTrigger className="h-10 w-full min-w-[160px] rounded-full border-border/70 bg-card shadow-card sm:w-[200px]">
									<SelectValue placeholder="Status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="__all__">All statuses</SelectItem>
									<SelectItem value="pending_approval">
										Pending approval
									</SelectItem>
									<SelectItem value="approved">Approved</SelectItem>
									<SelectItem value="released">Released</SelectItem>
									<SelectItem value="paid">Paid</SelectItem>
									<SelectItem value="on_hold">On hold</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="overflow-hidden rounded-2xl border border-border/60">
							<Table>
								<TableHeader>
									<TableRow className="hover:bg-transparent">
										<TableHead className={thClass}>Project</TableHead>
										<TableHead className={thClass}>Case</TableHead>
										<TableHead className={cn(thClass, "text-right")}>
											Nett
										</TableHead>
										<TableHead className={cn(thClass, "text-right")}>
											Net comm.
										</TableHead>
										<TableHead className={thClass}>Status</TableHead>
										<TableHead className={cn(thClass, "text-center")}>
											Detail
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{list.isLoading ? (
										Array.from({ length: 6 }).map((_, i) => (
											<TableRow key={`sk-${i}`} className="border-border/50">
												<TableCell className={tdClass}>
													<Skeleton className="h-4 w-28" />
												</TableCell>
												<TableCell className={tdClass}>
													<Skeleton className="h-4 w-16" />
												</TableCell>
												<TableCell className={tdClass}>
													<Skeleton className="ml-auto h-4 w-20" />
												</TableCell>
												<TableCell className={tdClass}>
													<Skeleton className="ml-auto h-4 w-20" />
												</TableCell>
												<TableCell className={tdClass}>
													<Skeleton className="h-5 w-24 rounded-full" />
												</TableCell>
												<TableCell className={tdClass}>
													<Skeleton className="mx-auto size-8 rounded-full" />
												</TableCell>
											</TableRow>
										))
									) : items.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={6}
												className="h-28 text-center text-muted-foreground text-sm"
											>
												No commission payouts yet.
											</TableCell>
										</TableRow>
									) : (
										items.map((r) => (
											<TableRow
												key={r.id}
												className="border-border/50 hover:bg-muted/40"
											>
												<TableCell className={cn(tdClass, "font-medium")}>
													{r.projectName ?? "—"}
												</TableCell>
												<TableCell
													className={cn(tdClass, "font-mono text-xs")}
												>
													{r.caseNo ?? "—"}
												</TableCell>
												<TableCell
													className={cn(tdClass, "text-right tabular-nums")}
												>
													{formatRm(r.nettPrice)}
												</TableCell>
												<TableCell
													className={cn(
														tdClass,
														"text-right font-semibold tabular-nums",
													)}
												>
													{formatRm(r.netCommission)}
												</TableCell>
												<TableCell className={tdClass}>
													{statusBadge(r.status)}
												</TableCell>
												<TableCell className={cn(tdClass, "text-center")}>
													<Button
														variant="outline"
														size="icon"
														className={actionBtnClass}
														asChild
													>
														<Link
															href={`/dashboard/commissions/${r.id}`}
															aria-label="View commission detail"
														>
															<RiEyeLine className="size-4" />
														</Link>
													</Button>
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</div>

						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<span className="text-muted-foreground text-sm">
								{total} total · page {page + 1}
							</span>
							<div className="flex gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="h-9 rounded-full border-border/70 px-4 shadow-card"
									disabled={page === 0}
									onClick={() => setPage((p) => Math.max(0, p - 1))}
								>
									Prev
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="h-9 rounded-full border-border/70 px-4 shadow-card"
									disabled={!list.data?.hasMore}
									onClick={() => setPage((p) => p + 1)}
								>
									Next
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</>
	);
}
