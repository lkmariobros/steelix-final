"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TransactionDocumentsPanel } from "./transaction-documents-panel";
import {
	formatRm,
	formatStatusLabel,
	formatTransactionDate,
	formatTransactionDateTime,
	getStatusBadgeClass,
} from "./transaction-detail-utils";

export type TransactionDetailRecord = {
	id: string;
	caseNo?: string | null;
	agentId?: string | null;
	bookingDate?: Date | string | null;
	projectName?: string | null;
	unitNo?: string | null;
	blockListingId?: string | null;
	transactionDate?: Date | string | null;
	marketType?: string | null;
	transactionType?: string | null;
	status?: string | null;
	commissionAmount?: string | number | null;
	commissionValue?: string | number | null;
	commissionType?: string | null;
	notes?: string | null;
	isCoBroking?: boolean | null;
	propertyData?: {
		address?: string;
		propertyType?: string;
		price?: number;
		spaPrice?: number;
		nettPrice?: number;
		listingTitle?: string;
		bedrooms?: number;
		bathrooms?: number;
		area?: number;
		description?: string;
	} | null;
	clientData?: {
		name?: string;
		icNo?: string;
		email?: string;
		phone?: string;
		address?: string;
		type?: string;
		source?: string;
		notes?: string;
	} | null;
	coBrokingData?: {
		agentName?: string;
		agencyName?: string;
		commissionSplit?: number;
		agentEmail?: string;
		agentPhone?: string;
		contactInfo?: string;
	} | null;
	commissionBreakdown?: Record<string, unknown> | null;
	documents?:
		| {
				id?: string;
				name?: string;
				type?: string;
				url?: string;
				uploadedAt?: string;
		  }[]
		| null;
	createdAt?: Date | string | null;
	updatedAt?: Date | string | null;
	submittedAt?: Date | string | null;
};

function DetailRow({
	label,
	value,
}: {
	label: string;
	value: string | number | null | undefined;
}) {
	const display =
		value === null || value === undefined || value === "" ? "—" : String(value);
	return (
		<div className="min-w-0">
			<div className="text-muted-foreground text-xs">{label}</div>
			<div className="break-words text-sm">{display}</div>
		</div>
	);
}

function Section({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section className="space-y-3">
			<h3 className="font-semibold text-foreground text-sm">{title}</h3>
			{children}
		</section>
	);
}

export function TransactionDetailView({
	tx,
	agentName,
	agentEmail,
}: {
	tx: TransactionDetailRecord;
	agentName?: string | null;
	agentEmail?: string | null;
}) {
	const prop = tx.propertyData;
	const client = tx.clientData;
	const bd = tx.commissionBreakdown;
	const spa = prop?.spaPrice ?? prop?.price;
	const nett = prop?.nettPrice ?? prop?.price;
	const coBroking = tx.coBrokingData;

	return (
		<div className="space-y-8">
			<div className="flex flex-wrap items-center gap-2">
				{tx.caseNo ? (
					<Badge variant="outline" className="font-mono">
						{tx.caseNo}
					</Badge>
				) : null}
				<Badge className={getStatusBadgeClass(tx.status)}>
					{formatStatusLabel(tx.status)}
				</Badge>
				{tx.marketType ? (
					<Badge variant="outline" className="capitalize">
						{tx.marketType} market
					</Badge>
				) : null}
				{tx.transactionType ? (
					<Badge variant="outline" className="capitalize">
						{tx.transactionType}
					</Badge>
				) : null}
			</div>

			{(agentName || agentEmail) && (
				<>
					<Section title="Agent">
						<div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
							<DetailRow label="Agent name" value={agentName ?? undefined} />
							<DetailRow label="Agent email" value={agentEmail ?? undefined} />
						</div>
					</Section>
					<Separator />
				</>
			)}

			<Section title="Deal & property">
				<div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
					<DetailRow
						label="Booking / transaction date"
						value={formatTransactionDate(
							tx.bookingDate ?? tx.transactionDate,
						)}
					/>
					<DetailRow label="Project" value={tx.projectName ?? undefined} />
					<DetailRow label="Block / listing" value={prop?.listingTitle} />
					<DetailRow label="Unit no." value={tx.unitNo ?? undefined} />
					<DetailRow
						label="SPA price"
						value={spa !== undefined ? formatRm(spa) : undefined}
					/>
					<DetailRow
						label="Nett price"
						value={nett !== undefined ? formatRm(nett) : undefined}
					/>
					<DetailRow label="Property address" value={prop?.address} />
					<DetailRow label="Property type" value={prop?.propertyType} />
					{(prop?.bedrooms || prop?.bathrooms || prop?.area) && (
						<DetailRow
							label="Specifications"
							value={[
								prop?.bedrooms != null ? `${prop.bedrooms} bed` : null,
								prop?.bathrooms != null ? `${prop.bathrooms} bath` : null,
								prop?.area != null ? `${prop.area} sq ft` : null,
							]
								.filter(Boolean)
								.join(", ")}
						/>
					)}
					{prop?.description?.trim() ? (
						<div className="sm:col-span-2">
							<DetailRow label="Description" value={prop.description} />
						</div>
					) : null}
				</div>
			</Section>

			<Separator />

			<Section title="Client">
				<div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
					<DetailRow label="Name" value={client?.name} />
					<DetailRow label="Type" value={client?.type} />
					<DetailRow label="IC no." value={client?.icNo} />
					<DetailRow label="Phone" value={client?.phone} />
					<DetailRow label="Email" value={client?.email} />
					<DetailRow label="Source" value={client?.source} />
					{client?.address ? (
						<div className="sm:col-span-2">
							<DetailRow label="Address" value={client.address} />
						</div>
					) : null}
					{client?.notes?.trim() ? (
						<div className="sm:col-span-2">
							<DetailRow label="Client notes" value={client.notes} />
						</div>
					) : null}
				</div>
			</Section>

			<Separator />

			<Section title="Representation">
				<div className="rounded-lg border bg-muted/30 p-4">
					<DetailRow
						label="Type"
						value={
							tx.isCoBroking ? "Co-broking" : "Direct representation"
						}
					/>
					{tx.isCoBroking && coBroking ? (
						<div className="mt-3 grid gap-3 sm:grid-cols-2">
							<DetailRow label="Co-broker name" value={coBroking.agentName} />
							<DetailRow label="Agency" value={coBroking.agencyName} />
							<DetailRow
								label="Phone"
								value={coBroking.agentPhone ?? coBroking.contactInfo}
							/>
							<DetailRow label="Email" value={coBroking.agentEmail} />
							<DetailRow
								label="Commission split"
								value={
									coBroking.commissionSplit != null
										? `Co-broker ${coBroking.commissionSplit}% / You ${100 - coBroking.commissionSplit}%`
										: undefined
								}
							/>
						</div>
					) : null}
				</div>
			</Section>

			<Separator />

			<Section title="Commission">
				<div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
					<DetailRow label="Commission type" value={tx.commissionType} />
					<DetailRow
						label="Rate / value"
						value={
							tx.commissionType === "percentage" && tx.commissionValue != null
								? `${tx.commissionValue}%`
								: tx.commissionValue != null
									? formatRm(tx.commissionValue)
									: undefined
						}
					/>
					<DetailRow
						label="Total commission"
						value={
							tx.commissionAmount != null
								? formatRm(tx.commissionAmount)
								: undefined
						}
					/>
				</div>
				{bd && Object.keys(bd).length > 0 ? (
					<div className="mt-3 rounded-lg border bg-muted/20 p-4">
						<p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Breakdown snapshot
						</p>
						<div className="grid gap-3 sm:grid-cols-2">
							{typeof bd.spaPrice === "number" ? (
								<DetailRow label="SPA" value={formatRm(bd.spaPrice)} />
							) : null}
							{typeof bd.nettPrice === "number" ? (
								<DetailRow label="Nett" value={formatRm(bd.nettPrice)} />
							) : null}
							{typeof bd.commissionRatePercent === "number" ? (
								<DetailRow
									label="Rate"
									value={`${bd.commissionRatePercent}%`}
								/>
							) : null}
							{typeof bd.grossCommission === "number" ? (
								<DetailRow
									label="Gross"
									value={formatRm(bd.grossCommission)}
								/>
							) : null}
							{typeof bd.sstAmount === "number" ? (
								<DetailRow label="SST" value={formatRm(bd.sstAmount)} />
							) : null}
							{typeof bd.agentNetCommission === "number" ? (
								<DetailRow
									label="Net to agent"
									value={formatRm(bd.agentNetCommission)}
								/>
							) : null}
						</div>
					</div>
				) : null}
			</Section>

			<Separator />

			<Section title="Documents & notes">
				<div className="space-y-4 rounded-lg border bg-muted/30 p-4">
					<div className="space-y-2">
						<p className="text-muted-foreground text-xs">Documents</p>
						<TransactionDocumentsPanel
							transactionId={tx.id}
							fallbackDocuments={tx.documents}
						/>
					</div>
					{tx.notes?.trim() ? (
						<div>
							<p className="mb-1 text-muted-foreground text-xs">
								Additional notes
							</p>
							<p className="whitespace-pre-wrap text-sm">{tx.notes}</p>
						</div>
					) : null}
				</div>
			</Section>

			<Separator />

			<Section title="Record">
				<div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
					<DetailRow label="Transaction ID" value={tx.id} />
					<DetailRow
						label="Created"
						value={formatTransactionDateTime(tx.createdAt)}
					/>
					<DetailRow
						label="Last updated"
						value={formatTransactionDateTime(tx.updatedAt)}
					/>
					{tx.submittedAt ? (
						<DetailRow
							label="Submitted"
							value={formatTransactionDateTime(tx.submittedAt)}
						/>
					) : null}
				</div>
			</Section>
		</div>
	);
}
