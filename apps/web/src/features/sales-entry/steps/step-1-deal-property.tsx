"use client";

import { useCallback } from "react";
import { toast } from "sonner";

import {
	type CompleteTransactionData,
	type InitiationData,
	type PropertyData,
	initiationSchema,
} from "../transaction-schema";
import { StepInitiation } from "./step-1-initiation";
import { StepProperty } from "./step-2-property";

interface StepDealAndPropertyProps {
	formData: Partial<CompleteTransactionData>;
	onUpdateInitiation: (data: InitiationData) => void;
	onUpdateProperty: (data: PropertyData) => void;
	onNext: () => void;
	onPrevious: () => void;
}

export function StepDealAndProperty({
	formData,
	onUpdateInitiation,
	onUpdateProperty,
	onNext,
	onPrevious,
}: StepDealAndPropertyProps) {
	const validateInitiation = useCallback(() => {
		const result = initiationSchema.safeParse({
			marketType: formData.marketType,
			transactionType: formData.transactionType,
			transactionDate: formData.transactionDate,
		});
		if (!result.success) {
			toast.error(
				result.error.errors[0]?.message ??
					"Please complete the transaction details above",
			);
			return false;
		}
		return true;
	}, [formData.marketType, formData.transactionDate, formData.transactionType]);

	return (
		<div className="space-y-8">
			<StepInitiation
				data={formData}
				onUpdate={onUpdateInitiation}
				onNext={() => {}}
				hideNavigation
			/>
			<StepProperty
				data={formData.propertyData}
				listingTypeFilter="all"
				onUpdate={onUpdateProperty}
				onNext={onNext}
				onPrevious={onPrevious}
				hidePrevious
				beforeNext={validateInitiation}
				nextLabel="Continue to Client & Representation"
			/>
		</div>
	);
}
