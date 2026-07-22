"use client";

import { Badge } from "@/components/badge";
import { Button } from "@/components/ui/button";
import { useClientSide } from "@/hooks/use-client-side";
import { useDocumentUpload } from "@/hooks/use-document-upload"; // Issue #3 Fix
import { invalidateTransactionQueries } from "@/lib/query-invalidation";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
	type FormStep,
	type SectionStep,
	stepConfig,
} from "./transaction-schema";
import {
	getCompletedSteps,
	isFormReadyForSubmission,
	useTransactionFormState,
} from "./utils/form-state";

import { StepDetails } from "./steps/step-1-details";
import { StepUpload } from "./steps/step-2-upload";
import { StepVerify } from "./steps/step-3-verify";

interface TransactionFormProps {
	transactionId?: string;
	mode?: "create" | "edit" | "resume";
	/** When true, hide duplicate page title; actions live in the modal header. */
	embedded?: boolean;
	onSubmit?: () => void;
	onCancel?: () => void;
	onUnsavedChanges?: (hasChanges: boolean) => void;
	onSavingChange?: (isSaving: boolean) => void;
	onRegisterSaveDraft?: (fn: (() => void) | null) => void;
}

export function TransactionForm({
	transactionId,
	mode = "create",
	embedded = false,
	onSubmit,
	onCancel,
	onUnsavedChanges,
	onSavingChange,
	onRegisterSaveDraft,
}: TransactionFormProps) {
	const queryClient = useQueryClient();

	const [localTxId, setLocalTxId] = useState<string | undefined>();

	useEffect(() => {
		setLocalTxId(undefined);
	}, [transactionId]);

	const effectiveTxId = transactionId ?? localTxId;

	const {
		currentStep,
		formData,
		isLoading,
		hasUnsavedChanges,
		isHydratingTransaction,
		serverTransactionStatus,
		updateStepData,
		updateFormData,
		goToStep,
		goToNextStep,
		goToPreviousStep,
		resetForm,
		clearAutoSave,
		setIsLoading,
	} = useTransactionFormState(transactionId, mode);

	const [isSaving, setIsSaving] = useState(false);
	const isClient = useClientSide();

	// Issue #3 Fix: Use document upload hook for temp document migration
	const { migrateDocuments, tempDocuments, clearTempDocuments } =
		useDocumentUpload(effectiveTxId);

	// ✅ REAL tRPC mutations for comprehensive transaction data flow
	const createTransaction = trpc.transactions.create.useMutation({
		onSuccess: (data) => {
			console.log("Transaction created successfully:", data.id);
			invalidateTransactionQueries(queryClient);
		},
		onError: (error) => {
			console.error("Create transaction error:", error);
			toast.error("Failed to create transaction");
		},
	});

	const updateTransaction = trpc.transactions.update.useMutation({
		onSuccess: (data) => {
			console.log("Transaction updated successfully:", data.id);
			invalidateTransactionQueries(queryClient);
		},
		onError: (error) => {
			console.error("Update transaction error:", error);
			toast.error("Failed to update transaction");
		},
	});

	const submitTransaction = trpc.transactions.submit.useMutation({
		onSuccess: (data) => {
			console.log("Transaction submitted successfully:", data.id);
			// Comprehensive invalidation for submission (affects both dashboards)
			invalidateTransactionQueries(queryClient);
		},
		onError: (error) => {
			console.error("Submit transaction error:", error);
			toast.error("Failed to submit transaction");
		},
	});

	const completedSteps = getCompletedSteps(formData);

	// Notify parent component about unsaved changes
	useEffect(() => {
		onUnsavedChanges?.(hasUnsavedChanges);
	}, [hasUnsavedChanges, onUnsavedChanges]);

	// Handle step data updates
	const handleStepUpdate = useCallback(
		(step: SectionStep, data: Record<string, unknown>) => {
			updateStepData(step, data);
		},
		[updateStepData],
	);

	// Handle save draft
	const handleSaveDraft = useCallback(async () => {
		setIsSaving(true);
		try {
			// For drafts, we can be more lenient with co-broking validation
			const draftData = { ...formData };
			if (!draftData.isCoBroking) {
				draftData.coBrokingData = undefined;
			}

			let savedId: string | undefined;

			if (effectiveTxId) {
				await updateTransaction.mutateAsync({
					id: effectiveTxId,
					...draftData,
				});
				savedId = effectiveTxId;
				toast.success("Draft updated successfully");
			} else {
				const newTransaction = await createTransaction.mutateAsync(draftData);
				setLocalTxId(newTransaction.id);
				savedId = newTransaction.id;
				toast.success("Draft saved successfully");
			}

			const canAutoSubmit =
				serverTransactionStatus === undefined ||
				serverTransactionStatus === "draft";

			if (
				savedId &&
				canAutoSubmit &&
				isFormReadyForSubmission(formData)
			) {
				try {
					if (tempDocuments.length > 0) {
						await migrateDocuments(savedId);
					}
					await submitTransaction.mutateAsync({ id: savedId });
					toast.success("Transaction submitted for review");
					clearAutoSave();
					clearTempDocuments();
					onSubmit?.();
				} catch {
					// submitTransaction / migrate already toasts
				}
			} else {
				clearAutoSave();
			}
		} catch (error) {
			console.error("Save draft error:", error);
			// Error handling is now done in mutation onError callbacks
		} finally {
			setIsSaving(false);
		}
	}, [
		effectiveTxId,
		formData,
		updateTransaction,
		createTransaction,
		submitTransaction,
		serverTransactionStatus,
		tempDocuments,
		migrateDocuments,
		clearAutoSave,
		clearTempDocuments,
		onSubmit,
	]);

	// Clean form data for submission
	const prepareFormDataForSubmission = useCallback((data: typeof formData) => {
		const cleanedData = { ...data };

		// Handle co-broking data properly
		if (!cleanedData.isCoBroking) {
			// If co-broking is disabled, remove coBrokingData entirely
			cleanedData.coBrokingData = undefined;
		} else if (cleanedData.coBrokingData) {
			const { internalAgentId, agentName, agentPhone } =
				cleanedData.coBrokingData;
			if (
				!internalAgentId?.trim() &&
				(!agentName?.trim() || !agentPhone?.trim())
			) {
				throw new Error(
					"Please select a co-broke agent or complete agent name and phone.",
				);
			}
		}

		// Ensure uploaded temp documents are included even if formData sync lagged
		if (!cleanedData.documents?.length && tempDocuments.length > 0) {
			cleanedData.documents = tempDocuments.map((d) => ({
				id: d.id,
				name: d.name,
				type: d.type,
				url: d.url,
				uploadedAt: d.uploadedAt,
				category: d.category,
			}));
		}

		return cleanedData;
	}, [tempDocuments]);

	// Handle form submission
	const handleSubmit = useCallback(async () => {
		setIsLoading(true);
		try {
			let finalTransactionId = effectiveTxId;

			// Validate form data before submission
			if (!formData.propertyData?.price) {
				toast.error("Please complete all required fields");
				return;
			}
			if (
				formData.marketType === "secondary" &&
				(!formData.propertyData?.address?.trim() ||
					(formData.commissionValue ?? 0) <= 0)
			) {
				toast.error(
					"Secondary market requires property address and commission rate",
				);
				return;
			}
			if (
				formData.marketType !== "secondary" &&
				(!formData.projectName || !formData.unitNo)
			) {
				toast.error("Please complete all required fields");
				return;
			}

			const cleanedFormData = prepareFormDataForSubmission(formData);

			const payload = {
				...cleanedFormData,
				marketType: cleanedFormData.marketType ?? "primary",
				transactionType:
					cleanedFormData.marketType === "secondary"
						? (cleanedFormData.transactionType ?? "sale")
						: ("sale" as const),
				transactionDate:
					cleanedFormData.bookingDate ??
					cleanedFormData.transactionDate ??
					new Date(),
			};

			// Create or update the transaction first
			if (effectiveTxId) {
				await updateTransaction.mutateAsync({
					id: effectiveTxId,
					...payload,
				});
			} else {
				const newTransaction =
					await createTransaction.mutateAsync(payload);
				finalTransactionId = newTransaction.id;
				setLocalTxId(newTransaction.id);
			}

			// Issue #3 Fix: Migrate temp documents to the new transaction
			if (finalTransactionId && tempDocuments.length > 0) {
				await migrateDocuments(finalTransactionId);
			}

			// Submit for review
			if (finalTransactionId) {
				await submitTransaction.mutateAsync({ id: finalTransactionId });
				toast.success("Transaction submitted for review successfully!");
				clearAutoSave();
				clearTempDocuments(); // Issue #3 Fix: Clear temp docs after successful submission
				onSubmit?.();
			}
		} catch (error) {
			console.error("Submit error:", error);
			// Error handling is now done in mutation onError callbacks
		} finally {
			setIsLoading(false);
		}
	}, [
		effectiveTxId,
		formData,
		updateTransaction,
		createTransaction,
		submitTransaction,
		clearAutoSave,
		clearTempDocuments,
		migrateDocuments,
		tempDocuments,
		onSubmit,
		setIsLoading,
		prepareFormDataForSubmission,
	]);

	// Handle cancel
	const handleCancel = useCallback(() => {
		if (embedded) {
			onCancel?.();
			return;
		}
		if (hasUnsavedChanges) {
			if (
				confirm("You have unsaved changes. Are you sure you want to cancel?")
			) {
				resetForm();
				onCancel?.();
			}
		} else {
			onCancel?.();
		}
	}, [embedded, hasUnsavedChanges, resetForm, onCancel]);

	useEffect(() => {
		onSavingChange?.(isSaving);
	}, [isSaving, onSavingChange]);

	useEffect(() => {
		onRegisterSaveDraft?.(handleSaveDraft);
	}, [onRegisterSaveDraft, handleSaveDraft]);

	useEffect(() => {
		return () => onRegisterSaveDraft?.(null);
	}, [onRegisterSaveDraft]);

	// Render step content (3-step wizard)
	const renderStepContent = () => {
		switch (currentStep) {
			case 1:
				return (
					<StepDetails
						formData={formData}
						onUpdate={updateFormData}
						onNext={goToNextStep}
					/>
				);
			case 2:
				return (
					<StepUpload
						formData={formData}
						transactionId={effectiveTxId}
						onUpdate={(data) => handleStepUpdate(6, data)}
						onNext={goToNextStep}
						onPrevious={goToPreviousStep}
					/>
				);
			case 3:
				return (
					<StepVerify
						data={formData}
						onSubmit={handleSubmit}
						onPrevious={goToPreviousStep}
						onEditStep={goToStep}
						isLoading={isLoading}
					/>
				);
			default:
				return null;
		}
	};

	if (isHydratingTransaction) {
		return (
			<div className="flex min-h-[240px] items-center justify-center p-6">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const activeStep = stepConfig[currentStep - 1];

	return (
		<div
			className={cn(
				"mx-auto w-full space-y-5",
				embedded ? "max-w-none px-5 py-5" : "max-w-4xl space-y-6 p-6",
			)}
		>
			{!embedded ? (
				<div className="flex items-center justify-between gap-3">
					<div>
						<h1 className="font-bold text-3xl">Sales Transaction Entry</h1>
						<p className="text-muted-foreground">
							Complete all steps to submit your transaction for review
						</p>
					</div>
					<div className="flex items-center gap-2">
						{hasUnsavedChanges ? (
							<Badge variant="outline" className="text-orange-600">
								Unsaved
							</Badge>
						) : null}
						<Button
							variant="outline"
							size="sm"
							onClick={handleSaveDraft}
							disabled={isSaving}
							className="gap-1.5"
						>
							{isSaving ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Save className="h-4 w-4" />
							)}
							{isSaving ? "Saving..." : "Save Draft"}
						</Button>
						{onCancel ? (
							<Button variant="outline" size="sm" onClick={handleCancel}>
								Cancel
							</Button>
						) : null}
					</div>
				</div>
			) : null}

			{/* Step strip */}
			<nav aria-label="Transaction steps" className="space-y-3">
				<ol className="grid grid-cols-3 gap-2 sm:gap-3">
					{stepConfig.map(({ step, title }) => {
						const isCompleted = completedSteps.includes(step as FormStep);
						const isCurrent = step === currentStep;
						const isAccessible = step <= currentStep || isCompleted;

						return (
							<li key={step}>
								<button
									type="button"
									onClick={() =>
										isAccessible && goToStep(step as FormStep)
									}
									disabled={!isAccessible}
									aria-current={isCurrent ? "step" : undefined}
									className={cn(
										"flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors touch-manipulation",
										isCurrent &&
											"border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30",
										!isCurrent &&
											isCompleted &&
											"border-border bg-muted/40 hover:bg-muted/70",
										!isCurrent &&
											!isCompleted &&
											isAccessible &&
											"border-border hover:bg-muted/50",
										!isAccessible &&
											"cursor-not-allowed border-border/60 bg-muted/20 opacity-60",
									)}
								>
									<span
										className={cn(
											"flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-medium text-xs",
											isCurrent &&
												"bg-primary text-primary-foreground",
											!isCurrent &&
												isCompleted &&
												"bg-emerald-600 text-white",
											!isCurrent &&
												!isCompleted &&
												"bg-muted text-muted-foreground",
										)}
									>
										{isCompleted && !isCurrent ? (
											<Check className="h-3.5 w-3.5" strokeWidth={3} />
										) : (
											step
										)}
									</span>
									<span className="min-w-0">
										<span
											className={cn(
												"block truncate font-medium text-sm",
												isCurrent
													? "text-foreground"
													: "text-muted-foreground",
											)}
										>
											{title}
										</span>
										<span className="hidden text-muted-foreground text-xs sm:block">
											Step {step}
										</span>
									</span>
								</button>
							</li>
						);
					})}
				</ol>
				<p className="text-muted-foreground text-sm">
					<span className="font-medium text-foreground">
						{activeStep.title}:
					</span>{" "}
					{activeStep.description}
				</p>
			</nav>

			<div className="min-w-0">
				{isClient ? (
					<AnimatePresence mode="wait">
						<motion.div
							key={currentStep}
							initial={{ opacity: 0, x: 16 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: -16 }}
							transition={{
								duration: 0.25,
								ease: [0.16, 1, 0.3, 1],
							}}
						>
							{renderStepContent()}
						</motion.div>
					</AnimatePresence>
				) : (
					<div>{renderStepContent()}</div>
				)}
			</div>
		</div>
	);
}
