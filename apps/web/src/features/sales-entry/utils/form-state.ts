import { trpc } from "@/utils/trpc";
import { useCallback, useEffect, useRef, useState } from "react";
import { takeTransactionPrefillOnce } from "../prefill-stash";
import {
	FORM_STEP_COUNT,
	type ClientData,
	type CoBrokingData,
	type CompleteTransactionData,
	type DocumentsData,
	type FormStep,
	normalizeFormStep,
	type PropertyData,
	type RepresentationType,
	type SectionStep,
} from "../transaction-schema";
import { mapTransactionRowToFormData } from "./transaction-mapper";

// Local storage keys for auto-save (Issue #4 fix)
const FORM_STORAGE_KEY = "transaction-form-draft";
const FORM_STEP_KEY = "transaction-form-step";

// Interface for serialized form data (handles Date serialization - Issue #4)
interface SerializedFormData
	extends Omit<Partial<CompleteTransactionData>, "transactionDate"> {
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
function deserializeFormData(
	jsonString: string,
): Partial<CompleteTransactionData> {
	const parsed: SerializedFormData = JSON.parse(jsonString);
	return {
		...parsed,
		transactionDate: parsed.transactionDate
			? new Date(parsed.transactionDate)
			: undefined,
	};
}

// Initial form data — primary market 3-step wizard defaults
export const initialFormData: Partial<CompleteTransactionData> = {
	marketType: "primary",
	transactionType: "sale",
	transactionDate: undefined,
	projectName: "",
	unitNo: "",
	blockListingId: undefined,
	bookingDate: undefined,
	propertyData: {
		price: 0,
		salesPackage: "",
		rebateAmount: undefined,
		nettPrice: undefined,
		purchasingMethod: undefined,
	},
	clientData: {
		name: "",
		icNo: "",
		email: "",
		phone: "",
		address: "",
		race: "",
		nationality: "",
		gender: "",
		emergencyName: "",
		emergencyContact: "",
	},
	representationType: "direct" as RepresentationType,
	isCoBroking: false,
	coBrokingData: undefined,
	commissionType: "percentage" as const,
	commissionValue: 0,
	commissionAmount: 0,
	documents: [],
	notes: "",
};

// Form state hook with mode awareness (Issue #4 fix - step and date persistence)
export function useTransactionFormState(
	transactionId?: string,
	mode?: "create" | "edit" | "resume",
) {
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
	const lastHydratedIdRef = useRef<string | null>(null);

	const shouldHydrateFromServer =
		Boolean(transactionId) && (mode === "edit" || mode === "resume");

	const { data: loadedTransaction, isLoading: isLoadingTransaction } =
		trpc.transactions.getById.useQuery(
			{ id: transactionId ?? "" },
			{ enabled: shouldHydrateFromServer },
		);

	useEffect(() => {
		if (!shouldHydrateFromServer || !transactionId || !loadedTransaction) {
			return;
		}
		if (loadedTransaction.id !== transactionId) return;
		if (lastHydratedIdRef.current === transactionId) return;

		lastHydratedIdRef.current = transactionId;
		const mapped = mapTransactionRowToFormData(loadedTransaction);
		setFormData({
			...initialFormData,
			...mapped,
			propertyData: {
				...(initialFormData.propertyData ?? {}),
				...(mapped.propertyData ?? {}),
			},
			clientData: {
				...(initialFormData.clientData ?? {}),
				...(mapped.clientData ?? {}),
			},
		} as Partial<CompleteTransactionData>);
		setCurrentStep(getNextIncompleteStep(mapped));
		setHasUnsavedChanges(false);
	}, [
		shouldHydrateFromServer,
		transactionId,
		loadedTransaction,
	]);

	useEffect(() => {
		lastHydratedIdRef.current = null;
	}, [transactionId]);

	useEffect(() => {
		if (transactionId || mode !== "create") return;
		const prefill = takeTransactionPrefillOnce();
		if (!prefill || Object.keys(prefill).length === 0) return;
		setFormData(() =>
			({
				...initialFormData,
				...prefill,
				propertyData: {
					...(initialFormData.propertyData ?? {}),
					...(prefill.propertyData ?? {}),
				},
				clientData: {
					...(initialFormData.clientData ?? {}),
					...(prefill.clientData ?? {}),
				},
			}) as Partial<CompleteTransactionData>,
		);
		setHasUnsavedChanges(true);
	}, [transactionId, mode]);

	// Load saved form data from localStorage on mount (Issue #4 fix)
	useEffect(() => {
		if (!transactionId && mode !== "create") {
			const savedData = localStorage.getItem(FORM_STORAGE_KEY);
			const savedStep = localStorage.getItem(FORM_STEP_KEY);

			if (savedData) {
				try {
					const parsedData = deserializeFormData(savedData);
					const parsedStep = savedStep
						? normalizeFormStep(Number.parseInt(savedStep, 10))
						: 1;

					// Check if there's meaningful data to recover
					const hasData =
						parsedData.marketType ||
						parsedData.propertyData?.address ||
						parsedData.clientData?.name;

					if (hasData) {
						// Store recovered data for user decision
						setRecoveredData({ data: parsedData, step: parsedStep });
						setShowRecoveryDialog(true);
					}
				} catch (error) {
					if (process.env.NODE_ENV === "development") {
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
		(step: SectionStep, data: Record<string, unknown>) => {
			switch (step) {
				case 1:
					updateFormData({
						marketType: data.marketType as "primary" | "secondary" | undefined,
						transactionType: data.transactionType as
							| "sale"
							| "lease"
							| undefined,
						transactionDate: data.transactionDate as Date | undefined,
						projectName: data.projectName as string | undefined,
						unitNo: data.unitNo as string | undefined,
						blockListingId: data.blockListingId as string | undefined,
						bookingDate: data.bookingDate as Date | undefined,
						propertyData: data.propertyData as PropertyData | undefined,
						clientData: data.clientData as ClientData | undefined,
						representationType: data.representationType as
							| RepresentationType
							| undefined,
						isCoBroking: data.isCoBroking as boolean | undefined,
						coBrokingData: data.coBrokingData as CoBrokingData["coBrokingData"],
						agentId: data.agentId as string | undefined,
						commissionType: data.commissionType as
							| "percentage"
							| "fixed"
							| undefined,
						commissionValue: data.commissionValue as number | undefined,
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
					const representationType = data.representationType as
						| RepresentationType
						| undefined;
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
		setCurrentStep(
			(prev) => Math.min(prev + 1, FORM_STEP_COUNT) as FormStep,
		);
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

	const isHydratingTransaction =
		shouldHydrateFromServer && isLoadingTransaction;

	return {
		// State
		currentStep,
		formData,
		isLoading,
		hasUnsavedChanges,
		isHydratingTransaction,
		/** Present when editing/resuming and getById loaded; used to avoid re-submitting non-drafts */
		serverTransactionStatus: loadedTransaction?.status,
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
	return (currentStep / FORM_STEP_COUNT) * 100;
}

// Step completion check (3-step wizard)
export function getCompletedSteps(
	formData: Partial<CompleteTransactionData>,
): FormStep[] {
	const completed: FormStep[] = [];

	const detailsComplete =
		formData.propertyData?.price &&
		formData.clientData?.name?.trim() &&
		formData.clientData?.icNo?.trim() &&
		formData.clientData?.phone?.trim() &&
		formData.clientData?.address?.trim() &&
		(formData.bookingDate || formData.transactionDate) &&
		(formData.marketType === "secondary"
			? Boolean(formData.propertyData?.address?.trim()) &&
				(formData.commissionValue ?? 0) > 0
			: Boolean(formData.projectName?.trim()) &&
				Boolean(formData.unitNo?.trim()));
	if (detailsComplete) completed.push(1);

	// Upload step is always navigable once details are done
	if (detailsComplete) completed.push(2);

	if (completed.length >= 2) completed.push(3);

	return completed;
}

// Check if form is ready for submission
export function isFormReadyForSubmission(
	formData: Partial<CompleteTransactionData>,
): boolean {
	const completedSteps = getCompletedSteps(formData);
	return completedSteps.length === FORM_STEP_COUNT;
}

// Get next incomplete step
export function getNextIncompleteStep(
	formData: Partial<CompleteTransactionData>,
): FormStep {
	const completedSteps = getCompletedSteps(formData);

	for (let step = 1; step <= FORM_STEP_COUNT; step++) {
		if (!completedSteps.includes(step as FormStep)) {
			return step as FormStep;
		}
	}

	return FORM_STEP_COUNT;
}
