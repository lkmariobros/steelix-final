import { useCallback, useEffect, useState } from "react";
import type {
	ClientData,
	CoBrokingData,
	CompleteTransactionData,
	DocumentsData,
	FormStep,
	PropertyData,
	RepresentationType,
} from "../transaction-schema";

// Local storage keys for auto-save (Issue #4 fix)
const FORM_STORAGE_KEY = "transaction-form-draft";
const FORM_STEP_KEY = "transaction-form-step";

// Interface for serialized form data (handles Date serialization - Issue #4)
interface SerializedFormData extends Omit<Partial<CompleteTransactionData>, 'transactionDate'> {
	transactionDate?: string; // ISO string for localStorage
}

// Serialize form data for localStorage (Issue #4 fix)
function serializeFormData(data: Partial<CompleteTransactionData>): string {
	const serialized: SerializedFormData = {
		...data,
		transactionDate: data.transactionDate?.toISOString(),
	};
	return JSON.stringify(serialized);
}

// Deserialize form data from localStorage (Issue #4 fix)
function deserializeFormData(jsonString: string): Partial<CompleteTransactionData> {
	const parsed: SerializedFormData = JSON.parse(jsonString);
	return {
		...parsed,
		transactionDate: parsed.transactionDate ? new Date(parsed.transactionDate) : undefined,
	};
}

// Initial form data with unified representation type (Issue #1 fix)
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
		type: "buyer" as "buyer" | "seller" | "tenant" | "landlord",
		source: "",
		notes: "",
	},
	// Simplified representation type - 2 options: direct or co_broking
	representationType: "direct" as RepresentationType,
	isCoBroking: false, // Derived from representationType for backward compatibility
	coBrokingData: undefined,
	commissionType: "percentage" as const,
	commissionValue: 0,
	commissionAmount: 0,
	documents: [],
	notes: "",
};

// Form state hook with mode awareness (Issue #4 fix - step and date persistence)
export function useTransactionFormState(transactionId?: string, mode?: "create" | "edit" | "resume") {
	const [currentStep, setCurrentStep] = useState<FormStep>(1);
	const [formData, setFormData] =
		useState<Partial<CompleteTransactionData>>(initialFormData);
	const [isLoading, setIsLoading] = useState(false);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
	const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
	const [recoveredData, setRecoveredData] = useState<{
		data: Partial<CompleteTransactionData>;
		step: FormStep;
	} | null>(null);

	// Load saved form data from localStorage on mount (Issue #4 fix)
	useEffect(() => {
		if (!transactionId && mode !== "create") {
			const savedData = localStorage.getItem(FORM_STORAGE_KEY);
			const savedStep = localStorage.getItem(FORM_STEP_KEY);

			if (savedData) {
				try {
					const parsedData = deserializeFormData(savedData);
					const parsedStep = savedStep ? (parseInt(savedStep, 10) as FormStep) : 1;

					// Check if there's meaningful data to recover
					const hasData = parsedData.marketType ||
						parsedData.propertyData?.address ||
						parsedData.clientData?.name;

					if (hasData) {
						// Store recovered data for user decision
						setRecoveredData({ data: parsedData, step: parsedStep });
						setShowRecoveryDialog(true);
					}
				} catch (error) {
					if (process.env.NODE_ENV === 'development') {
						console.error("Failed to parse saved form data:", error);
					}
					// Clear corrupted data
					localStorage.removeItem(FORM_STORAGE_KEY);
					localStorage.removeItem(FORM_STEP_KEY);
				}
			}
		}
	}, [transactionId, mode]);

	// Auto-save to localStorage when form data changes (Issue #4 fix)
	useEffect(() => {
		if (!transactionId && hasUnsavedChanges) {
			const timeoutId = setTimeout(() => {
				localStorage.setItem(FORM_STORAGE_KEY, serializeFormData(formData));
				localStorage.setItem(FORM_STEP_KEY, currentStep.toString());
				setHasUnsavedChanges(false);
			}, 1000); // Debounce auto-save by 1 second

			return () => clearTimeout(timeoutId);
		}
	}, [formData, hasUnsavedChanges, transactionId, currentStep]);

	// Accept recovered data (Issue #4 fix)
	const acceptRecoveredData = useCallback(() => {
		if (recoveredData) {
			setFormData(recoveredData.data);
			setCurrentStep(recoveredData.step);
			setShowRecoveryDialog(false);
			setRecoveredData(null);
		}
	}, [recoveredData]);

	// Decline recovered data and start fresh (Issue #4 fix)
	const declineRecoveredData = useCallback(() => {
		localStorage.removeItem(FORM_STORAGE_KEY);
		localStorage.removeItem(FORM_STEP_KEY);
		setShowRecoveryDialog(false);
		setRecoveredData(null);
		setFormData(initialFormData);
		setCurrentStep(1);
	}, []);

	// Update form data
	const updateFormData = useCallback(
		(updates: Partial<CompleteTransactionData>) => {
			setFormData((prev) => ({ ...prev, ...updates }));
			setHasUnsavedChanges(true);
		},
		[],
	);

	// Update specific step data (Issue #1 fix - unified representation type handling)
	const updateStepData = useCallback(
		(step: FormStep, data: Record<string, unknown>) => {
			switch (step) {
				case 1:
					updateFormData({
						marketType: data.marketType as "primary" | "secondary" | undefined,
						transactionType: data.transactionType as
							| "sale"
							| "lease"
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
				case 4: {
					// Issue #1 fix: Handle unified representation type
					const representationType = data.representationType as RepresentationType | undefined;
					// Derive isCoBroking from representationType for backward compatibility
					const isCoBroking = representationType === "co_broking";

					updateFormData({
						representationType: representationType || "direct",
						isCoBroking,
						coBrokingData: data.coBrokingData as CoBrokingData["coBrokingData"],
					});
					break;
				}
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

	// Reset form (Issue #4 fix - clear step storage too)
	const resetForm = useCallback(() => {
		setFormData(initialFormData);
		setCurrentStep(1);
		setHasUnsavedChanges(false);
		localStorage.removeItem(FORM_STORAGE_KEY);
		localStorage.removeItem(FORM_STEP_KEY);
	}, []);

	// Clear auto-saved data (Issue #4 fix - clear step storage too)
	const clearAutoSave = useCallback(() => {
		localStorage.removeItem(FORM_STORAGE_KEY);
		localStorage.removeItem(FORM_STEP_KEY);
		setHasUnsavedChanges(false);
	}, []);

	return {
		// State
		currentStep,
		formData,
		isLoading,
		hasUnsavedChanges,
		// Issue #4: Recovery dialog state
		showRecoveryDialog,
		recoveredData,

		// Actions
		updateFormData,
		updateStepData,
		goToStep,
		goToNextStep,
		goToPreviousStep,
		resetForm,
		clearAutoSave,
		setIsLoading,
		// Issue #4: Recovery actions
		acceptRecoveredData,
		declineRecoveredData,
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
