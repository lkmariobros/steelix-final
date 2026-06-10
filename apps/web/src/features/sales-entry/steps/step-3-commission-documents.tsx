"use client";

import { useCallback } from "react";
import { toast } from "sonner";

import {
	type CommissionData,
	type CompleteTransactionData,
	type DocumentsData,
	commissionSchema,
} from "../transaction-schema";
import { StepCommission } from "./step-5-commission";
import { StepDocuments } from "./step-6-documents";

interface StepCommissionAndDocumentsProps {
	formData: Partial<CompleteTransactionData>;
	transactionId?: string;
	onUpdateCommission: (data: CommissionData) => void;
	onUpdateDocuments: (data: DocumentsData) => void;
	onNext: () => void;
	onPrevious: () => void;
}

export function StepCommissionAndDocuments({
	formData,
	transactionId,
	onUpdateCommission,
	onUpdateDocuments,
	onNext,
	onPrevious,
}: StepCommissionAndDocumentsProps) {
	const validateCommission = useCallback(() => {
		const result = commissionSchema.safeParse({
			commissionType: formData.commissionType,
			commissionValue: formData.commissionValue,
			commissionAmount: formData.commissionAmount,
			representationType: formData.representationType,
			agentTier: formData.agentTier,
			companyCommissionSplit: formData.companyCommissionSplit,
			breakdown: formData.breakdown,
		});
		if (!result.success) {
			toast.error(
				result.error.errors[0]?.message ??
					"Please complete the commission details above",
			);
			return false;
		}
		return true;
	}, [
		formData.agentTier,
		formData.breakdown,
		formData.commissionAmount,
		formData.commissionType,
		formData.commissionValue,
		formData.companyCommissionSplit,
		formData.representationType,
	]);

	return (
		<div className="space-y-8">
			<StepCommission
				data={{
					commissionType: formData.commissionType ?? "percentage",
					commissionValue: formData.commissionValue ?? 0,
					commissionAmount: formData.commissionAmount ?? 0,
					representationType: formData.representationType ?? "direct",
					agentTier: formData.agentTier,
					companyCommissionSplit: formData.companyCommissionSplit,
					breakdown: formData.breakdown,
				}}
				propertyPrice={formData.propertyData?.price || 0}
				propertyData={formData.propertyData}
				coBrokingData={formData.coBrokingData}
				onUpdate={onUpdateCommission}
				onNext={() => {}}
				onPrevious={onPrevious}
				hideNavigation
			/>
			<StepDocuments
				data={{
					documents: formData.documents,
					notes: formData.notes,
					transactionId,
				}}
				onUpdate={onUpdateDocuments}
				onNext={onNext}
				onPrevious={onPrevious}
				hidePrevious
				beforeNext={validateCommission}
				nextLabel="Continue to Review"
			/>
		</div>
	);
}
