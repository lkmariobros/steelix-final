"use client";

import { format } from "date-fns";
import {
	ArrowLeft,
	Building,
	Calculator,
	Calendar,
	CheckCircle,
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

import {
	type CompleteTransactionData,
	clientSourceOptions,
	clientTypeOptions,
	commissionTypeOptions,
	marketTypeOptions,
	propertyTypeOptions,
	transactionTypeOptions,
} from "../transaction-schema";

interface StepReviewProps {
	data: Partial<CompleteTransactionData>;
	onSubmit: () => void;
	onPrevious: () => void;
	isLoading: boolean;
}

export function StepReview({
	data,
	onSubmit,
	onPrevious,
	isLoading,
}: StepReviewProps) {
	// Helper function to get option label
	const getOptionLabel = (
		options: readonly { value: string; label: string }[],
		value: string | undefined,
	) => {
		return options.find((opt) => opt.value === value)?.label || value;
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Review & Submit</CardTitle>
					<CardDescription>
						Please review all the information below before submitting your
						transaction
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* Transaction Initiation */}
					<div className="space-y-3">
						<h3 className="flex items-center gap-2 font-medium text-lg">
							<Calendar className="h-5 w-5" />
							Transaction Details
						</h3>
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
						<h3 className="flex items-center gap-2 font-medium text-lg">
							<MapPin className="h-5 w-5" />
							Property Information
						</h3>
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
						<h3 className="flex items-center gap-2 font-medium text-lg">
							<User className="h-5 w-5" />
							Client Information
						</h3>
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

					{/* Co-Broking Information */}
					<div className="space-y-3">
						<h3 className="flex items-center gap-2 font-medium text-lg">
							<Building className="h-5 w-5" />
							Co-Broking
						</h3>
						<div className="rounded-lg bg-muted/50 p-4">
							{data.isCoBroking ? (
								<div className="space-y-3">
									<Badge variant="secondary">Co-Broking Enabled</Badge>
									<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
										<div>
											<p className="text-muted-foreground text-sm">
												Agent Name
											</p>
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
											<p className="text-muted-foreground text-sm">
												Commission Split
											</p>
											<p className="font-medium">
												{data.coBrokingData?.commissionSplit}% /{" "}
												{100 - (data.coBrokingData?.commissionSplit || 0)}%
											</p>
										</div>
										<div>
											<p className="text-muted-foreground text-sm">Contact</p>
											<p className="font-medium">
												{data.coBrokingData?.contactInfo || "Not provided"}
											</p>
										</div>
									</div>
								</div>
							) : (
								<div className="text-center text-muted-foreground">
									<Badge variant="outline">No Co-Broking</Badge>
									<p className="mt-2 text-sm">
										This transaction does not involve co-broking
									</p>
								</div>
							)}
						</div>
					</div>

					<Separator />

					{/* Commission Information */}
					<div className="space-y-3">
						<h3 className="flex items-center gap-2 font-medium text-lg">
							<Calculator className="h-5 w-5" />
							Commission
						</h3>
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
						<h3 className="flex items-center gap-2 font-medium text-lg">
							<FileText className="h-5 w-5" />
							Documents & Notes
						</h3>
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
						<Button
							onClick={onSubmit}
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
		</div>
	);
}
