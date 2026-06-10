"use client";

import { useCallback } from "react";
import { toast } from "sonner";

import {
	type ClientData,
	type CoBrokingData,
	type CompleteTransactionData,
	clientSchema,
} from "../transaction-schema";
import { StepClient } from "./step-3-client";
import { StepCoBroking } from "./step-4-co-broking";

interface StepClientAndRepresentationProps {
	formData: Partial<CompleteTransactionData>;
	onUpdateClient: (data: ClientData) => void;
	onUpdateCoBroking: (data: CoBrokingData) => void;
	onNext: () => void;
	onPrevious: () => void;
}

export function StepClientAndRepresentation({
	formData,
	onUpdateClient,
	onUpdateCoBroking,
	onNext,
	onPrevious,
}: StepClientAndRepresentationProps) {
	const validateClient = useCallback(() => {
		const result = clientSchema.safeParse(formData.clientData);
		if (!result.success) {
			toast.error(
				result.error.errors[0]?.message ??
					"Please complete the client details above",
			);
			return false;
		}
		return true;
	}, [formData.clientData]);

	return (
		<div className="space-y-8">
			<StepClient
				data={formData.clientData}
				marketType={formData.marketType}
				transactionType={formData.transactionType}
				onUpdate={onUpdateClient}
				onNext={() => {}}
				onPrevious={onPrevious}
				hideNavigation
			/>
			<StepCoBroking
				data={{
					representationType: formData.representationType ?? "direct",
					isCoBroking: formData.isCoBroking ?? false,
					coBrokingData: formData.coBrokingData,
				}}
				marketType={formData.marketType}
				onUpdate={onUpdateCoBroking}
				onNext={onNext}
				onPrevious={onPrevious}
				hidePrevious
				beforeNext={validateClient}
				nextLabel="Continue to Commission & Documents"
			/>
		</div>
	);
}
