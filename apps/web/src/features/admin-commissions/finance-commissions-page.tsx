"use client";

import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/dialog";
import { HeaderActions } from "@/components/header-actions";
import { Separator } from "@/components/separator";
import { SidebarTrigger } from "@/components/sidebar";
import {
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
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetricCard } from "@/dashboards/admin/widgets/metric-card";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatAgentPickerLabel } from "@/lib/agent-display";
import { authClient } from "@/lib/auth-client";
import { formatDateDMY } from "@/lib/date-format";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import {
	RiCalendarLine,
	RiCheckboxCircleLine,
	RiCloseCircleLine,
	RiDashboardLine,
	RiDownloadLine,
	RiMoneyDollarCircleLine,
	RiSearchLine,
	RiTimeLine,
} from "@remixicon/react";
import { format } from "date-fns";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export type FinanceCommissionsMode = "approval" | "payout";
type FinanceSegment = "new_project" | "subsale" | "rental";

const SEGMENT_TABS: { value: FinanceSegment; label: string }[] = [
	{ value: "new_project", label: "New Project" },
	{ value: "subsale", label: "Subsale" },
	{ value: "rental", label: "Rental" },
];

const APPROVAL_STATUSES = ["pending_approval", "on_hold"] as const;
const PAYOUT_STATUSES = ["approved", "released", "paid"] as const;

const thClass =
	"sticky top-0 z-20 h-11 whitespace-nowrap border-b border-border/60 bg-muted px-3 font-semibold text-foreground/80 text-xs tracking-wide shadow-[0_1px_0_0_hsl(var(--border)/0.6)]";
const tdClass = "px-3 py-3 align-middle text-sm";

function formatRm(n: number | string | null | undefined) {
	const value =
		typeof n === "string" ? Number.parseFloat(n) : typeof n === "number" ? n : 0;
	return new Intl.NumberFormat("en-MY", {
		style: "currency",
		currency: "MYR",
		minimumFractionDigits: 2,
	}).format(Number.isFinite(value) ? value : 0);
}

function parseYmd(value: string): Date | undefined {
	if (!value) return undefined;
	const d = new Date(`${value}T00:00:00`);
	return Number.isNaN(d.getTime()) ? undefined : d;
}

function toYmd(date: Date | undefined): string {
	if (!date) return "";
	return format(date, "yyyy-MM-dd");
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
		cancelled: {
			label: "Cancelled",
			className: "bg-rose-100 text-rose-800 dark:bg-rose-900/35 dark:text-rose-300",
		},
		pending: {
			label: "Pending",
			className:
				"bg-amber-100 text-amber-800 dark:bg-amber-900/35 dark:text-amber-300",
		},
	};
	const m = map[status] ?? {
		label: status,
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

function FilterDatePicker({
	label,
	value,
	onChange,
}: {
	label: string;
	value: string;
	onChange: (next: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const selected = parseYmd(value);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className={cn(
						"h-9 w-[158px] justify-start gap-2 rounded-full border-border/70 bg-card font-normal shadow-card",
						!selected && "text-muted-foreground",
					)}
				>
					<RiCalendarLine className="size-3.5 shrink-0" />
					<span className="truncate text-xs">
						{selected ? formatDateDMY(selected) : label}
					</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto border-border/70 p-0 shadow-card" align="start">
				<Calendar
					mode="single"
					selected={selected}
					onSelect={(date) => {
						onChange(toYmd(date));
						if (date) setOpen(false);
					}}
					initialFocus
				/>
				<div className="flex items-center justify-between border-border/60 border-t px-3 py-2">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-8 rounded-full px-2.5 text-xs"
						onClick={() => {
							onChange("");
							setOpen(false);
						}}
					>
						Clear
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-8 rounded-full px-2.5 text-xs"
						onClick={() => {
							onChange(toYmd(new Date()));
							setOpen(false);
						}}
					>
						Today
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}

type LocationRow = {
	projectName: string | null;
	unitNo: string | null;
	blockLabel?: string | null;
	marketType: "primary" | "secondary" | null;
	propertyAddress: string | null;
	segment: FinanceSegment;
};

function LocationCell({ r }: { r: LocationRow }) {
	if (r.segment === "new_project") {
		const project = r.projectName ?? r.blockLabel;
		if (!project && !r.unitNo) return <>—</>;
		return (
			<div className="min-w-0">
				<p className="truncate font-medium">{project ?? "—"}</p>
				{r.unitNo ? (
					<p className="truncate text-muted-foreground text-xs">
						Unit {r.unitNo}
					</p>
				) : r.blockLabel && r.projectName ? (
					<p className="truncate text-muted-foreground text-xs">{r.blockLabel}</p>
				) : null}
			</div>
		);
	}
	return (
		<p
			className="line-clamp-2 break-words"
			title={r.propertyAddress ?? undefined}
		>
			{r.propertyAddress ?? "—"}
		</p>
	);
}

type PaymentTarget =
	| { kind: "payout"; id: string; outstanding: number; label: string }
	| { kind: "leadership"; id: string; outstanding: number; label: string };

export function FinanceCommissionsPage({
	mode,
}: {
	mode: FinanceCommissionsMode;
}) {
	const { data: session } = authClient.useSession();
	const isApproval = mode === "approval";
	const pageTitle = isApproval ? "Commissions Approval" : "Commissions Payout";
	const pageDescription = isApproval
		? "Review and approve agent commission rows by market segment."
		: "Record payments against approved commissions and leadership bonuses.";

	const [segment, setSegment] = useState<FinanceSegment>("new_project");
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search, 300);
	const [agentId, setAgentId] = useState("__all__");
	const [projectName, setProjectName] = useState("__all__");
	const [dateFrom, setDateFrom] = useState("");
	const [dateTo, setDateTo] = useState("");
	const [page, setPage] = useState(0);
	const pageSize = 25;

	const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);
	const [paymentDate, setPaymentDate] = useState("");
	const [paymentDateOpen, setPaymentDateOpen] = useState(false);
	const [paymentAmount, setPaymentAmount] = useState("");
	const [paymentReceiptUrl, setPaymentReceiptUrl] = useState("");
	const [paymentNote, setPaymentNote] = useState("");

	const showLeadership = segment === "new_project";

	const filterArgs = useMemo(
		() => ({
			search: debouncedSearch.trim() || undefined,
			agentId: agentId === "__all__" ? undefined : agentId,
			projectName: projectName === "__all__" ? undefined : projectName,
			statuses: [
				...(isApproval ? APPROVAL_STATUSES : PAYOUT_STATUSES),
			] as (
				| "pending_approval"
				| "approved"
				| "released"
				| "paid"
				| "on_hold"
				| "voided"
				| "cancelled"
			)[],
			segment,
			dateFrom: dateFrom ? new Date(dateFrom) : undefined,
			dateTo: dateTo ? new Date(dateTo) : undefined,
			limit: pageSize,
			offset: page * pageSize,
		}),
		[
			debouncedSearch,
			agentId,
			projectName,
			isApproval,
			segment,
			dateFrom,
			dateTo,
			page,
		],
	);

	const summaryFilters = useMemo(
		() => ({
			agentId: agentId === "__all__" ? undefined : agentId,
			projectName: projectName === "__all__" ? undefined : projectName,
			dateFrom: dateFrom ? new Date(dateFrom) : undefined,
			dateTo: dateTo ? new Date(dateTo) : undefined,
			segment,
		}),
		[agentId, projectName, dateFrom, dateTo, segment],
	);

	const listQuery = trpc.commissionPayouts.adminList.useQuery(filterArgs, {
		enabled: !!session,
		staleTime: 10_000,
	});

	const summaryQuery = trpc.commissionPayouts.adminSummary.useQuery(
		summaryFilters,
		{ enabled: !!session, staleTime: 10_000 },
	);

	const lbSummaryQuery = trpc.admin.getLeadershipBonusSummary.useQuery(
		{ primaryOnly: true },
		{ enabled: !!session && showLeadership, staleTime: 10_000 },
	);

	const lbListQuery = trpc.admin.getAllLeadershipBonusPayments.useQuery(
		{ primaryOnly: true, limit: 50, offset: 0 },
		{ enabled: !!session && showLeadership, staleTime: 10_000 },
	);

	const projectsQuery = trpc.commissionSchemes.listProjects.useQuery(undefined, {
		enabled: !!session && segment === "new_project",
	});

	const agentsQuery = trpc.agents.list.useQuery(
		{ limit: 100, offset: 0, role: "agent", sortBy: "name", sortOrder: "asc" },
		{ enabled: !!session },
	);

	const refetchAll = async () => {
		await Promise.all([
			listQuery.refetch(),
			summaryQuery.refetch(),
			showLeadership ? lbListQuery.refetch() : Promise.resolve(),
			showLeadership ? lbSummaryQuery.refetch() : Promise.resolve(),
		]);
	};

	const approveMut = trpc.commissionPayouts.adminApprove.useMutation({
		onSuccess: () => {
			toast.success("Commission approved");
			void refetchAll();
		},
		onError: (e) => toast.error(e.message),
	});

	const cancelMut = trpc.commissionPayouts.adminCancel.useMutation({
		onSuccess: () => {
			toast.success("Commission rejected");
			void refetchAll();
		},
		onError: (e) => toast.error(e.message),
	});

	const addPaymentMut = trpc.commissionPayouts.adminAddPayment.useMutation({
		onSuccess: () => {
			toast.success("Payment recorded");
			closePaymentDialog();
			void refetchAll();
		},
		onError: (e) => toast.error(e.message),
	});

	const approveLbMut = trpc.commissionPayouts.adminApproveLeadershipBonus.useMutation({
		onSuccess: () => {
			toast.success("Leadership bonus approved");
			void refetchAll();
		},
		onError: (e) => toast.error(e.message),
	});

	const cancelLbMut = trpc.commissionPayouts.adminCancelLeadershipBonus.useMutation({
		onSuccess: () => {
			toast.success("Leadership bonus rejected");
			void refetchAll();
		},
		onError: (e) => toast.error(e.message),
	});

	const addLbPaymentMut =
		trpc.commissionPayouts.adminAddLeadershipBonusPayment.useMutation({
			onSuccess: () => {
				toast.success("Leadership bonus payment recorded");
				closePaymentDialog();
				void refetchAll();
			},
			onError: (e) => toast.error(e.message),
		});

	const closePaymentDialog = () => {
		setPaymentTarget(null);
		setPaymentDate("");
		setPaymentAmount("");
		setPaymentReceiptUrl("");
		setPaymentNote("");
	};

	const openPaymentDialog = (target: PaymentTarget) => {
		setPaymentTarget(target);
		setPaymentDate(toYmd(new Date()));
		setPaymentAmount(
			target.outstanding > 0 ? String(target.outstanding) : "",
		);
		setPaymentReceiptUrl("");
		setPaymentNote("");
	};

	const submitPayment = () => {
		if (!paymentTarget) return;
		const amount = Number.parseFloat(paymentAmount);
		if (!paymentDate || !Number.isFinite(amount) || amount <= 0) {
			toast.error("Enter a valid payment date and amount");
			return;
		}
		if (amount > paymentTarget.outstanding + 0.001) {
			toast.error(
				`Amount cannot exceed outstanding (${formatRm(paymentTarget.outstanding)})`,
			);
			return;
		}
		const payload = {
			paymentDate: new Date(paymentDate),
			amount,
			receiptUrl: paymentReceiptUrl.trim() || undefined,
			note: paymentNote.trim() || undefined,
		};
		if (paymentTarget.kind === "payout") {
			addPaymentMut.mutate({ payoutId: paymentTarget.id, ...payload });
		} else {
			addLbPaymentMut.mutate({ paymentId: paymentTarget.id, ...payload });
		}
	};

	const exportCsv = () => {
		const items = listQuery.data?.items ?? [];
		const headers = [
			"Case No",
			"Submit Date",
			"Agent",
			"Project / Address",
			"Unit No",
			"Nett Price (RM)",
			"Commission %",
			"Gross (RM)",
			"SST (RM)",
			"Net (RM)",
			...(isApproval ? [] : ["Paid (RM)", "Outstanding (RM)"]),
			"Status",
			"Type",
		];
		const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
		const lines = [
			headers.join(","),
			...items.map((r) =>
				[
					esc(r.caseNo ?? ""),
					esc(formatDateDMY(r.verifiedDate ?? r.submitDate ?? r.createdAt)),
					esc(
						r.isCompanyShare
							? r.shareLabel || r.agentName || "Devots"
							: formatAgentPickerLabel({
									name: r.agentName,
									nickName: r.agentNickName,
									agentCode: r.agentCode,
								}),
					),
					esc(
						segment === "new_project"
							? (r.projectName ?? r.blockLabel ?? "")
							: (r.propertyAddress ?? r.projectName ?? ""),
					),
					esc(r.unitNo ?? ""),
					r.nettPrice,
					r.commissionPercent,
					r.grossCommission,
					r.sstAmount,
					r.netCommission,
					...(isApproval
						? []
						: [r.paidAmountRm ?? 0, r.outstandingAmountRm ?? 0]),
					r.status,
					r.payoutType,
				].join(","),
			),
		];
		const blob = new Blob(["\ufeff", lines.join("\n")], {
			type: "text/csv;charset=utf-8",
		});
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = `commissions_${mode}_${segment}_${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(a.href);
	};

	const items = listQuery.data?.items ?? [];
	const cancelledRm =
		summaryQuery.data?.cancelledRm ?? summaryQuery.data?.releasedRm ?? 0;
	const totalCommissionRm =
		summaryQuery.data?.totalCommissionRm ??
		(summaryQuery.data?.pendingRm ?? 0) +
			(summaryQuery.data?.approvedRm ?? 0) +
			cancelledRm;

	const lbRows = useMemo(() => {
		const all = lbListQuery.data?.payments ?? [];
		if (!showLeadership) return [];
		if (isApproval) {
			return all.filter((r) =>
				["pending", "approved", "cancelled"].includes(r.status),
			);
		}
		return all.filter((r) => ["approved", "paid"].includes(r.status));
	}, [lbListQuery.data?.payments, showLeadership, isApproval]);

	const locationLabel =
		segment === "new_project" ? "Project & Unit" : "Address";

	const paymentPending =
		addPaymentMut.isPending || addLbPaymentMut.isPending;

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
								<BreadcrumbLink href="/admin">
									<RiDashboardLine size={22} aria-hidden />
									<span className="sr-only">Admin</span>
								</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator className="hidden md:block" />
							<BreadcrumbItem>
								<BreadcrumbPage className="flex items-center gap-2 font-medium">
									<span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
										<RiMoneyDollarCircleLine size={16} />
									</span>
									{pageTitle}
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
				<div className="sticky top-16 z-30 -mx-4 space-y-4 border-border/60 border-b bg-background/95 px-4 py-4 backdrop-blur-md supports-backdrop-filter:bg-background/90 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div className="min-w-0">
							<h1 className="font-bold text-2xl tracking-tight">{pageTitle}</h1>
							<p className="mt-0.5 text-muted-foreground text-sm">
								{pageDescription}
							</p>
						</div>
						<div className="flex flex-wrap gap-2">
							{!isApproval ? (
								<Button
									variant="outline"
									size="sm"
									className="h-9 rounded-xl"
									asChild
								>
									<Link href="/admin/commissions/claim-schedules">
										Claim schedules
									</Link>
								</Button>
							) : null}
							<Button
								variant="outline"
								size="sm"
								className="h-9 gap-1.5 rounded-xl"
								onClick={exportCsv}
							>
								<RiDownloadLine className="size-4" />
								Export CSV
							</Button>
						</div>
					</div>

					<div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<MetricCard
							title="Total pending"
							value={formatRm(summaryQuery.data?.pendingRm ?? 0)}
							changeLabel="Awaiting approval / on hold"
							trend="neutral"
							icon={<RiTimeLine size={20} />}
							sparkline={[40, 48, 42, 55, 50, 62, 58, 70, 64, 72, 68, 75]}
						/>
						<MetricCard
							title="Total approved"
							value={formatRm(summaryQuery.data?.approvedRm ?? 0)}
							changeLabel="Ready to pay"
							trend="up"
							icon={<RiCheckboxCircleLine size={20} />}
							sparkline={[30, 35, 40, 38, 48, 52, 50, 60, 58, 65, 70, 74]}
						/>
						<MetricCard
							title="Total Cancelled"
							value={formatRm(cancelledRm)}
							changeLabel="Rejected / cancelled"
							trend="neutral"
							icon={<RiCloseCircleLine size={20} />}
							sparkline={[25, 32, 28, 40, 45, 42, 55, 50, 60, 58, 66, 72]}
						/>
						<MetricCard
							title="Total Commission"
							value={formatRm(totalCommissionRm)}
							changeLabel="Pending + approved + cancelled"
							trend={totalCommissionRm > 0 ? "up" : "neutral"}
							icon={<RiMoneyDollarCircleLine size={20} />}
							variant="gradient"
						/>
					</div>

					<Tabs
						value={segment}
						onValueChange={(v) => {
							setSegment(v as FinanceSegment);
							setPage(0);
							setProjectName("__all__");
						}}
					>
						<TabsList className="h-11 rounded-full bg-muted/80 p-1 shadow-none">
							{SEGMENT_TABS.map((tab) => (
								<TabsTrigger
									key={tab.value}
									value={tab.value}
									className="rounded-full px-4 text-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
								>
									{tab.label}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</div>

				{showLeadership ? (
					<Card className="gap-0 overflow-hidden border-border/70 py-0 shadow-card">
						<CardContent className="space-y-4 p-5">
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div>
									<h2 className="font-semibold text-base">Leadership bonus</h2>
									<p className="text-muted-foreground text-sm">
										Upline bonus from verified New Project cases (1-level
										recruiter).
									</p>
								</div>
								<div className="flex flex-wrap gap-2.5 text-sm">
									{isApproval ? (
										<>
											<span className="rounded-full bg-amber-100 px-4 py-1.5 font-semibold text-amber-800 text-sm dark:bg-amber-900/35 dark:text-amber-300">
												Pending{" "}
												{formatRm(lbSummaryQuery.data?.pending.total ?? 0)}
											</span>
											<span className="rounded-full bg-sky-100 px-4 py-1.5 font-semibold text-sky-800 text-sm dark:bg-sky-900/35 dark:text-sky-300">
												Approved{" "}
												{formatRm(lbSummaryQuery.data?.approved.total ?? 0)}
											</span>
											<span className="rounded-full bg-rose-100 px-4 py-1.5 font-semibold text-rose-800 text-sm dark:bg-rose-900/35 dark:text-rose-300">
												Cancelled{" "}
												{formatRm(lbSummaryQuery.data?.cancelled.total ?? 0)}
											</span>
										</>
									) : (
										<>
											<span className="rounded-full bg-sky-100 px-4 py-1.5 font-semibold text-sky-800 text-sm dark:bg-sky-900/35 dark:text-sky-300">
												Approved{" "}
												{formatRm(lbSummaryQuery.data?.approved.total ?? 0)}
											</span>
											<span className="rounded-full bg-emerald-100 px-4 py-1.5 font-semibold text-emerald-800 text-sm dark:bg-emerald-900/35 dark:text-emerald-300">
												Paid {formatRm(lbSummaryQuery.data?.paid.total ?? 0)}
											</span>
										</>
									)}
								</div>
							</div>
							<div className="overflow-x-auto rounded-xl border border-border/60">
								<table className="w-full min-w-[960px] text-left">
									<thead>
										<tr>
											<th className={thClass}>Case No</th>
											<th className={thClass}>Verified Date</th>
											<th className={thClass}>Agent</th>
											<th className={thClass}>Upline</th>
											<th className={thClass}>Project & Unit No</th>
											<th className={thClass}>Rate</th>
											<th className={`${thClass} text-right`}>Net Comm</th>
											<th className={`${thClass} text-right`}>Amount</th>
											{!isApproval ? (
												<>
													<th className={`${thClass} text-right`}>Paid</th>
													<th className={`${thClass} text-right`}>
														Outstanding
													</th>
												</>
											) : null}
											<th className={thClass}>Status</th>
											<th className={thClass}>Action</th>
										</tr>
									</thead>
									<tbody>
										{lbListQuery.isLoading ? (
											<tr>
												<td className={tdClass} colSpan={isApproval ? 10 : 12}>
													Loading leadership bonus…
												</td>
											</tr>
										) : lbRows.length === 0 ? (
											<tr>
												<td
													className={`${tdClass} text-muted-foreground`}
													colSpan={isApproval ? 10 : 12}
												>
													{isApproval
														? "No leadership bonus pending approval."
														: "No approved leadership bonus ready for payout."}
												</td>
											</tr>
										) : (
											lbRows.map((row) => {
												const outstanding = row.outstandingAmountRm ?? 0;
												const canPay =
													!isApproval &&
													(row.status === "approved" || row.status === "paid") &&
													outstanding > 0;
												return (
													<tr
														key={row.id}
														className="border-border/50 border-t"
													>
														<td className={tdClass}>
															{row.caseNo ? (
																<Link
																	className="font-medium text-primary hover:underline"
																	href={`/admin/transactions/case/${row.transactionId}`}
																>
																	{row.caseNo}
																</Link>
															) : (
																"—"
															)}
														</td>
														<td className={cn(tdClass, "whitespace-nowrap")}>
															{formatDateDMY(row.verifiedDate)}
														</td>
														<td className={tdClass}>
															{row.downlineName ?? "—"}
														</td>
														<td className={tdClass}>
															<div>
																<p>{row.uplineName ?? "—"}</p>
																<p className="text-muted-foreground text-xs capitalize">
																	{(row.uplineTier ?? "").replaceAll("_", " ")}
																</p>
															</div>
														</td>
														<td className={tdClass}>
															<div className="min-w-0">
																<p className="truncate font-medium">
																	{row.projectName ?? "—"}
																</p>
																{row.unitNo ? (
																	<p className="truncate text-muted-foreground text-xs">
																		Unit {row.unitNo}
																	</p>
																) : null}
															</div>
														</td>
														<td className={tdClass}>
															{row.leadershipBonusRate}%
														</td>
														<td
															className={`${tdClass} text-right tabular-nums`}
														>
															{formatRm(row.originalCommissionAmount)}
														</td>
														<td
															className={`${tdClass} text-right font-medium tabular-nums`}
														>
															{formatRm(row.leadershipBonusAmount)}
														</td>
														{!isApproval ? (
															<>
																<td
																	className={`${tdClass} text-right tabular-nums`}
																>
																	{formatRm(row.paidAmountRm ?? 0)}
																</td>
																<td
																	className={`${tdClass} text-right tabular-nums`}
																>
																	{formatRm(outstanding)}
																</td>
															</>
														) : null}
														<td className={tdClass}>
															{statusBadge(row.status)}
														</td>
														<td className={tdClass}>
															{isApproval && row.status === "pending" ? (
																<div className="flex flex-wrap gap-1.5">
																	<Button
																		size="sm"
																		className="h-8 rounded-full"
																		disabled={approveLbMut.isPending}
																		onClick={() =>
																			approveLbMut.mutate({
																				paymentId: row.id,
																			})
																		}
																	>
																		Approve
																	</Button>
																	<Button
																		size="sm"
																		variant="outline"
																		className="h-8 rounded-full"
																		disabled={cancelLbMut.isPending}
																		onClick={() =>
																			cancelLbMut.mutate({
																				paymentId: row.id,
																			})
																		}
																	>
																		Reject
																	</Button>
																</div>
															) : canPay ? (
																<Button
																	size="sm"
																	variant="outline"
																	className="h-8 rounded-full"
																	onClick={() =>
																		openPaymentDialog({
																			kind: "leadership",
																			id: row.id,
																			outstanding,
																			label:
																				row.caseNo ??
																				row.uplineName ??
																				"Leadership bonus",
																		})
																	}
																>
																	Add payment
																</Button>
															) : (
																<span className="text-muted-foreground text-xs">
																	—
																</span>
															)}
														</td>
													</tr>
												);
											})
										)}
									</tbody>
								</table>
							</div>
						</CardContent>
					</Card>
				) : null}

				<Card className="gap-0 overflow-hidden border-border/70 py-0 shadow-card">
					<CardContent className="flex flex-col gap-4 p-5">
						<div className="flex flex-wrap items-center gap-2.5">
							<div className="relative min-w-[200px] flex-1">
								<RiSearchLine className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
								<Input
									className="h-10 rounded-xl border-border/70 bg-muted/30 pl-9 shadow-none focus-visible:bg-background"
									placeholder="Search agent, case no, Project / Unit no…"
									value={search}
									onChange={(e) => {
										setSearch(e.target.value);
										setPage(0);
									}}
								/>
							</div>
							<Select
								value={agentId}
								onValueChange={(v) => {
									setAgentId(v);
									setPage(0);
								}}
							>
								<SelectTrigger className="h-10 w-[180px] rounded-xl border-border/70 bg-muted/30 shadow-none">
									<SelectValue placeholder="Agent" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="__all__">All agents</SelectItem>
									{(agentsQuery.data?.agents ?? []).map(({ agent }) => (
										<SelectItem key={agent.id} value={agent.id}>
											{agent.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{segment === "new_project" ? (
								<Select
									value={projectName}
									onValueChange={(v) => {
										setProjectName(v);
										setPage(0);
									}}
								>
									<SelectTrigger className="h-10 w-[180px] rounded-xl border-border/70 bg-muted/30 shadow-none">
										<SelectValue placeholder="Project" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="__all__">All projects</SelectItem>
										{(projectsQuery.data ?? []).map((p) => (
											<SelectItem key={p} value={p}>
												{p}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							) : null}
							<FilterDatePicker
								label="From date"
								value={dateFrom}
								onChange={(v) => {
									setDateFrom(v);
									setPage(0);
								}}
							/>
							<FilterDatePicker
								label="To date"
								value={dateTo}
								onChange={(v) => {
									setDateTo(v);
									setPage(0);
								}}
							/>
						</div>

						<div className="overflow-x-auto rounded-xl border border-border/70">
							<div className="max-h-[min(70vh,720px)] overflow-y-auto [scrollbar-gutter:stable] [scrollbar-width:thin]">
								<table className="w-full min-w-[1100px] caption-bottom border-collapse text-sm">
									<TableHeader>
										<TableRow className="border-border/60 hover:bg-transparent">
											<TableHead className={cn(thClass, "w-[96px]")}>
												Case No
											</TableHead>
											<TableHead className={cn(thClass, "w-[110px]")}>
												{isApproval ? "Verified Date" : "Submit Date"}
											</TableHead>
											<TableHead className={cn(thClass, "w-[160px]")}>
												Agent
											</TableHead>
											<TableHead className={cn(thClass, "w-[180px]")}>
												{locationLabel}
											</TableHead>
											<TableHead
												className={cn(thClass, "w-[96px] text-right")}
											>
												Nett
											</TableHead>
											<TableHead className={cn(thClass, "w-14 text-right")}>
												%
											</TableHead>
											<TableHead
												className={cn(thClass, "w-[96px] text-right")}
											>
												Gross
											</TableHead>
											<TableHead
												className={cn(thClass, "w-[80px] text-right")}
											>
												SST
											</TableHead>
											<TableHead
												className={cn(thClass, "w-[96px] text-right")}
											>
												Net
											</TableHead>
											{!isApproval ? (
												<>
													<TableHead
														className={cn(thClass, "w-[96px] text-right")}
													>
														Paid
													</TableHead>
													<TableHead
														className={cn(thClass, "w-[96px] text-right")}
													>
														Outstanding
													</TableHead>
												</>
											) : null}
											<TableHead className={cn(thClass, "w-[120px]")}>
												Status
											</TableHead>
											<TableHead className={cn(thClass, "w-[140px]")}>
												Action
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{listQuery.isLoading ? (
											Array.from(
												{ length: 8 },
												(_, i) => `sk-finance-commission-${i}`,
											).map((id) => (
												<TableRow
													key={id}
													className="border-border/50 hover:bg-transparent"
												>
													{Array.from({
														length: isApproval ? 11 : 13,
													}).map((_, i) => (
														<TableCell
															key={`${id}-c${i}`}
															className={tdClass}
														>
															<Skeleton className="h-3.5 w-16" />
														</TableCell>
													))}
												</TableRow>
											))
										) : items.length === 0 ? (
											<TableRow>
												<TableCell
													colSpan={isApproval ? 11 : 13}
													className="py-10 text-center text-muted-foreground"
												>
													{isApproval
														? "No commissions pending approval for this segment."
														: "No approved commissions ready for payout in this segment."}
												</TableCell>
											</TableRow>
										) : (
											items.map((r) => {
												const outstanding = r.outstandingAmountRm ?? 0;
												const canApproveRow =
													isApproval && r.status === "pending_approval";
												const canRejectRow =
													isApproval &&
													(r.status === "pending_approval" ||
														r.status === "on_hold");
												const canPay =
													!isApproval &&
													!r.isCompanyShare &&
													outstanding > 0 &&
													(r.status === "approved" ||
														r.status === "released" ||
														r.status === "paid");
												const agentLabel = r.isCompanyShare
													? r.shareLabel || r.agentName || "Devots"
													: formatAgentPickerLabel({
															name: r.agentName,
															nickName: r.agentNickName,
															agentCode: r.agentCode,
														});

												return (
													<TableRow
														key={r.id}
														className="border-border/50 hover:bg-muted/35"
													>
														<TableCell
															className={cn(tdClass, "font-mono text-xs")}
														>
															{r.caseNo ?? "—"}
														</TableCell>
														<TableCell
															className={cn(tdClass, "whitespace-nowrap")}
														>
															{formatDateDMY(
																r.verifiedDate ?? r.submitDate ?? r.createdAt,
															)}
														</TableCell>
														<TableCell className={tdClass}>
															<div className="min-w-0">
																<p className="font-semibold text-sm">
																	{agentLabel}
																</p>
																{r.isCompanyShare ? (
																	<p className="text-muted-foreground text-xs">
																		Company share
																	</p>
																) : r.payeeAgentId ? (
																	<Button
																		variant="link"
																		className="h-auto p-0 text-xs"
																		asChild
																	>
																		<Link
																			href={`/admin/commissions/agents/${r.payeeAgentId}`}
																		>
																			History
																		</Link>
																	</Button>
																) : null}
															</div>
														</TableCell>
														<TableCell className={cn(tdClass, "max-w-[220px]")}>
															<LocationCell
																r={{
																	projectName: r.projectName,
																	unitNo: r.unitNo,
																	blockLabel: r.blockLabel,
																	marketType: r.marketType,
																	propertyAddress: r.propertyAddress,
																	segment,
																}}
															/>
														</TableCell>
														<TableCell
															className={cn(tdClass, "text-right tabular-nums")}
														>
															{formatRm(r.nettPrice)}
														</TableCell>
														<TableCell
															className={cn(tdClass, "text-right tabular-nums")}
														>
															{r.commissionPercent}%
														</TableCell>
														<TableCell
															className={cn(tdClass, "text-right tabular-nums")}
														>
															{formatRm(r.grossCommission)}
														</TableCell>
														<TableCell
															className={cn(tdClass, "text-right tabular-nums")}
														>
															{formatRm(r.sstAmount)}
														</TableCell>
														<TableCell
															className={cn(
																tdClass,
																"text-right font-semibold tabular-nums",
															)}
														>
															{formatRm(r.netCommission)}
														</TableCell>
														{!isApproval ? (
															<>
																<TableCell
																	className={cn(
																		tdClass,
																		"text-right tabular-nums",
																	)}
																>
																	{formatRm(r.paidAmountRm ?? 0)}
																</TableCell>
																<TableCell
																	className={cn(
																		tdClass,
																		"text-right tabular-nums",
																	)}
																>
																	{formatRm(outstanding)}
																</TableCell>
															</>
														) : null}
														<TableCell className={tdClass}>
															{statusBadge(r.status)}
														</TableCell>
														<TableCell className={tdClass}>
															{canApproveRow || canRejectRow ? (
																<div className="flex flex-wrap gap-1.5">
																	{canApproveRow ? (
																		<Button
																			size="sm"
																			className="h-8 rounded-full"
																			disabled={approveMut.isPending}
																			onClick={() =>
																				approveMut.mutate({ id: r.id })
																			}
																		>
																			Approve
																		</Button>
																	) : null}
																	{canRejectRow ? (
																		<Button
																			size="sm"
																			variant="outline"
																			className="h-8 rounded-full"
																			disabled={cancelMut.isPending}
																			onClick={() =>
																				cancelMut.mutate({ id: r.id })
																			}
																		>
																			Reject
																		</Button>
																	) : null}
																</div>
															) : canPay ? (
																<Button
																	size="sm"
																	variant="outline"
																	className="h-8 rounded-full"
																	onClick={() =>
																		openPaymentDialog({
																			kind: "payout",
																			id: r.id,
																			outstanding,
																			label: r.caseNo ?? agentLabel,
																		})
																	}
																>
																	Add payment
																</Button>
															) : r.isCompanyShare && !isApproval ? (
																<span className="text-muted-foreground text-xs">
																	No payment
																</span>
															) : (
																<Button
																	variant="link"
																	className="h-auto p-0 text-xs"
																	asChild
																>
																	<Link href={`/admin/commissions/${r.id}`}>
																		Details
																	</Link>
																</Button>
															)}
														</TableCell>
													</TableRow>
												);
											})
										)}
									</TableBody>
								</table>
							</div>
						</div>

						<div className="flex flex-wrap items-center justify-between gap-3 border-border/60 border-t pt-3 text-muted-foreground text-sm">
							<span>
								Showing page {page + 1} · {listQuery.data?.total ?? 0} entries
							</span>
							<div className="flex gap-2">
								<Button
									variant="outline"
									size="sm"
									className="h-8 rounded-lg"
									disabled={page === 0}
									onClick={() => setPage((p) => Math.max(0, p - 1))}
								>
									Previous
								</Button>
								<Button
									variant="outline"
									size="sm"
									className="h-8 rounded-lg"
									disabled={!listQuery.data?.hasMore}
									onClick={() => setPage((p) => p + 1)}
								>
									Next
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			<Dialog
				open={!!paymentTarget}
				onOpenChange={(open) => {
					if (!open) closePaymentDialog();
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add payment</DialogTitle>
					</DialogHeader>
					<p className="text-muted-foreground text-sm">
						{paymentTarget
							? `${paymentTarget.label} · Outstanding ${formatRm(paymentTarget.outstanding)}`
							: null}
					</p>
					<div className="grid gap-3">
						<div>
							<Label>Payment date</Label>
							<Popover open={paymentDateOpen} onOpenChange={setPaymentDateOpen}>
								<PopoverTrigger asChild>
									<Button
										type="button"
										variant="outline"
										className={cn(
											"mt-1 h-9 w-full justify-start gap-2 rounded-full font-normal shadow-card",
											!paymentDate && "text-muted-foreground",
										)}
									>
										<RiCalendarLine className="size-3.5 text-muted-foreground" />
										{paymentDate
											? formatDateDMY(parseYmd(paymentDate) ?? new Date())
											: "Select payment date"}
									</Button>
								</PopoverTrigger>
								<PopoverContent
									className="w-auto border-border/70 p-0 shadow-card"
									align="start"
								>
									<Calendar
										mode="single"
										selected={parseYmd(paymentDate)}
										onSelect={(date) => {
											setPaymentDate(toYmd(date));
											if (date) setPaymentDateOpen(false);
										}}
										initialFocus
									/>
								</PopoverContent>
							</Popover>
						</div>
						<div>
							<Label>Amount (RM)</Label>
							<Input
								className="mt-1"
								type="number"
								min={0}
								step="0.01"
								max={paymentTarget?.outstanding}
								value={paymentAmount}
								onChange={(e) => setPaymentAmount(e.target.value)}
							/>
						</div>
						<div>
							<Label>Receipt URL (optional)</Label>
							<Input
								className="mt-1"
								placeholder="https://…"
								value={paymentReceiptUrl}
								onChange={(e) => setPaymentReceiptUrl(e.target.value)}
							/>
						</div>
						<div>
							<Label>Note (optional)</Label>
							<Input
								className="mt-1"
								value={paymentNote}
								onChange={(e) => setPaymentNote(e.target.value)}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={closePaymentDialog}>
							Cancel
						</Button>
						<Button disabled={paymentPending} onClick={submitPayment}>
							Save payment
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
