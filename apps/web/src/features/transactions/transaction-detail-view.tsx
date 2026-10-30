"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
	formatSstPayBy,
	isRentalTransactionType,
} from "@/features/transactions/payment-method-utils";
import { trpc } from "@/utils/trpc";
import { ChevronDown, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TransactionDocumentsPanel } from "./transaction-documents-panel";
import {
	formatRm,
	formatStatusLabel,
	formatTransactionDate,
	formatTransactionDateTime,
	getStatusBadgeClass,
} from "./transaction-detail-utils";

type Party = {
	name?: string;
	icNo?: string;
	email?: string;
	phone?: string;
	address?: string;
};

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
	viewerRole?: "owner" | "co_broker" | null;
	myCommissionAmount?: number | null;
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
		offerDate?: string;
		submitDate?: string;
		rentFrom?: string;
		rentTo?: string;
		rentPeriod?: string;
		renewOptionYears?: number;
		earnestDeposit?: number;
		sstPercent?: number;
		sstPayBy?: string;
		purchasingMethod?: string;
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
		additionalPurchasers?: Party[];
		vendors?: Party[];
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

function PartyCard({
	title,
	party,
}: {
	title: string;
	party: Party | null | undefined;
}) {
	return (
		<div className="rounded-lg border bg-muted/30 p-4">
			<p className="mb-3 font-medium text-sm">{title}</p>
			<div className="grid gap-3 sm:grid-cols-2">
				<DetailRow label="Name" value={party?.name} />
				<DetailRow label="IC / Passport" value={party?.icNo} />
				<DetailRow label="Phone" value={party?.phone} />
				<DetailRow label="Email" value={party?.email} />
				{party?.address ? (
					<div className="sm:col-span-2">
						<DetailRow label="Address" value={party.address} />
					</div>
				) : null}
			</div>
		</div>
	);
}

type EformKind =
	| "letter_of_appointment"
	| "letter_of_offer";

export function TransactionDetailView({
	tx,
	agentName,
	agentEmail,
	allowDocumentUpload = false,
}: {
	tx: TransactionDetailRecord;
	agentName?: string | null;
	agentEmail?: string | null;
	/** When true, show upload controls (admin anytime; agent even when case details are locked). */
	allowDocumentUpload?: boolean;
}) {
	const prop = tx.propertyData;
	const client = tx.clientData;
	const bd = tx.commissionBreakdown;
	const spa = prop?.spaPrice ?? prop?.price;
	const nett = prop?.nettPrice ?? prop?.price;
	const coBroking = tx.coBrokingData;
	const isSecondary = (tx.marketType ?? "").toLowerCase() === "secondary";
	const isRental = isRentalTransactionType(tx.transactionType);
	const marketLabel = isSecondary
		? "Secondary"
		: (tx.marketType ?? "").toLowerCase() === "primary"
			? "Primary"
			: tx.marketType;
	const typeLabel = isRental
		? "Rental"
		: isSecondary
			? "Subsale"
			: tx.transactionType === "sale"
				? "New Project"
				: tx.transactionType;

	const generateForm = trpc.transactions.generateLetterheadForm.useMutation({
		onSuccess: (result) => {
			const blob = new Blob([result.html], { type: "text/html;charset=utf-8" });
			const url = URL.createObjectURL(blob);
			window.open(url, "_blank", "noopener,noreferrer");
			const a = document.createElement("a");
			a.href = url;
			a.download = result.fileName;
			a.click();
			setTimeout(() => URL.revokeObjectURL(url), 60_000);
			toast.success("eForm opened — use Print → Save as PDF");
		},
		onError: (e) => toast.error(e.message || "Failed to generate eForm"),
	});

	const openEform = (formType: EformKind) => {
		generateForm.mutate({ id: tx.id, formType });
	};

	const landlords: Party[] = isRental
		? [
				{
					name: client?.name,
					icNo: client?.icNo,
					email: client?.email,
					phone: client?.phone,
					address: client?.address,
				},
				...(client?.additionalPurchasers ?? []),
			].filter((p) => p.name?.trim())
		: [];
	const tenants: Party[] = isRental
		? (client?.vendors ?? []).filter((p) => p.name?.trim())
		: [];
	const purchasers: Party[] = !isRental
		? [
				{
					name: client?.name,
					icNo: client?.icNo,
					email: client?.email,
					phone: client?.phone,
					address: client?.address,
				},
				...(client?.additionalPurchasers ?? []),
			].filter((p) => p.name?.trim())
		: [];
	const vendors: Party[] = !isRental
		? (client?.vendors ?? []).filter((p) => p.name?.trim())
		: [];

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
				{marketLabel ? (
					<Badge variant="outline" className="capitalize">
						{marketLabel} market
					</Badge>
				) : null}
				{typeLabel ? (
					<Badge variant="outline" className="capitalize">
						{typeLabel}
					</Badge>
				) : null}
				{isSecondary ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								type="button"
								size="sm"
								variant="outline"
								className="ml-auto gap-1.5"
								disabled={generateForm.isPending}
							>
								{generateForm.isPending ? (
									<Loader2 className="size-3.5 animate-spin" />
								) : (
									<FileText className="size-3.5" />
								)}
								Generate eForm
								<ChevronDown className="size-3.5 opacity-70" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem
								onClick={() => openEform("letter_of_appointment")}
							>
								Letter Of Appointment
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => openEform("letter_of_offer")}>
								Letter Of Offer
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
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
					{isSecondary ? (
						<>
							<DetailRow label="Market" value={marketLabel} />
							<DetailRow label="Type" value={typeLabel} />
							<div className="sm:col-span-2">
								<DetailRow label="Address" value={prop?.address} />
							</div>
							<DetailRow label="Property Type" value={prop?.propertyType} />
							{isRental ? (
								<>
									<DetailRow
										label="Monthly Rental"
										value={
											prop?.price != null ? formatRm(prop.price) : undefined
										}
									/>
									<DetailRow
										label="Earnest Deposit"
										value={
											prop?.earnestDeposit != null
												? formatRm(prop.earnestDeposit)
												: undefined
										}
									/>
									<DetailRow
										label="Offer Date"
										value={formatTransactionDate(prop?.offerDate)}
									/>
									<DetailRow
										label="Submit Date"
										value={formatTransactionDate(prop?.submitDate)}
									/>
									<DetailRow
										label="Rent From"
										value={formatTransactionDate(prop?.rentFrom)}
									/>
									<DetailRow
										label="Rent To"
										value={formatTransactionDate(prop?.rentTo)}
									/>
									<DetailRow
										label="Rent Period"
										value={prop?.rentPeriod}
									/>
									<DetailRow
										label="Renew Option"
										value={
											prop?.renewOptionYears != null
												? `${prop.renewOptionYears} year${
														prop.renewOptionYears === 1 ? "" : "s"
													}`
												: undefined
										}
									/>
								</>
							) : (
								<>
									<DetailRow
										label="SPA Price"
										value={spa !== undefined ? formatRm(spa) : undefined}
									/>
									<DetailRow
										label="Net Price"
										value={nett !== undefined ? formatRm(nett) : undefined}
									/>
									<DetailRow
										label="Earnest Deposit"
										value={
											prop?.earnestDeposit != null
												? formatRm(prop.earnestDeposit)
												: undefined
										}
									/>
									<DetailRow
										label="Booking Date"
										value={formatTransactionDate(
											tx.bookingDate ?? tx.transactionDate,
										)}
									/>
									<DetailRow
										label="Purchasing Method"
										value={
											prop?.purchasingMethod
												? prop.purchasingMethod === "cash"
													? "Cash"
													: prop.purchasingMethod === "loan"
														? "Loan"
														: prop.purchasingMethod
												: undefined
										}
									/>
								</>
							)}
						</>
					) : (
						<>
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
						</>
					)}
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

			{isSecondary ? (
				isRental ? (
					<Section title="Parties">
						<div className="space-y-4">
							{(landlords.length ? landlords : [null]).map((party, i) => (
								<PartyCard
									key={`landlord-${i}`}
									title={
										landlords.length > 1 ? `Landlord ${i + 1}` : "Landlord"
									}
									party={party}
								/>
							))}
							{(tenants.length ? tenants : [null]).map((party, i) => (
								<PartyCard
									key={`tenant-${i}`}
									title={tenants.length > 1 ? `Tenant ${i + 1}` : "Tenant"}
									party={party}
								/>
							))}
						</div>
					</Section>
				) : (
					<Section title="Parties">
						<div className="space-y-4">
							{(purchasers.length ? purchasers : [null]).map((party, i) => (
								<PartyCard
									key={`purchaser-${i}`}
									title={
										purchasers.length > 1
											? `Purchaser ${i + 1}`
											: "Purchaser"
									}
									party={party}
								/>
							))}
							{(vendors.length ? vendors : [null]).map((party, i) => (
								<PartyCard
									key={`vendor-${i}`}
									title={vendors.length > 1 ? `Vendor ${i + 1}` : "Vendor"}
									party={party}
								/>
							))}
						</div>
					</Section>
				)
			) : (
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
			)}

			{!isSecondary ? (
				<>
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
									<DetailRow
										label="Co-broker name"
										value={coBroking.agentName}
									/>
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
												? tx.viewerRole === "co_broker"
													? `Your share ${coBroking.commissionSplit}% / Case owner ${100 - coBroking.commissionSplit}%`
													: `Co-broker ${coBroking.commissionSplit}% / You ${100 - coBroking.commissionSplit}%`
												: undefined
										}
									/>
								</div>
							) : null}
						</div>
					</Section>
				</>
			) : null}

			<Separator />

			<Section title="Commission">
				<div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
					<DetailRow label="Commission type" value={tx.commissionType} />
					{!isSecondary || !isRental ? (
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
					) : null}
					<DetailRow
						label="Total commission"
						value={
							tx.commissionAmount != null
								? formatRm(tx.commissionAmount)
								: undefined
						}
					/>
					{isSecondary ? (
						<>
							<DetailRow
								label="SST Percent"
								value={
									prop?.sstPercent != null ? `${prop.sstPercent}%` : undefined
								}
							/>
							<DetailRow
								label="SST Pay By"
								value={formatSstPayBy(prop?.sstPayBy)}
							/>
							{isRental && prop?.renewOptionYears != null ? (
								<DetailRow
									label="Renew Option"
									value={`${prop.renewOptionYears} year${
										prop.renewOptionYears === 1 ? "" : "s"
									}`}
								/>
							) : null}
						</>
					) : null}
					{tx.myCommissionAmount != null ? (
						<DetailRow
							label={
								tx.viewerRole === "co_broker"
									? "Your co-broker share"
									: "Your commission"
							}
							value={formatRm(tx.myCommissionAmount)}
						/>
					) : null}
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
							allowUpload={allowDocumentUpload}
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
