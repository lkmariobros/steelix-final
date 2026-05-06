"use client";

import { AppSidebar } from "@/components/app-sidebar";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/dialog";
import { HeaderActions } from "@/components/header-actions";
import { Separator } from "@/components/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/sidebar";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingScreen } from "@/components/ui/loading-spinner";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRedirectUnauthenticated } from "@/hooks/use-redirect-unauthenticated";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import {
	RiArrowLeftLine,
	RiDashboardLine,
	RiMoneyDollarCircleLine,
} from "@remixicon/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

function formatRm(n: number | string) {
	return new Intl.NumberFormat("en-MY", {
		style: "currency",
		currency: "MYR",
		minimumFractionDigits: 2,
	}).format(typeof n === "string" ? Number.parseFloat(n) : n);
}

export default function CommissionPayoutDetailPage() {
	const params = useParams();
	const id = params.id as string;
	const { data: session, isPending } = authClient.useSession();
	useRedirectUnauthenticated(session, isPending);

	const q = trpc.commissionPayouts.adminGet.useQuery(
		{ id },
		{ enabled: !!session && !!id },
	);

	const [note, setNote] = useState("");
	const [releaseOpen, setReleaseOpen] = useState(false);
	const [method, setMethod] = useState<"bank_transfer" | "cheque" | "cash">("bank_transfer");
	const [ref, setRef] = useState("");
	const [payDate, setPayDate] = useState("");

	const utils = trpc.useUtils();

	const approve = trpc.commissionPayouts.adminApprove.useMutation({
		onSuccess: () => {
			toast.success("Approved");
			void q.refetch();
			void utils.commissionPayouts.adminList.invalidate();
		},
		onError: (e) => toast.error(e.message),
	});

	const release = trpc.commissionPayouts.adminRelease.useMutation({
		onSuccess: () => {
			toast.success("Released");
			setReleaseOpen(false);
			void q.refetch();
			void utils.commissionPayouts.adminList.invalidate();
		},
		onError: (e) => toast.error(e.message),
	});

	const paid = trpc.commissionPayouts.adminMarkPaid.useMutation({
		onSuccess: () => {
			toast.success("Marked paid");
			void q.refetch();
			void utils.commissionPayouts.adminList.invalidate();
		},
		onError: (e) => toast.error(e.message),
	});

	const hold = trpc.commissionPayouts.adminHold.useMutation({
		onSuccess: () => {
			toast.success("On hold");
			void q.refetch();
			void utils.commissionPayouts.adminList.invalidate();
		},
		onError: (e) => toast.error(e.message),
	});

	const voidP = trpc.commissionPayouts.adminVoid.useMutation({
		onSuccess: () => {
			toast.success("Voided");
			void q.refetch();
			void utils.commissionPayouts.adminList.invalidate();
		},
		onError: (e) => toast.error(e.message),
	});

	if (isPending) return <LoadingScreen text="Loading..." />;
	if (!session) return <LoadingScreen text="Redirecting..." />;

	const row = q.data;
	if (q.isLoading || !row) {
		return (
			<SidebarProvider>
				<AppSidebar />
				<SidebarInset className="px-4 py-8">
					<p className="text-muted-foreground">Loading…</p>
				</SidebarInset>
			</SidebarProvider>
		);
	}

	const p = row.payout;
	const scheme = p.commissionSchemeSnapshot as Record<string, unknown> | null;

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
									<BreadcrumbPage className="flex items-center gap-2">
										<RiMoneyDollarCircleLine size={18} />
										{p.caseNo ?? p.id.slice(0, 8)}
									</BreadcrumbPage>
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
							Back to list
						</Link>
					</Button>

					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<h1 className="font-semibold text-2xl">
								{p.caseNo ? `Case ${p.caseNo}` : "Commission payout"}
							</h1>
							<p className="text-muted-foreground text-sm">
								{row.agentName} · {p.payoutType === "override" ? "Override" : "Negotiator"}
							</p>
						</div>
						<Badge variant="outline">{p.status}</Badge>
					</div>

					<div className="grid gap-4 lg:grid-cols-2">
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Commission</CardTitle>
							</CardHeader>
							<CardContent className="grid gap-2 text-sm">
								<div className="flex justify-between">
									<span className="text-muted-foreground">Project / block</span>
									<span>
										{p.projectName ?? "—"} {p.blockLabel ? `· ${p.blockLabel}` : ""}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Unit</span>
									<span>{p.unitNo ?? "—"}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">SPA price</span>
									<span>{p.spaPrice != null ? formatRm(p.spaPrice) : "—"}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Nett price</span>
									<span>{formatRm(p.nettPrice)}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Commission %</span>
									<span>{p.commissionPercent}%</span>
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
								{scheme && (
									<div className="mt-2 rounded-md border bg-muted/20 p-2 text-xs">
										<p className="font-medium">Scheme snapshot</p>
										<pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap">
											{JSON.stringify(scheme, null, 2)}
										</pre>
									</div>
								)}
								{p.claimStageLabel && (
									<div className="flex justify-between">
										<span className="text-muted-foreground">Claim stage</span>
										<span>
											{p.claimStageLabel}
											{p.claimStagePercent != null
												? ` (${p.claimStagePercent}%)`
												: ""}
										</span>
									</div>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="text-base">Payment &amp; profile</CardTitle>
							</CardHeader>
							<CardContent className="grid gap-2 text-sm">
								<div className="flex justify-between">
									<span className="text-muted-foreground">Bank (from profile)</span>
									<span>{row.bankName ?? "—"}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Account no.</span>
									<span className="font-mono">{row.bankAccountNo ?? "—"}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Method</span>
									<span>{p.paymentMethod ?? "—"}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Payment date</span>
									<span>
										{p.paymentDate
											? new Date(p.paymentDate).toLocaleDateString("en-MY")
											: "—"}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Reference</span>
									<span className="font-mono">{p.paymentReferenceNo ?? "—"}</span>
								</div>
								{p.paymentReceiptUrl && (
									<div>
										<a
											className="text-primary underline"
											href={p.paymentReceiptUrl}
											target="_blank"
											rel="noreferrer"
										>
											Payment proof
										</a>
									</div>
								)}
							</CardContent>
						</Card>
					</div>

					<Card>
						<CardHeader>
							<CardTitle className="text-base">Audit log</CardTitle>
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
									{e.notes && <p className="text-muted-foreground text-xs">{e.notes}</p>}
								</div>
							))}
							{(!p.auditLog || p.auditLog.length === 0) && (
								<p className="text-muted-foreground">No entries.</p>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="text-base">Admin actions</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-wrap gap-2">
							<Textarea
								placeholder="Internal note (optional)"
								value={note}
								onChange={(e) => setNote(e.target.value)}
								className="min-h-[72px] w-full"
							/>
							{p.status === "pending_approval" && (
								<Button
									disabled={approve.isPending}
									onClick={() => approve.mutate({ id, internalNote: note || undefined })}
								>
									Approve commission
								</Button>
							)}
							{p.status === "approved" && (
								<Button onClick={() => setReleaseOpen(true)}>Release payment</Button>
							)}
							{p.status === "released" && (
								<Button
									disabled={paid.isPending}
									onClick={() => paid.mutate({ id, internalNote: note || undefined })}
								>
									Mark paid
								</Button>
							)}
							{p.status !== "paid" && p.status !== "voided" && (
								<>
									<Button
										variant="secondary"
										disabled={hold.isPending}
										onClick={() => hold.mutate({ id, reason: note || undefined })}
									>
										On hold
									</Button>
									<Button
										variant="destructive"
										disabled={voidP.isPending}
										onClick={() => {
											if (!confirm("Void this commission line?")) return;
											voidP.mutate({ id, reason: note || undefined });
										}}
									>
										Void
									</Button>
								</>
							)}
						</CardContent>
					</Card>
				</div>

				<Dialog open={releaseOpen} onOpenChange={setReleaseOpen}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Release payment</DialogTitle>
						</DialogHeader>
						<div className="grid gap-3">
							<div>
								<Label>Method</Label>
								<Select
									value={method}
									onValueChange={(v) => setMethod(v as typeof method)}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="bank_transfer">Bank transfer</SelectItem>
										<SelectItem value="cheque">Cheque</SelectItem>
										<SelectItem value="cash">Cash</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label>Payment date</Label>
								<Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
							</div>
							<div>
								<Label>Reference no.</Label>
								<Input value={ref} onChange={(e) => setRef(e.target.value)} />
							</div>
						</div>
						<DialogFooter>
							<Button variant="outline" onClick={() => setReleaseOpen(false)}>
								Cancel
							</Button>
							<Button
								disabled={release.isPending || !payDate || !ref}
								onClick={() =>
									release.mutate({
										id,
										paymentMethod: method,
										paymentDate: new Date(payDate),
										paymentReferenceNo: ref,
										internalNote: note || undefined,
									})
								}
							>
								Confirm
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</SidebarInset>
		</SidebarProvider>
	);
}
