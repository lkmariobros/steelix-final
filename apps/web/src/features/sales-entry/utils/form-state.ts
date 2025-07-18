import { useCallback, useEffect, useState } from "react";
import type {
	ClientData,
	CoBrokingData,
	CompleteTransactionData,
	DocumentsData,
	FormStep,
	PropertyData,
} from "../transaction-schema";

// Local storage key for auto-save
const FORM_STORAGE_KEY = "transaction-form-draft";

// Initial form data
export const initialFormData: Partial<CompleteTransactionData> = {
	marketType: undefined,
	transactionType: undefined,
	transactionDate: undefined,
	propertyData: {
		address: "",
		propertyType: "",
		bedrooms: undefined,
		bathrooms: undefined,
		area: undefined,
		price: 0,
		description: "",
	},
	clientData: {
		name: "",
		email: "",
		phone: "",
		type: "buyer" as const,
		source: "",
		notes: "",
	},
	isCoBroking: false,
	coBrokingData: undefined,
	commissionType: "percentage" as const,
	commissionValue: 0,
	commissionAmount: 0,
	documents: [],
	notes: "",
};

// Form state hook with mode awareness
export function useTransactionFormState(transactionId?: string, mode?: "create" | "edit" | "resume") {
	const [currentStep, setCurrentStep] = useState<FormStep>(1);
	const [formData, setFormData] =
		useState<Partial<CompleteTransactionData>>(initialFormData);
	const [isLoading, setIsLoading] = useState(false);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

	// Load saved form data from localStorage on mount (only when not creating new)
	useEffect(() => {
		if (!transactionId && mode !== "create") {
			const savedData = localStorage.getItem(FORM_STORAGE_KEY);
			if (savedData) {
				try {
					const parsedData = JSON.parse(savedData);
					setFormData(parsedData);
				} catch (error) {
					console.error("Failed to parse saved form data:", error);
				}
			}
		}
	}, [transactionId, mode]);

	// Auto-save to localStorage when form data changes
	useEffect(() => {
		if (!transactionId && hasUnsavedChanges) {
			const timeoutId = setTimeout(() => {
				localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(formData));
				setHasUnsavedChanges(false);
			}, 1000); // Debounce auto-save by 1 second

			return () => clearTimeout(timeoutId);
		}
	}, [formData, hasUnsavedChanges, transactionId]);

	// Update form data
	const updateFormData = useCallback(
		(updates: Partial<CompleteTransactionData>) => {
			setFormData((prev) => ({ ...prev, ...updates }));
			setHasUnsavedChanges(true);
		},
		[],
	);

	// Update specific step data
	const updateStepData = useCallback(
		(step: FormStep, data: Record<string, unknown>) => {
			switch (step) {
				case 1:
					updateFormData({
						marketType: data.marketType as "primary" | "secondary" | undefined,
						transactionType: data.transactionType as
							| "sale"
							| "lease"
							| "rental"
							| undefined,
						transactionDate: data.transactionDate as Date | undefined,
					});
					break;
				case 2:
					updateFormData({ propertyData: data as PropertyData });
					break;
				case 3:
					updateFormData({ clientData: data as ClientData });
					break;
				case 4:
					updateFormData({
						isCoBroking: data.isCoBroking as boolean,
						coBrokingData: data.coBrokingData as CoBrokingData["coBrokingData"],
					});
					break;
				case 5:
					updateFormData({
						commissionType: data.commissionType as
							| "percentage"
							| "fixed"
							| undefined,
						commissionValue: data.commissionValue as number | undefined,
						commissionAmount: data.commissionAmount as number | undefined,
					});
					break;
				case 6:
					updateFormData({
						documents: data.documents as DocumentsData["documents"],
						notes: data.notes as string | undefined,
					});
					break;
			}
		},
		[updateFormData],
	);

	// Navigation functions
	const goToStep = useCallback((step: FormStep) => {
		setCurrentStep(step);
	}, []);

	const goToNextStep = useCallback(() => {
		setCurrentStep((prev) => Math.min(prev + 1, 7) as FormStep);
	}, []);

	const goToPreviousStep = useCallback(() => {
		setCurrentStep((prev) => Math.max(prev - 1, 1) as FormStep);
	}, []);

	// Reset form
	const resetForm = useCallback(() => {
		setFormData(initialFormData);
		setCurrentStep(1);
		setHasUnsavedChanges(false);
		localStorage.removeItem(FORM_STORAGE_KEY);
	}, []);

	// Clear auto-saved data
	const clearAutoSave = useCallback(() => {
		localStorage.removeItem(FORM_STORAGE_KEY);
		setHasUnsavedChanges(false);
	}, []);

	return {
		// State
		currentStep,
		formData,
		isLoading,
		hasUnsavedChanges,

		// Actions
		updateFormData,
		updateStepData,
		goToStep,
		goToNextStep,
		goToPreviousStep,
		resetForm,
		clearAutoSave,
		setIsLoading,
	};
}

// Progress calculation
export function calculateProgress(currentStep: FormStep): number {
	return (currentStep / 7) * 100;
}

// Step completion check
export function getCompletedSteps(
	formData: Partial<CompleteTransactionData>,
): FormStep[] {
	const completed: FormStep[] = [];

	// Step 1: Initiation
	if (
		formData.marketType &&
		formData.transactionType &&
		formData.transactionDate
	) {
		completed.push(1);
	}

	// Step 2: Property
	if (
		formData.propertyData?.address &&
		formData.propertyData?.propertyType &&
		formData.propertyData?.price
	) {
		completed.push(2);
	}

	// Step 3: Client (email now optional)
	if (
		formData.clientData?.name &&
		formData.clientData?.phone &&
		formData.clientData?.type
	) {
		completed.push(3);
	}

	// Step 4: Co-Broking (always considered complete as it's optional)
	completed.push(4);

	// Step 5: Commission
	if (
		formData.commissionType &&
		formData.commissionValue !== undefined &&
		formData.commissionAmount !== undefined
	) {
		completed.push(5);
	}

	// Step 6: Documents (optional, so always complete)
	completed.push(6);

	// Step 7: Review (complete if all previous steps are complete)
	if (completed.length >= 6) {
		completed.push(7);
	}

	return completed;
}

// Check if form is ready for submission
export function isFormReadyForSubmission(
	formData: Partial<CompleteTransactionData>,
): boolean {
	const completedSteps = getCompletedSteps(formData);
	return completedSteps.length === 7;
}

// Get next incomplete step
export function getNextIncompleteStep(
	formData: Partial<CompleteTransactionData>,
): FormStep {
	const completedSteps = getCompletedSteps(formData);

	for (let step = 1; step <= 7; step++) {
		if (!completedSteps.includes(step as FormStep)) {
			return step as FormStep;
		}
	}

	return 7; // All steps complete, go to review
}
