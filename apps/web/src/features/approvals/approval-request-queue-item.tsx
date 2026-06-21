"use client";

import { Button } from "@/components/ui/button";
import {
	formatStatusLabel,
	getStatusBadgeClass,
} from "@/features/transactions/transaction-detail-utils";
import { formatRequestItemLabel } from "@/features/transactions/request-items";
import {
	RiCheckLine,
	RiCloseLine,
	RiFileList3Line,
} from "@remixicon/react";
import Link from "next/link";
import type { ReactNode } from "react";

export type ApprovalRequestQueueTransaction = {
	id: string;
	caseNo?: string | null;
	agentName?: string | null;
	agentCode?: string | null;
	coAgentName?: string | null;
	coAgentCode?: string | null;
	isCoBroking?: boolean | null;
	status: string | null;
	marketType?: string | null;
	transactionType: string;
	bookingDate?: Date | string | null;
	transactionDate?: Date | string | null;
	projectName?: string | null;
	unitNo?: string | null;
	requestItem?: string | null;
	requestSubmittedAt?: Date | string | null;
	commissionAmount: string | null;
	propertyData?: {
		address?: string;
		price?: number;
		spaPrice?: number;
		nettPrice?: number;
		purchasingMethod?: "cash" | "loan";
	} | null;
};

type RequestCategory = "new-project" | "subsale" | "rental";

function formatRm(amount: string | number | null | undefined) {
	if (amount === null || amount === undefined || amount === "") return "—";
	const num = typeof amount === "string" ? Number.parseFloat(amount) : amount;
	if (Number.isNaN(num)) return "—";
	return new Intl.NumberFormat("en-MY", {
		style: "currency",
		currency: "MYR",
		minimumFractionDigits: 2,
	}).format(num);
}

function formatDate(date: Date | string | null | undefined) {
	if (!date) return "—";
	return new Date(date).toLocaleDateString("en-MY", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

function formatCashLoan(method?: string | null) {
	if (!method) return "—";
	return method === "cash" ? "Cash" : method === "loan" ? "Loan" : method;
}

function getRequestCategory(
	tx: ApprovalRequestQueueTransaction,
): RequestCategory {
	if (tx.transactionType === "rental" || tx.transactionType === "lease") {
		return "rental";
	}
	if (tx.marketType === "primary") return "new-project";
	return "subsale";
}

function DetailField({
	label,
	value,
}: {
	label: string;
	value: ReactNode;
}) {
	return (
		<p>
			<span className="text-muted-foreground">{label}: </span>
			{value}
		</p>
	);
}

function AgentLine({
	name,
	code,
}: {
	name?: string | null;
	code?: string | null;
}) {
	if (!name && !code) return <span className="text-muted-foreground">—</span>;
	return (
		<span>
			{name ?? "—"}
			{code ? (
				<span className="ms-1 font-mono text-muted-foreground text-xs">
					({code})
				</span>
			) : null}
		</span>
	);
}

function RequestDetails({ tx }: { tx: ApprovalRequestQueueTransaction }) {
	const prop = tx.propertyData;
	const spa = prop?.spaPrice ?? prop?.price;
	const nett = prop?.nettPrice ?? prop?.price;
	const category = getRequestCategory(tx);
	const requestDate = tx.requestSubmittedAt ?? tx.transactionDate;

	if (category === "new-project") {
		return (
			<div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
				<DetailField
					label="Booking Date"
					value={formatDate(tx.bookingDate ?? tx.transactionDate)}
				/>
				<DetailField label="Project" value={tx.projectName?.trim() || "—"} />
				<DetailField label="Unit No" value={tx.unitNo?.trim() || "—"} />
				<DetailField label="SPA Price" value={formatRm(spa)} />
				<DetailField label="Nett Price" value={formatRm(nett)} />
				<DetailField
					label="Cash/Loan"
					value={formatCashLoan(prop?.purchasingMethod)}
				/>
				<DetailField
					label="Commission Amount"
					value={formatRm(tx.commissionAmount)}
				/>
				<DetailField
					label="Request Item"
					value={formatRequestItemLabel(tx.requestItem)}
				/>
			</div>
		);
	}

	return (
		<div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
			<DetailField label="Request Date" value={formatDate(requestDate)} />
			<DetailField label="Address" value={prop?.address?.trim() || "—"} />
			<DetailField
				label="Commission Amount"
				value={formatRm(tx.commissionAmount)}
			/>
			<DetailField
				label="Request Item"
				value={formatRequestItemLabel(tx.requestItem)}
			/>
		</div>
	);
}

export function ApprovalRequestQueueItem({
	transaction,
	onApprove,
	onReject,
}: {
	transaction: ApprovalRequestQueueTransaction;
	onApprove: (tx: ApprovalRequestQueueTransaction) => void;
	onReject: (tx: ApprovalRequestQueueTransaction) => void;
}) {
	const isCo = transaction.isCoBroking === true;

	return (
		<div className="flex flex-col gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50 lg:flex-row lg:items-start lg:justify-between">
			<div className="min-w-0 flex-1 space-y-3">
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
					{transaction.caseNo ? (
						<span className="font-mono font-semibold text-sm">
							{transaction.caseNo}
						</span>
					) : (
						<span className="text-muted-foreground text-sm">No case no.</span>
					)}
					<span className="text-muted-foreground">·</span>
					<span className="text-sm">
						<AgentLine
							name={transaction.agentName}
							code={transaction.agentCode}
						/>
						{isCo ? (
							<>
								<span className="mx-1 text-muted-foreground">&</span>
								<AgentLine
									name={transaction.coAgentName}
									code={transaction.coAgentCode}
								/>
							</>
						) : null}
					</span>
					<span
						className={`rounded-full px-2 py-0.5 text-xs ${getStatusBadgeClass(transaction.status)}`}
					>
						{formatStatusLabel(transaction.status)}
					</span>
				</div>
				<RequestDetails tx={transaction} />
			</div>
			<div className="flex shrink-0 flex-wrap gap-2">
				<Button size="sm" variant="secondary" asChild>
					<Link href={`/admin/transactions/case/${transaction.id}`}>
						<RiFileList3Line className="mr-1 h-4 w-4" />
						View details
					</Link>
				</Button>
				<Button
					size="sm"
					variant="outline"
					className="text-green-600 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-950/30"
					onClick={() => onApprove(transaction)}
				>
					<RiCheckLine className="mr-1 h-4 w-4" />
					Approve
				</Button>
				<Button
					size="sm"
					variant="outline"
					className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
					onClick={() => onReject(transaction)}
				>
					<RiCloseLine className="mr-1 h-4 w-4" />
					Reject
				</Button>
			</div>
		</div>
	);
}
