"use client";

import type { CompleteTransactionData, DocumentsData } from "../transaction-schema";
import { StepDocuments } from "./step-6-documents";
import type { StepNavigationOptions } from "./step-nav";

interface StepUploadProps extends StepNavigationOptions {
	formData: Partial<CompleteTransactionData>;
	transactionId?: string;
	onUpdate: (data: DocumentsData) => void;
	onNext: () => void;
	onPrevious: () => void;
}

export function StepUpload({
	formData,
	transactionId,
	onUpdate,
	onNext,
	onPrevious,
}: StepUploadProps) {
	return (
		<StepDocuments
			data={{
				documents: formData.documents,
				notes: formData.notes,
				transactionId,
			}}
			onUpdate={onUpdate}
			onNext={onNext}
			onPrevious={onPrevious}
			nextLabel="Continue to Verify"
			previousLabel="Back to Details"
			useClientCategories
			marketType={formData.marketType ?? "primary"}
		/>
	);
}
