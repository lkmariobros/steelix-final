"use client";

import { format } from "date-fns";
import { useState } from "react";
import {
	ArrowLeft,
	Building,
	Calculator,
	Calendar,
	CheckCircle,
	Edit2,
	FileText,
	MapPin,
	Send,
	User,
} from "lucide-react";

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
// Issue #7 Fix: Import validation summary dialog
import { ValidationSummaryDialog, type ValidationError } from "@/components/validation-summary-dialog";

import {
	type CompleteTransactionData,
	type FormStep,
	type RepresentationType,
	clientSourceOptions,
	clientTypeOptions,
	commissionTypeOptions,
	marketTypeOptions,
	propertyTypeOptions,
	representationTypeOptions,
	transactionTypeOptions,
} from "../transaction-schema";

// Issue #2 Fix: Updated props to include onEditStep callback
interface StepReviewProps {
	data: Partial<CompleteTransactionData>;
	onSubmit: () => void;
	onPrevious: () => void;
	onEditStep?: (step: FormStep) => void; // Issue #2: Navigate to specific step for editing
	isLoading: boolean;
}

export function StepReview({
	data,
	onSubmit,
	onPrevious,
	onEditStep,
	isLoading,
}: StepReviewProps) {
	// Issue #7 Fix: Validation dialog state
	const [showValidationDialog, setShowValidationDialog] = useState(false);
	const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

	// Helper function to get option label
	const getOptionLabel = (
		options: readonly { value: string; label: string }[],
		value: string | undefined,
	) => {
		return options.find((opt) => opt.value === value)?.label || value;
	};

	// Issue #2 Fix: Helper to get representation type label
	const getRepresentationLabel = (type: RepresentationType | undefined) => {
		return representationTypeOptions.find((opt) => opt.value === type)?.label || type || "Own Client";
	};

	// Issue #7 Fix: Validate all form data before submission
	const validateFormData = (): ValidationError[] => {
		const errors: ValidationError[] = [];

		// Step 1: Transaction Details
		if (!data.marketType) {
			errors.push({ step: 1, stepTitle: "Transaction Details", field: "Market Type", message: "Please select a market type", severity: "error" });
		}
		if (!data.transactionType) {
			errors.push({ step: 1, stepTitle: "Transaction Details", field: "Transaction Type", message: "Please select a transaction type", severity: "error" });
		}
		if (!data.transactionDate) {
			errors.push({ step: 1, stepTitle: "Transaction Details", field: "Transaction Date", message: "Please select a transaction date", severity: "error" });
		}

		// Step 2: Property Details
		if (!data.propertyData?.address) {
			errors.push({ step: 2, stepTitle: "Property Details", field: "Address", message: "Property address is required", severity: "error" });
		}
		if (!data.propertyData?.price || data.propertyData.price <= 0) {
			errors.push({ step: 2, stepTitle: "Property Details", field: "Price", message: "Property price must be greater than 0", severity: "error" });
		}
		if (!data.propertyData?.propertyType) {
			errors.push({ step: 2, stepTitle: "Property Details", field: "Property Type", message: "Please select a property type", severity: "error" });
		}

		// Step 3: Client Information
		if (!data.clientData?.name) {
			errors.push({ step: 3, stepTitle: "Client Information", field: "Client Name", message: "Client name is required", severity: "error" });
		}
		if (!data.clientData?.email) {
			errors.push({ step: 3, stepTitle: "Client Information", field: "Email", message: "Client email is required", severity: "error" });
		}
		if (!data.clientData?.phone) {
			errors.push({ step: 3, stepTitle: "Client Information", field: "Phone", message: "Client phone is required", severity: "error" });
		}

		// Step 5: Commission
		if (!data.commissionValue || data.commissionValue <= 0) {
			errors.push({ step: 5, stepTitle: "Commission", field: "Commission Value", message: "Commission value must be greater than 0", severity: "error" });
		}

		// Warnings (non-blocking)
		if (!data.notes) {
			errors.push({ step: 6, stepTitle: "Documents & Notes", field: "Notes", message: "Consider adding notes for this transaction", severity: "warning" });
		}

		return errors;
	};

	// Issue #7 Fix: Handle submit with validation
	const handleSubmitWithValidation = () => {
		const errors = validateFormData();
		const criticalErrors = errors.filter(e => e.severity === "error");

		if (criticalErrors.length > 0) {
			setValidationErrors(errors);
			setShowValidationDialog(true);
			return;
		}

		// No critical errors, proceed with submission
		onSubmit();
	};

	// Issue #2 Fix: Section header with edit button
	const SectionHeader = ({
		icon: Icon,
		title,
		step
	}: {
		icon: React.ComponentType<{ className?: string }>;
		title: string;
		step: FormStep;
	}) => (
		<div className="flex items-center justify-between">
			<h3 className="flex items-center gap-2 font-medium text-lg">
				<Icon className="h-5 w-5" />
				{title}
			</h3>
			{onEditStep && (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => onEditStep(step)}
					className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
				>
					<Edit2 className="h-4 w-4" />
					Edit
				</Button>
			)}
		</div>
	);

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Review & Submit</CardTitle>
					<CardDescription>
						Please review all the information below before submitting your
						transaction. Click "Edit" on any section to make changes.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* Transaction Initiation */}
					<div className="space-y-3">
						<SectionHeader icon={Calendar} title="Transaction Details" step={1} />
						<div className="grid grid-cols-1 gap-4 rounded-lg bg-muted/50 p-4 md:grid-cols-3">
							<div>
								<p className="text-muted-foreground text-sm">Market Type</p>
								<p className="font-medium">
									{getOptionLabel(marketTypeOptions, data.marketType)}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground text-sm">
									Transaction Type
								</p>
								<p className="font-medium">
									{getOptionLabel(transactionTypeOptions, data.transactionType)}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground text-sm">
									Transaction Date
								</p>
								<p className="font-medium">
									{data.transactionDate
										? format(data.transactionDate, "PPP")
										: "Not set"}
								</p>
							</div>
						</div>
					</div>

					<Separator />

					{/* Property Information */}
					<div className="space-y-3">
						<SectionHeader icon={MapPin} title="Property Information" step={2} />
						<div className="space-y-3 rounded-lg bg-muted/50 p-4">
							<div>
								<p className="text-muted-foreground text-sm">Address</p>
								<p className="font-medium">
									{data.propertyData?.address || "Not provided"}
								</p>
							</div>
							<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
								<div>
									<p className="text-muted-foreground text-sm">Property Type</p>
									<p className="font-medium">
										{getOptionLabel(
											propertyTypeOptions,
											data.propertyData?.propertyType,
										)}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground text-sm">Price</p>
									<p className="font-medium text-lg">
										${data.propertyData?.price?.toLocaleString() || "0"}
									</p>
								</div>
							</div>
							{(data.propertyData?.bedrooms ||
								data.propertyData?.bathrooms ||
								data.propertyData?.area) && (
								<div>
									<p className="text-muted-foreground text-sm">
										Specifications
									</p>
									<p className="font-medium">
										{[
											data.propertyData?.bedrooms &&
												`${data.propertyData.bedrooms} bed`,
											data.propertyData?.bathrooms &&
												`${data.propertyData.bathrooms} bath`,
											data.propertyData?.area &&
												`${data.propertyData.area} sq ft`,
										]
											.filter(Boolean)
											.join(", ")}
									</p>
								</div>
							)}
						</div>
					</div>

					<Separator />

					{/* Client Information */}
					<div className="space-y-3">
						<SectionHeader icon={User} title="Client Information" step={3} />
						<div className="space-y-3 rounded-lg bg-muted/50 p-4">
							<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
								<div>
									<p className="text-muted-foreground text-sm">Name</p>
									<p className="font-medium">
										{data.clientData?.name || "Not provided"}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground text-sm">Type</p>
									<p className="font-medium">
										{getOptionLabel(clientTypeOptions, data.clientData?.type)}
									</p>
								</div>
							</div>
							<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
								<div>
									<p className="text-muted-foreground text-sm">Email</p>
									<p className="font-medium">
										{data.clientData?.email || "Not provided"}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground text-sm">Phone</p>
									<p className="font-medium">
										{data.clientData?.phone || "Not provided"}
									</p>
								</div>
							</div>
							<div>
								<p className="text-muted-foreground text-sm">Source</p>
								<p className="font-medium">
									{getOptionLabel(clientSourceOptions, data.clientData?.source)}
								</p>
							</div>
						</div>
					</div>

					<Separator />

					{/* Representation & Co-Broking Information - Issue #1 Fix */}
					<div className="space-y-3">
						<SectionHeader icon={Building} title="Representation & Co-Broking" step={4} />
						<div className="rounded-lg bg-muted/50 p-4">
							{/* Issue #1 Fix: Show unified representation type */}
							<div className="mb-3">
								<p className="text-muted-foreground text-sm">Representation Type</p>
								<Badge variant="secondary" className="mt-1">
									{getRepresentationLabel(data.representationType)}
								</Badge>
							</div>

							{data.representationType === "co_broking" ? (
								<div className="space-y-3 border-t pt-3">
									<p className="text-sm font-medium">Co-Broker Details</p>
									<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
										<div>
											<p className="text-muted-foreground text-sm">Agent Name</p>
											<p className="font-medium">
												{data.coBrokingData?.agentName || "Not provided"}
											</p>
										</div>
										<div>
											<p className="text-muted-foreground text-sm">Agency</p>
											<p className="font-medium">
												{data.coBrokingData?.agencyName || "Not provided"}
											</p>
										</div>
									</div>
									<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
										<div>
											<p className="text-muted-foreground text-sm">Phone</p>
											<p className="font-medium">
												{data.coBrokingData?.agentPhone || "Not provided"}
											</p>
										</div>
										<div>
											<p className="text-muted-foreground text-sm">Email</p>
											<p className="font-medium">
												{data.coBrokingData?.agentEmail || "Not provided"}
											</p>
										</div>
									</div>
									<div>
										<p className="text-muted-foreground text-sm">Commission Split</p>
										<p className="font-medium">
											Your share: {100 - (data.coBrokingData?.commissionSplit || 50)}% /
											Co-broker: {data.coBrokingData?.commissionSplit || 50}%
										</p>
									</div>
								</div>
							) : (
								<div className="border-t pt-3 text-center text-muted-foreground">
									<p className="text-sm">
										Direct representation - you receive your full agent share of the commission.
									</p>
								</div>
							)}
						</div>
					</div>

					<Separator />

					{/* Commission Information */}
					<div className="space-y-3">
						<SectionHeader icon={Calculator} title="Commission" step={5} />
						<div className="rounded-lg border border-green-200 bg-green-50 p-4">
							<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
								<div>
									<p className="text-muted-foreground text-sm">Type</p>
									<p className="font-medium">
										{getOptionLabel(commissionTypeOptions, data.commissionType)}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground text-sm">Rate/Amount</p>
									<p className="font-medium">
										{data.commissionType === "percentage"
											? `${data.commissionValue}%`
											: `$${data.commissionValue?.toLocaleString()}`}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground text-sm">
										Total Commission
									</p>
									<p className="font-bold text-green-700 text-lg">
										${data.commissionAmount?.toLocaleString() || "0"}
									</p>
								</div>
							</div>
						</div>
					</div>

					<Separator />

					{/* Documents & Notes */}
					<div className="space-y-3">
						<SectionHeader icon={FileText} title="Documents & Notes" step={6} />
						<div className="space-y-3 rounded-lg bg-muted/50 p-4">
							<div>
								<p className="text-muted-foreground text-sm">Documents</p>
								<p className="font-medium">
									{data.documents?.length || 0} file
									{(data.documents?.length || 0) !== 1 ? "s" : ""} uploaded
								</p>
								{data.documents && data.documents.length > 0 && (
									<div className="mt-2 space-y-1">
										{data.documents.map((doc: { id: string; name: string }) => (
											<Badge key={doc.id} variant="outline" className="mr-2">
												{doc.name}
											</Badge>
										))}
									</div>
								)}
							</div>
							{data.notes && (
								<div>
									<p className="text-muted-foreground text-sm">
										Additional Notes
									</p>
									<p className="rounded border bg-white p-3 font-medium text-sm">
										{data.notes}
									</p>
								</div>
							)}
						</div>
					</div>

					{/* Submission Notice */}
					<Card className="border-blue-200 bg-blue-50">
						<CardContent className="pt-6">
							<div className="flex items-start gap-3">
								<CheckCircle className="mt-0.5 h-5 w-5 text-blue-600" />
								<div className="text-blue-800">
									<p className="font-medium">Ready to Submit</p>
									<p className="text-sm">
										By submitting this transaction, you confirm that all
										information provided is accurate and complete. The
										transaction will be sent for administrative review and
										approval.
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Navigation */}
					<div className="flex justify-between pt-4">
						<Button
							type="button"
							variant="outline"
							onClick={onPrevious}
							className="flex items-center gap-2"
							disabled={isLoading}
						>
							<ArrowLeft className="h-4 w-4" />
							Back to Documents
						</Button>
						{/* Issue #7 Fix: Use validation before submit */}
						<Button
							onClick={handleSubmitWithValidation}
							className="flex items-center gap-2"
							disabled={isLoading}
							size="lg"
						>
							{isLoading ? (
								<>
									<div className="h-4 w-4 animate-spin rounded-full border-white border-b-2" />
									Submitting...
								</>
							) : (
								<>
									<Send className="h-4 w-4" />
									Submit Transaction
								</>
							)}
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Issue #7 Fix: Validation Summary Dialog */}
			<ValidationSummaryDialog
				open={showValidationDialog}
				onOpenChange={setShowValidationDialog}
				errors={validationErrors}
				onNavigateToStep={(step) => onEditStep?.(step as FormStep)}
			/>
		</div>
	);
}
