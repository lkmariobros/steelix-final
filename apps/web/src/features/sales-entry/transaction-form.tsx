"use client";

import { Badge } from "@/components/badge";
import { Progress } from "@/components/progress";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClientSide } from "@/hooks/use-client-side";
import { useDocumentUpload } from "@/hooks/use-document-upload"; // Issue #3 Fix
import { invalidateTransactionQueries } from "@/lib/query-invalidation";
import { trpc } from "@/utils/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, Circle, Loader2, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
	FORM_STEP_COUNT,
	type FormStep,
	type SectionStep,
	stepConfig,
} from "./transaction-schema";
import {
	calculateProgress,
	getCompletedSteps,
	isFormReadyForSubmission,
	useTransactionFormState,
} from "./utils/form-state";

import { StepDealAndProperty } from "./steps/step-1-deal-property";
import { StepClientAndRepresentation } from "./steps/step-2-client-representation";
import { StepCommissionAndDocuments } from "./steps/step-3-commission-documents";
import { StepReview } from "./steps/step-7-review";

interface TransactionFormProps {
	transactionId?: string;
	mode?: "create" | "edit" | "resume";
	onSubmit?: () => void;
	onCancel?: () => void;
	onUnsavedChanges?: (hasChanges: boolean) => void;
}

export function TransactionForm({
	transactionId,
	mode = "create",
	onSubmit,
	onCancel,
	onUnsavedChanges,
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
	const progress = calculateProgress(currentStep);

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
			// If co-broking is enabled, validate required fields
			const { agentName, agencyName, contactInfo } = cleanedData.coBrokingData;
			if (!agentName?.trim() || !agencyName?.trim() || !contactInfo?.trim()) {
				throw new Error(
					"Please complete all co-broking fields: Agent Name, Agency Name, and Contact Info are required.",
				);
			}
		}

		return cleanedData;
	}, []);

	// Handle form submission
	const handleSubmit = useCallback(async () => {
		setIsLoading(true);
		try {
			let finalTransactionId = effectiveTxId;

			// Validate form data before submission
			if (
				!formData.marketType ||
				!formData.transactionType ||
				!formData.transactionDate
			) {
				toast.error("Please complete all required fields");
				return;
			}

			// Prepare clean form data
			const cleanedFormData = prepareFormDataForSubmission(formData);

			// Create or update the transaction first
			if (effectiveTxId) {
				await updateTransaction.mutateAsync({
					id: effectiveTxId,
					...cleanedFormData,
				});
			} else {
				const newTransaction =
					await createTransaction.mutateAsync(cleanedFormData);
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
	}, [hasUnsavedChanges, resetForm, onCancel]);

	// Render step content (4-step wizard)
	const renderStepContent = () => {
		switch (currentStep) {
			case 1:
				return (
					<StepDealAndProperty
						formData={formData}
						onUpdateInitiation={(data) => handleStepUpdate(1, data)}
						onUpdateProperty={(data) => handleStepUpdate(2, data)}
						onNext={goToNextStep}
						onPrevious={goToPreviousStep}
					/>
				);
			case 2:
				return (
					<StepClientAndRepresentation
						formData={formData}
						onUpdateClient={(data) => handleStepUpdate(3, data)}
						onUpdateCoBroking={(data) => handleStepUpdate(4, data)}
						onNext={goToNextStep}
						onPrevious={goToPreviousStep}
					/>
				);
			case 3:
				return (
					<StepCommissionAndDocuments
						formData={formData}
						transactionId={effectiveTxId}
						onUpdateCommission={(data) => handleStepUpdate(5, data)}
						onUpdateDocuments={(data) => handleStepUpdate(6, data)}
						onNext={goToNextStep}
						onPrevious={goToPreviousStep}
					/>
				);
			case 4:
				return (
					<StepReview
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

	return (
		<div className="mx-auto max-w-4xl space-y-6 p-6">
			{/* Header */}
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="font-bold text-3xl">Sales Transaction Entry</h1>
						<p className="text-muted-foreground">
							Complete all steps to submit your transaction for review
						</p>
					</div>
					<div className="flex items-center gap-2">
						{hasUnsavedChanges && (
							<Badge variant="outline" className="text-orange-600">
								Unsaved Changes
							</Badge>
						)}
						<Button
							variant="outline"
							onClick={handleSaveDraft}
							disabled={isSaving}
							className="flex items-center gap-2"
						>
							{isSaving ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Save className="h-4 w-4" />
							)}
							{isSaving ? "Saving..." : "Save Draft"}
						</Button>
						{onCancel && (
							<Button variant="outline" onClick={handleCancel}>
								Cancel
							</Button>
						)}
					</div>
				</div>

				{/* Progress */}
				<div className="space-y-2">
					<div className="flex items-center justify-between text-sm">
						<span>Progress</span>
						<span>{Math.round(progress)}% Complete</span>
					</div>
					<Progress value={progress} className="h-2" />
				</div>
			</div>

			{/* Step Navigation */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						Step {currentStep} of {FORM_STEP_COUNT}:{" "}
						{stepConfig[currentStep - 1].title}
					</CardTitle>
					<CardDescription>
						{stepConfig[currentStep - 1].description}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Tabs value={currentStep.toString()} className="w-full">
						{/* Issue #5 Fix: Mobile-friendly step navigation */}
						{/* Desktop: Full tabs */}
						<TabsList className="hidden w-full md:grid md:grid-cols-4">
							{stepConfig.map(({ step, title }) => (
								<TabsTrigger
									key={step}
									value={step.toString()}
									onClick={() => goToStep(step as FormStep)}
									className="flex items-center gap-1 text-xs"
									disabled={
										step > currentStep &&
										!completedSteps.includes(step as FormStep)
									}
								>
									{completedSteps.includes(step as FormStep) ? (
										<CheckCircle className="h-3 w-3" />
									) : (
										<Circle className="h-3 w-3" />
									)}
									<span>{title}</span>
								</TabsTrigger>
							))}
						</TabsList>
						{/* Mobile: Compact step indicators with touch-friendly targets */}
						<div className="md:hidden">
							<div className="mb-4 flex items-center justify-between">
								{stepConfig.map(({ step }) => {
									const isCompleted = completedSteps.includes(step as FormStep);
									const isCurrent = step === currentStep;
									const isAccessible = step <= currentStep || isCompleted;
									return (
										<button
											key={step}
											type="button"
											onClick={() => isAccessible && goToStep(step as FormStep)}
											disabled={!isAccessible}
											className={`flex h-10 w-10 items-center justify-center rounded-full font-medium text-sm transition-all duration-200 touch-manipulation${
												isCurrent
													? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
													: isCompleted
														? "bg-green-500 text-white"
														: isAccessible
															? "bg-muted text-muted-foreground hover:bg-muted/80"
															: "cursor-not-allowed bg-muted/50 text-muted-foreground/50"
											}
											`}
											aria-label={`Step ${step}: ${stepConfig[step - 1].title}${isCompleted ? " (completed)" : ""}`}
										>
											{isCompleted && !isCurrent ? (
												<CheckCircle className="h-5 w-5" />
											) : (
												step
											)}
										</button>
									);
								})}
							</div>
							{/* Mobile step title display */}
							<div className="text-center text-muted-foreground text-sm">
								{stepConfig[currentStep - 1].title}
							</div>
						</div>

						<Separator className="my-6" />

						<TabsContent value={currentStep.toString()} className="mt-6">
							{isClient ? (
								<AnimatePresence mode="wait">
									<motion.div
										key={currentStep}
										initial={{ opacity: 0, x: 20 }}
										animate={{ opacity: 1, x: 0 }}
										exit={{ opacity: 0, x: -20 }}
										transition={{
											duration: 0.3,
											ease: [0.16, 1, 0.3, 1],
										}}
									>
										{renderStepContent()}
									</motion.div>
								</AnimatePresence>
							) : (
								<div>{renderStepContent()}</div>
							)}
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>
		</div>
	);
}
