"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { HeaderActions } from "@/components/header-actions";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/sidebar";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { DetailCardsSkeleton } from "@/components/loading-skeletons";
import { LoadingScreen } from "@/components/ui/loading-spinner";
import { Separator } from "@/components/ui/separator";
import { useRedirectUnauthenticated } from "@/hooks/use-redirect-unauthenticated";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import {
	RiArrowLeftLine,
	RiBankCardLine,
	RiDashboardLine,
	RiHistoryLine,
	RiMoneyDollarCircleLine,
} from "@remixicon/react";
import Link from "next/link";
import { useParams } from "next/navigation";

function formatRm(n: number | string) {
	return new Intl.NumberFormat("en-MY", {
		style: "currency",
		currency: "MYR",
		minimumFractionDigits: 2,
	}).format(typeof n === "string" ? Number.parseFloat(n) : n);
}

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

export default function AgentCommissionDetailPage() {
	const { id } = useParams<{ id: string }>();
	const { data: session, isPending } = authClient.useSession();
	useRedirectUnauthenticated(session?.user?.id, isPending);

	const q = trpc.commissionPayouts.agentGet.useQuery(
		{ id },
		{ enabled: !!session && !!id },
	);

	if (isPending) return <LoadingScreen text="Loading..." />;
	if (!session) return <LoadingScreen text="Redirecting..." />;

	const showSkeleton = q.isLoading;
	const row = q.data;
	const p = row?.payout;

	return (
		<SidebarProvider className="h-svh overflow-hidden">
			<AppSidebar />
			<SidebarInset className="h-svh min-h-0 overflow-y-auto overscroll-y-contain bg-background px-4 md:px-6 lg:px-8">
				<header className="sticky top-0 z-40 -mx-4 flex h-16 shrink-0 items-center gap-2 border-border/60 border-b bg-background px-4 backdrop-blur-md supports-backdrop-filter:bg-background/95 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
					<div className="flex flex-1 items-center gap-2 px-1 sm:px-0">
						<SidebarTrigger className="-ms-1 rounded-xl" />
						<Separator
							orientation="vertical"
							className="mr-2 data-[orientation=vertical]:h-4"
						/>
						<Breadcrumb>
							<BreadcrumbList>
								<BreadcrumbItem>
									<BreadcrumbLink href="/dashboard">
										<RiDashboardLine size={22} aria-hidden />
										<span className="sr-only">Dashboard</span>
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator />
								<BreadcrumbItem>
									<BreadcrumbLink href="/dashboard/commissions">
										Commissions
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator />
								<BreadcrumbItem>
									<BreadcrumbPage className="font-medium">
										{p?.caseNo ?? (p ? p.id.slice(0, 8) : "…")}
									</BreadcrumbPage>
								</BreadcrumbItem>
							</BreadcrumbList>
						</Breadcrumb>
					</div>
					<div className="ml-auto flex gap-2">
						<HeaderActions />
					</div>
				</header>

				<div className="flex flex-col gap-5 py-5 lg:gap-6 lg:py-7">
					<Button
						variant="outline"
						size="sm"
						className="h-9 w-fit gap-1.5 rounded-full border-border/70 px-4 shadow-card"
						asChild
					>
						<Link href="/dashboard/commissions">
							<RiArrowLeftLine className="size-4" />
							Back
						</Link>
					</Button>

					{showSkeleton ? (
						<DetailCardsSkeleton />
					) : !row || !p ? (
						<p className="text-muted-foreground text-sm">
							Commission not found.
						</p>
					) : (
						<>
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div>
									<h1 className="font-bold text-2xl tracking-tight">
										{p.caseNo ? `Case ${p.caseNo}` : "Commission"}
									</h1>
									<p className="mt-0.5 text-muted-foreground text-sm">
										{p.projectName ?? "Payout detail"}
									</p>
								</div>
								{statusBadge(p.status)}
							</div>

							<div className="grid gap-4 lg:grid-cols-2">
								<Card className="gap-0 overflow-hidden border-border/70 py-0 shadow-card">
									<CardHeader className="border-border/60 border-b px-5 py-4">
										<CardTitle className="flex items-center gap-2 text-base">
											<span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
												<RiMoneyDollarCircleLine className="size-4" />
											</span>
											Amounts
										</CardTitle>
									</CardHeader>
									<CardContent className="grid gap-3 p-5 text-sm">
										{[
											{ label: "Project", value: p.projectName ?? "—" },
											{ label: "Nett price", value: formatRm(p.nettPrice) },
											{
												label: "Gross commission",
												value: formatRm(p.grossCommission),
											},
											{ label: "SST", value: formatRm(p.sstAmount) },
										].map((rowItem) => (
											<div
												key={rowItem.label}
												className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 px-3.5 py-2.5"
											>
												<span className="text-muted-foreground">
													{rowItem.label}
												</span>
												<span className="font-medium tabular-nums">
													{rowItem.value}
												</span>
											</div>
										))}
										<div className="flex items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/10 px-3.5 py-2.5">
											<span className="font-medium text-primary">
												Net commission
											</span>
											<span className="font-bold tabular-nums text-primary">
												{formatRm(p.netCommission)}
											</span>
										</div>
									</CardContent>
								</Card>

								<Card className="gap-0 overflow-hidden border-border/70 py-0 shadow-card">
									<CardHeader className="border-border/60 border-b px-5 py-4">
										<CardTitle className="flex items-center gap-2 text-base">
											<span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
												<RiBankCardLine className="size-4" />
											</span>
											Payment
										</CardTitle>
									</CardHeader>
									<CardContent className="grid gap-3 p-5 text-sm">
										<div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 px-3.5 py-2.5">
											<span className="text-muted-foreground">Your bank</span>
											<span className="font-medium">{row.bankName ?? "—"}</span>
										</div>
										<div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 px-3.5 py-2.5">
											<span className="text-muted-foreground">Account</span>
											<span className="font-mono text-xs">
												{row.bankAccountNo ?? "—"}
											</span>
										</div>
										<div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 px-3.5 py-2.5">
											<span className="text-muted-foreground">Status</span>
											{statusBadge(p.status)}
										</div>
										{p.paymentReferenceNo ? (
											<div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 px-3.5 py-2.5">
												<span className="text-muted-foreground">
													Reference
												</span>
												<span className="font-mono text-xs">
													{p.paymentReferenceNo}
												</span>
											</div>
										) : null}
									</CardContent>
								</Card>
							</div>

							<Card className="gap-0 overflow-hidden border-border/70 py-0 shadow-card">
								<CardHeader className="border-border/60 border-b px-5 py-4">
									<CardTitle className="flex items-center gap-2 text-base">
										<span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
											<RiHistoryLine className="size-4" />
										</span>
										Activity
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-2 p-5">
									{(p.auditLog ?? []).length === 0 ? (
										<p className="py-4 text-center text-muted-foreground text-sm">
											No activity yet.
										</p>
									) : (
										(p.auditLog ?? []).map((e, i) => (
											<div
												key={`${e.at}-${i}`}
												className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 px-3.5 py-2.5"
											>
												<span className="font-medium text-sm">{e.action}</span>
												<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
													{new Date(e.at).toLocaleString("en-MY")}
												</span>
											</div>
										))
									)}
								</CardContent>
							</Card>
						</>
					)}
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
