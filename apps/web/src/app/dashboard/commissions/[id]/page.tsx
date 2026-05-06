"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { HeaderActions } from "@/components/header-actions";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingScreen } from "@/components/ui/loading-spinner";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/sidebar";
import { useRedirectUnauthenticated } from "@/hooks/use-redirect-unauthenticated";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { RiArrowLeftLine, RiDashboardLine } from "@remixicon/react";
import Link from "next/link";
import { useParams } from "next/navigation";

function formatRm(n: number | string) {
	return new Intl.NumberFormat("en-MY", {
		style: "currency",
		currency: "MYR",
		minimumFractionDigits: 2,
	}).format(typeof n === "string" ? Number.parseFloat(n) : n);
}

export default function AgentCommissionDetailPage() {
	const { id } = useParams<{ id: string }>();
	const { data: session, isPending } = authClient.useSession();
	useRedirectUnauthenticated(session, isPending);

	const q = trpc.commissionPayouts.agentGet.useQuery(
		{ id },
		{ enabled: !!session && !!id },
	);

	if (isPending) return <LoadingScreen text="Loading..." />;
	if (!session) return <LoadingScreen text="Redirecting..." />;

	if (q.isLoading || !q.data) {
		return (
			<SidebarProvider>
				<AppSidebar />
				<SidebarInset className="px-4 py-8">
					<p className="text-muted-foreground">Loading…</p>
				</SidebarInset>
			</SidebarProvider>
		);
	}

	const row = q.data;
	const p = row.payout;

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset className="overflow-hidden px-4 md:px-6 lg:px-8">
				<header className="flex h-16 shrink-0 items-center gap-2 border-b">
					<div className="flex flex-1 items-center gap-2 px-3">
						<SidebarTrigger className="-ms-4" />
						<Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
						<Breadcrumb>
							<BreadcrumbList>
								<BreadcrumbItem>
									<BreadcrumbLink href="/dashboard">
										<RiDashboardLine size={22} aria-hidden />
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator />
								<BreadcrumbItem>
									<BreadcrumbLink href="/dashboard/commissions">Commissions</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator />
								<BreadcrumbItem>
									<BreadcrumbPage>{p.caseNo ?? p.id.slice(0, 8)}</BreadcrumbPage>
								</BreadcrumbItem>
							</BreadcrumbList>
						</Breadcrumb>
					</div>
					<HeaderActions />
				</header>

				<div className="flex flex-col gap-4 py-6">
					<Button variant="ghost" className="w-fit gap-2" asChild>
						<Link href="/dashboard/commissions">
							<RiArrowLeftLine className="size-4" />
							Back
						</Link>
					</Button>

					<div className="flex flex-wrap items-center justify-between gap-2">
						<h1 className="font-semibold text-2xl">
							{p.caseNo ? `Case ${p.caseNo}` : "Commission"}
						</h1>
						<Badge variant="outline">{p.status.replaceAll("_", " ")}</Badge>
					</div>

					<div className="grid gap-4 lg:grid-cols-2">
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Amounts</CardTitle>
							</CardHeader>
							<CardContent className="grid gap-2 text-sm">
								<div className="flex justify-between">
									<span className="text-muted-foreground">Project</span>
									<span>{p.projectName ?? "—"}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Nett price</span>
									<span>{formatRm(p.nettPrice)}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Gross commission</span>
									<span>{formatRm(p.grossCommission)}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">SST</span>
									<span>{formatRm(p.sstAmount)}</span>
								</div>
								<div className="flex justify-between font-medium">
									<span>Net commission</span>
									<span>{formatRm(p.netCommission)}</span>
								</div>
							</CardContent>
						</Card>
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Payment</CardTitle>
							</CardHeader>
							<CardContent className="grid gap-2 text-sm">
								<div className="flex justify-between">
									<span className="text-muted-foreground">Your bank</span>
									<span>{row.bankName ?? "—"}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Account</span>
									<span className="font-mono">{row.bankAccountNo ?? "—"}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Status</span>
									<span>{p.status}</span>
								</div>
								{p.paymentReferenceNo && (
									<div className="flex justify-between">
										<span className="text-muted-foreground">Reference</span>
										<span className="font-mono">{p.paymentReferenceNo}</span>
									</div>
								)}
							</CardContent>
						</Card>
					</div>

					<Card>
						<CardHeader>
							<CardTitle className="text-base">Activity</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2 text-sm">
							{(p.auditLog ?? []).map((e, i) => (
								<div key={`${e.at}-${i}`} className="rounded-md border px-3 py-2">
									<div className="flex justify-between gap-2">
										<span className="font-medium">{e.action}</span>
										<span className="text-muted-foreground text-xs">
											{new Date(e.at).toLocaleString("en-MY")}
										</span>
									</div>
								</div>
							))}
						</CardContent>
					</Card>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
