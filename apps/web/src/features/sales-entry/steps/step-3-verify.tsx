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
		if (isRentalTransactionType(data.transactionType)) {
			return (
				sstPayByOptions.find((o) => o.value === data.propertyData?.sstPayBy)
					?.label ?? "—"
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
		const docs = data.documents ?? [];
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
							{data.marketType === "secondary" ? (
								<>
									<div className="md:col-span-2">
										<dt className="text-muted-foreground">Address</dt>
										<dd>{data.propertyData?.address || "—"}</dd>
									</div>
									<div>
										<dt className="text-muted-foreground">Commission Rate</dt>
										<dd>{data.commissionValue ?? "—"}%</dd>
									</div>
								</>
							) : (
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
							<div>
								<dt className="text-muted-foreground">Price</dt>
								<dd>
									{data.propertyData?.price
										? `RM ${data.propertyData.price.toLocaleString()}`
										: "—"}
								</dd>
							</div>
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
									{isRentalTransactionType(data.transactionType)
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
							<h3 className="font-medium">Purchaser</h3>
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
						{(data.documents?.length ?? 0) > 0 ? (
							<ul className="space-y-2">
								{data.documents!.map((doc) => (
									<li
										key={doc.id}
										className="flex items-center justify-between rounded border px-3 py-2 text-sm"
									>
										<span>{doc.name}</span>
										<Badge variant="secondary">{doc.category ?? "other"}</Badge>
									</li>
								))}
							</ul>
						) : (
							<p className="text-muted-foreground text-sm">No documents uploaded</p>
						)}
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
