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

import { StepDetails } from "./steps/step-1-details";
import { StepUpload } from "./steps/step-2-upload";
import { StepVerify } from "./steps/step-3-verify";

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

		return cleanedData;
	}, []);

	// Handle form submission
	const handleSubmit = useCallback(async () => {
		setIsLoading(true);
		try {
			let finalTransactionId = effectiveTxId;

			// Validate form data before submission
			if (!formData.projectName || !formData.propertyData?.price) {
				toast.error("Please complete all required fields");
				return;
			}

			const cleanedFormData = prepareFormDataForSubmission(formData);

			const payload = {
				...cleanedFormData,
				marketType: "primary" as const,
				transactionType: "sale" as const,
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
