"use client";

import { format } from "date-fns";
import {
	ArrowLeft,
	Building,
	Calendar,
	CheckCircle,
	Edit2,
	FileText,
	Send,
	User,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
	type ValidationError,
	ValidationSummaryDialog,
} from "@/components/validation-summary-dialog";

import {
	type CompleteTransactionData,
	type FormStep,
	detailsStepSchema,
	purchasingMethodOptions,
	representationTypeOptions,
	sstPayByOptions,
	stepConfig,
} from "../transaction-schema";
import { isRentalTransactionType } from "@/features/transactions/payment-method-utils";
import { loadTempTransactionDocuments } from "@/hooks/use-document-upload";

function resolveTransactionDocuments(
	formDocs: CompleteTransactionData["documents"] | undefined,
) {
	if (formDocs && formDocs.length > 0) return formDocs;
	return loadTempTransactionDocuments().map((d) => ({
		id: d.id,
		name: d.name,
		type: d.type,
		url: d.url,
		uploadedAt: d.uploadedAt,
		category: d.category,
	}));
}

interface StepVerifyProps {
	data: Partial<CompleteTransactionData>;
	onSubmit: () => void;
	onPrevious: () => void;
	onEditStep?: (step: FormStep) => void;
	isLoading: boolean;
}

export function StepVerify({
	data,
	onSubmit,
	onPrevious,
	onEditStep,
	isLoading,
}: StepVerifyProps) {
	const [showValidationDialog, setShowValidationDialog] = useState(false);
	const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
		[],
	);

	const getRepLabel = () =>
		representationTypeOptions.find((o) => o.value === data.representationType)
			?.label ?? "Direct";

	const getPurchasingLabel = () => {
		if (
			data.marketType === "secondary" ||
			isRentalTransactionType(data.transactionType)
		) {
			const sst = data.propertyData?.sstPayBy;
			if (sst === "client") return "Client";
			return (
				sstPayByOptions.find((o) => o.value === sst)?.label ?? "—"
			);
		}
		return (
			purchasingMethodOptions.find(
				(o) => o.value === data.propertyData?.purchasingMethod,
			)?.label ?? "—"
		);
	};

	const validate = (): ValidationError[] => {
		const errors: ValidationError[] = [];
		const result = detailsStepSchema.safeParse({
			marketType: data.marketType ?? "primary",
			transactionType: data.transactionType ?? "sale",
			projectName: data.projectName,
			unitNo: data.unitNo,
			blockListingId: data.blockListingId,
			bookingDate: data.bookingDate ?? data.transactionDate,
			propertyData: data.propertyData,
			clientData: data.clientData,
			representationType: data.representationType ?? "direct",
			coBrokingData: data.coBrokingData,
			commissionType: data.commissionType,
			commissionValue: data.commissionValue,
			commissionAmount: data.commissionAmount,
			agentId: data.agentId,
		});
		if (!result.success) {
			for (const issue of result.error.issues) {
				errors.push({
					step: 1,
					stepTitle: stepConfig[0].title,
					field: issue.path.join("."),
					message: issue.message,
					severity: "error",
				});
			}
		}
		const docs = resolveTransactionDocuments(data.documents);
		if (data.marketType === "primary") {
			const hasIc = docs.some(
				(d) => d.category === "ic_passport" || d.category === "identification",
			);
			if (!hasIc) {
				errors.push({
					step: 2,
					stepTitle: stepConfig[1].title,
					field: "IC / Passport",
					message: "Upload purchaser IC or passport before submitting",
					severity: "error",
				});
			}
		} else if (docs.length === 0) {
			errors.push({
				step: 2,
				stepTitle: stepConfig[1].title,
				field: "documents",
				message: "Upload at least one supporting document before submitting",
				severity: "error",
			});
		}
		return errors;
	};

	const handleSubmitClick = () => {
		const errors = validate();
		if (errors.length > 0) {
			setValidationErrors(errors);
			setShowValidationDialog(true);
			return;
		}
		onSubmit();
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Verify & Submit</CardTitle>
					<CardDescription>
						Review all details before submitting to admin for verification.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<section>
						<div className="mb-3 flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Building className="h-4 w-4" />
								<h3 className="font-medium">Property</h3>
							</div>
							{onEditStep && (
								<Button variant="ghost" size="sm" onClick={() => onEditStep(1)}>
									<Edit2 className="mr-1 h-3 w-3" /> Edit
								</Button>
							)}
						</div>
						<dl className="grid gap-2 text-sm md:grid-cols-2">
							<div>
								<dt className="text-muted-foreground">Market</dt>
								<dd className="capitalize">{data.marketType ?? "primary"}</dd>
							</div>
							{data.marketType === "secondary" ? null : (
								<>
									<div>
										<dt className="text-muted-foreground">Project</dt>
										<dd>{data.projectName || "—"}</dd>
									</div>
									<div>
										<dt className="text-muted-foreground">Unit</dt>
										<dd>{data.unitNo || "—"}</dd>
									</div>
								</>
							)}
							{data.marketType === "secondary" ? (
								<>
									<div>
										<dt className="text-muted-foreground">Type</dt>
										<dd>
											{isRentalTransactionType(data.transactionType)
												? "Rental"
												: "Subsale"}
										</dd>
									</div>
									<div className="md:col-span-2">
										<dt className="text-muted-foreground">Address</dt>
										<dd>{data.propertyData?.address || "—"}</dd>
									</div>
									<div>
										<dt className="text-muted-foreground">Property Type</dt>
										<dd>{data.propertyData?.propertyType || "—"}</dd>
									</div>
									{!isRentalTransactionType(data.transactionType) ? (
										<>
											<div>
												<dt className="text-muted-foreground">SPA Price</dt>
												<dd>
													{data.propertyData?.spaPrice != null
														? `RM ${data.propertyData.spaPrice.toLocaleString()}`
														: "—"}
												</dd>
											</div>
											<div>
												<dt className="text-muted-foreground">Net Price</dt>
												<dd>
													{data.propertyData?.nettPrice != null
														? `RM ${data.propertyData.nettPrice.toLocaleString()}`
														: "—"}
												</dd>
											</div>
											<div>
												<dt className="text-muted-foreground">
													Earnest Deposit
												</dt>
												<dd>
													{data.propertyData?.earnestDeposit != null
														? `RM ${data.propertyData.earnestDeposit.toLocaleString()}`
														: "—"}
												</dd>
											</div>
											<div>
												<dt className="text-muted-foreground">
													Commission Percent
												</dt>
												<dd>{data.commissionValue ?? "—"}%</dd>
											</div>
											<div>
												<dt className="text-muted-foreground">
													Commission Amount
												</dt>
												<dd>
													{data.commissionAmount != null
														? `RM ${data.commissionAmount.toLocaleString()}`
														: "—"}
												</dd>
											</div>
										</>
									) : (
										<>
											<div>
												<dt className="text-muted-foreground">Offer Date</dt>
												<dd>{data.propertyData?.offerDate || "—"}</dd>
											</div>
											<div>
												<dt className="text-muted-foreground">Submit Date</dt>
												<dd>{data.propertyData?.submitDate || "—"}</dd>
											</div>
											<div>
												<dt className="text-muted-foreground">Rent From</dt>
												<dd>{data.propertyData?.rentFrom || "—"}</dd>
											</div>
											<div>
												<dt className="text-muted-foreground">Rent To</dt>
												<dd>{data.propertyData?.rentTo || "—"}</dd>
											</div>
											<div>
												<dt className="text-muted-foreground">Rent Period</dt>
												<dd>{data.propertyData?.rentPeriod || "—"}</dd>
											</div>
											<div>
												<dt className="text-muted-foreground">
													Monthly Rental
												</dt>
												<dd>
													{data.propertyData?.price
														? `RM ${data.propertyData.price.toLocaleString()}`
														: "—"}
												</dd>
											</div>
											<div>
												<dt className="text-muted-foreground">
													Case Commission
												</dt>
												<dd>
													{data.commissionAmount != null
														? `RM ${data.commissionAmount.toLocaleString()}`
														: "—"}
												</dd>
											</div>
											<div>
												<dt className="text-muted-foreground">
													Earnest Deposit
												</dt>
												<dd>
													{data.propertyData?.earnestDeposit != null
														? `RM ${data.propertyData.earnestDeposit.toLocaleString()}`
														: "—"}
												</dd>
											</div>
										</>
									)}
									<div>
										<dt className="text-muted-foreground">SST Percent</dt>
										<dd>{data.propertyData?.sstPercent ?? "—"}%</dd>
									</div>
								</>
							) : (
								<div>
									<dt className="text-muted-foreground">Price</dt>
									<dd>
										{data.propertyData?.price
											? `RM ${data.propertyData.price.toLocaleString()}`
											: "—"}
									</dd>
								</div>
							)}
							{data.marketType !== "secondary" ? (
								<>
									<div>
										<dt className="text-muted-foreground">Sales Package</dt>
										<dd>{data.propertyData?.salesPackage || "—"}</dd>
									</div>
									<div>
										<dt className="text-muted-foreground">Rebate</dt>
										<dd>
											{data.propertyData?.rebateAmount != null
												? `RM ${data.propertyData.rebateAmount.toLocaleString()}`
												: "—"}
										</dd>
									</div>
									<div>
										<dt className="text-muted-foreground">Net Price</dt>
										<dd>
											{(() => {
												const price = data.propertyData?.price ?? 0;
												const rebate = data.propertyData?.rebateAmount ?? 0;
												const net =
													data.propertyData?.nettPrice ??
													Math.max(0, price - rebate);
												return price
													? `RM ${net.toLocaleString()}`
													: "—";
											})()}
										</dd>
									</div>
								</>
							) : null}
							<div>
								<dt className="text-muted-foreground">Booking Date</dt>
								<dd className="flex items-center gap-1">
									<Calendar className="h-3 w-3" />
									{data.bookingDate
										? format(data.bookingDate, "dd MMM yyyy")
										: "—"}
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">
									{data.marketType === "secondary" ||
									isRentalTransactionType(data.transactionType)
										? "SST Pay By"
										: "Purchasing Method"}
								</dt>
								<dd>{getPurchasingLabel()}</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Representation</dt>
								<dd>{getRepLabel()}</dd>
							</div>
						</dl>
					</section>

					<Separator />

					<section>
						<div className="mb-3 flex items-center gap-2">
							<User className="h-4 w-4" />
							<h3 className="font-medium">
								{isRentalTransactionType(data.transactionType)
									? "Landlord"
									: "Purchaser"}
							</h3>
						</div>
						<dl className="grid gap-2 text-sm md:grid-cols-2">
							<div>
								<dt className="text-muted-foreground">Name</dt>
								<dd>{data.clientData?.name || "—"}</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">IC / Passport</dt>
								<dd>{data.clientData?.icNo || "—"}</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Phone</dt>
								<dd>{data.clientData?.phone || "—"}</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Email</dt>
								<dd>{data.clientData?.email || "—"}</dd>
							</div>
							<div className="md:col-span-2">
								<dt className="text-muted-foreground">Address</dt>
								<dd>{data.clientData?.address || "—"}</dd>
							</div>
						</dl>
					</section>

					{(data.clientData?.additionalPurchasers?.length ?? 0) > 0 ? (
						<section>
							<div className="mb-3 flex items-center gap-2">
								<User className="h-4 w-4" />
								<h3 className="font-medium">
									{isRentalTransactionType(data.transactionType)
										? "Additional Landlords"
										: "Additional Purchasers"}
								</h3>
							</div>
							{data.clientData?.additionalPurchasers?.map((p, i) => (
								<dl
									key={`ap-${i}`}
									className="mb-3 grid gap-2 text-sm md:grid-cols-2"
								>
									<div>
										<dt className="text-muted-foreground">Name</dt>
										<dd>{p.name || "—"}</dd>
									</div>
									<div>
										<dt className="text-muted-foreground">IC / Passport</dt>
										<dd>{p.icNo || "—"}</dd>
									</div>
									<div>
										<dt className="text-muted-foreground">Phone</dt>
										<dd>{p.phone || "—"}</dd>
									</div>
								</dl>
							))}
						</section>
					) : null}

					{(data.clientData?.vendors?.length ?? 0) > 0 ? (
						<section>
							<div className="mb-3 flex items-center gap-2">
								<User className="h-4 w-4" />
								<h3 className="font-medium">
									{isRentalTransactionType(data.transactionType)
										? "Tenant"
										: "Vendor"}
								</h3>
							</div>
							{data.clientData?.vendors?.map((p, i) => (
								<dl
									key={`v-${i}`}
									className="mb-3 grid gap-2 text-sm md:grid-cols-2"
								>
									<div>
										<dt className="text-muted-foreground">Name</dt>
										<dd>{p.name || "—"}</dd>
									</div>
									<div>
										<dt className="text-muted-foreground">IC / Passport</dt>
										<dd>{p.icNo || "—"}</dd>
									</div>
									<div>
										<dt className="text-muted-foreground">Phone</dt>
										<dd>{p.phone || "—"}</dd>
									</div>
								</dl>
							))}
						</section>
					) : null}

					{data.representationType === "co_broking" && data.coBrokingData && (
						<>
							<Separator />
							<section>
								<h3 className="mb-2 font-medium">Co-broke Agent</h3>
								<p className="text-sm">
									{data.coBrokingData.agentName} ·{" "}
									{data.coBrokingData.agentPhone}
								</p>
							</section>
						</>
					)}

					<Separator />

					<section>
						<div className="mb-3 flex items-center justify-between">
							<div className="flex items-center gap-2">
								<FileText className="h-4 w-4" />
								<h3 className="font-medium">Documents</h3>
							</div>
							{onEditStep && (
								<Button variant="ghost" size="sm" onClick={() => onEditStep(2)}>
									<Edit2 className="mr-1 h-3 w-3" /> Edit
								</Button>
							)}
						</div>
						{(() => {
							const docs = resolveTransactionDocuments(data.documents);
							if (docs.length === 0) {
								return (
									<p className="text-muted-foreground text-sm">
										No documents uploaded
									</p>
								);
							}
							return (
								<ul className="space-y-2">
									{docs.map((doc) => (
										<li
											key={doc.id}
											className="flex items-center justify-between rounded border px-3 py-2 text-sm"
										>
											<span>{doc.name}</span>
											<Badge variant="secondary">
												{doc.category ?? "other"}
											</Badge>
										</li>
									))}
								</ul>
							);
						})()}
					</section>

					<div className="flex justify-between pt-4">
						<Button type="button" variant="outline" onClick={onPrevious}>
							<ArrowLeft className="mr-2 h-4 w-4" />
							Back to Upload
						</Button>
						<Button onClick={handleSubmitClick} disabled={isLoading}>
							{isLoading ? (
								"Submitting…"
							) : (
								<>
									<Send className="mr-2 h-4 w-4" />
									Submit for Verification
								</>
							)}
						</Button>
					</div>
				</CardContent>
			</Card>

			<ValidationSummaryDialog
				open={showValidationDialog}
				onOpenChange={setShowValidationDialog}
				errors={validationErrors}
				onNavigateToStep={(step) => {
					setShowValidationDialog(false);
					onEditStep?.(step as FormStep);
				}}
			/>
		</div>
	);
}
