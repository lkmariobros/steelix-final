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
	clearRememberedTransactionDraftId,
	rememberTransactionDraftId,
} from "./draft-persistence";
import {
	type FormStep,
	type SectionStep,
	stepConfig,
} from "./transaction-schema";
import {
	getCompletedSteps,
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
	const { migrateDocuments, clearTempDocuments } =
		useDocumentUpload(effectiveTxId);

	// ✅ REAL tRPC mutations for comprehensive transaction data flow
	const createTransaction = trpc.transactions.create.useMutation({
		onSuccess: (data) => {
			console.log("Transaction created successfully:", data.id);
			invalidateTransactionQueries(queryClient);
		},
		onError: (error) => {
			console.error("Create transaction error:", error);
			toast.error(error.message || "Failed to create transaction");
		},
	});

	const updateTransaction = trpc.transactions.update.useMutation({
		onSuccess: (data) => {
			console.log("Transaction updated successfully:", data.id);
			invalidateTransactionQueries(queryClient);
		},
		onError: (error) => {
			console.error("Update transaction error:", error);
			toast.error(error.message || "Failed to update transaction");
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
			toast.error(error.message || "Failed to submit transaction");
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

	// Clean form data for create/update API (docs migrate separately)
	const prepareFormDataForSubmission = useCallback(
		(
			data: typeof formData,
			opts?: { requireCoBroke?: boolean },
		) => {
			const cleanedData = { ...data };
			const requireCoBroke = opts?.requireCoBroke ?? true;

			const isCoBroking =
				cleanedData.representationType === "co_broking" ||
				cleanedData.isCoBroking === true;

			if (!isCoBroking) {
				cleanedData.coBrokingData = undefined;
			} else if (cleanedData.coBrokingData) {
				const agents =
					cleanedData.coBrokingData.agents &&
					cleanedData.coBrokingData.agents.length > 0
						? cleanedData.coBrokingData.agents
						: [
								{
									internalAgentId: cleanedData.coBrokingData.internalAgentId,
									agentName: cleanedData.coBrokingData.agentName,
									agencyName: cleanedData.coBrokingData.agencyName,
									agentPhone: cleanedData.coBrokingData.agentPhone,
									commissionSplit: cleanedData.coBrokingData.commissionSplit,
								},
							];

				if (requireCoBroke) {
					const anyComplete = agents.some((agent) => {
						if (agent.internalAgentId?.trim()) return true;
						if (
							cleanedData.marketType === "secondary" &&
							agent.agencyName?.trim() &&
							agent.agentName?.trim()
						) {
							return true;
						}
						return Boolean(agent.agentName?.trim() && agent.agentPhone?.trim());
					});
					if (!anyComplete) {
						throw new Error(
							"Please add at least one co-broke agent or complete co-agency details.",
						);
					}
					const total = agents.reduce(
						(sum, a) => sum + (Number(a.commissionSplit) || 0),
						0,
					);
					if (total > 100) {
						throw new Error("Combined co-broker shares cannot exceed 100%.");
					}
				}
			}

			if (!cleanedData.blockListingId?.trim()) {
				cleanedData.blockListingId = undefined;
			}
			if (cleanedData.propertyData) {
				const listingId = cleanedData.propertyData.listingId;
				const schemeId = cleanedData.propertyData.schemeId;
				cleanedData.propertyData = {
					...cleanedData.propertyData,
					listingId: listingId?.trim() ? listingId : undefined,
					schemeId: schemeId?.trim() ? schemeId : undefined,
				};
			}

			const price =
				cleanedData.propertyData?.nettPrice ??
				cleanedData.propertyData?.price ??
				0;
			const commissionValue = cleanedData.commissionValue ?? 0;
			if (
				(cleanedData.commissionAmount ?? 0) <= 0 &&
				commissionValue > 0 &&
				price > 0 &&
				(cleanedData.commissionType ?? "percentage") === "percentage"
			) {
				cleanedData.commissionAmount =
					Math.round(((price * commissionValue) / 100) * 100) / 100;
			}

			cleanedData.documents = undefined;

			return cleanedData;
		},
		[],
	);

	// Handle save draft — never auto-submit; drafts stay status=draft until Verify
	const handleSaveDraft = useCallback(
		async (opts?: { silent?: boolean }) => {
			setIsSaving(true);
			try {
				const draftData = prepareFormDataForSubmission(
					{ ...formData },
					{ requireCoBroke: false },
				);

				let savedId: string | undefined;

				if (effectiveTxId) {
					await updateTransaction.mutateAsync({
						id: effectiveTxId,
						...draftData,
					});
					savedId = effectiveTxId;
					if (!opts?.silent) {
						toast.success("Draft updated successfully");
					}
				} else {
					const newTransaction = await createTransaction.mutateAsync({
						...draftData,
						marketType: draftData.marketType ?? "primary",
						transactionType:
							draftData.marketType === "secondary"
								? (draftData.transactionType ?? "sale")
								: ("sale" as const),
						transactionDate:
							draftData.bookingDate ??
							draftData.transactionDate ??
							new Date(),
					});
					setLocalTxId(newTransaction.id);
					savedId = newTransaction.id;
					if (!opts?.silent) {
						toast.success("Draft saved successfully");
					}
				}

				if (savedId) {
					rememberTransactionDraftId(savedId);
					try {
						await migrateDocuments(savedId);
					} catch {
						// migrateDocuments already toasts
					}
				}

				clearAutoSave();
				return savedId;
			} catch (error) {
				console.error("Save draft error:", error);
				// Error toast comes from mutation onError
				if (opts?.silent) throw error;
				return undefined;
			} finally {
				setIsSaving(false);
			}
		},
		[
			effectiveTxId,
			formData,
			updateTransaction,
			createTransaction,
			migrateDocuments,
			clearAutoSave,
			prepareFormDataForSubmission,
		],
	);

	const handleNextWithDraftSave = useCallback(async () => {
		try {
			await handleSaveDraft({ silent: true });
			toast.success("Draft auto-saved", {
				description:
					"After refresh, click New Transaction again to continue this draft.",
			});
			goToNextStep();
		} catch {
			// Stay on current step; mutation already toasts the error
		}
	}, [handleSaveDraft, goToNextStep]);

	// Handle form submission
	const handleSubmit = useCallback(async () => {
		setIsLoading(true);
		try {
			let finalTransactionId = effectiveTxId;

			const goToField = (fieldId: string) => {
				goToStep(1);
				window.setTimeout(() => {
					document
						.querySelector(`[data-field="${fieldId}"]`)
						?.scrollIntoView({ behavior: "smooth", block: "center" });
				}, 320);
			};

			// Validate form data before submission
			if (!formData.propertyData?.price) {
				toast.error("Please enter the property / rental price");
				goToField(
					formData.transactionType === "lease"
						? "monthly-rental-price"
						: formData.marketType === "secondary"
							? "spa-price"
							: "property-price",
				);
				return;
			}
			if (formData.marketType === "secondary") {
				const isLease = formData.transactionType === "lease";
				if (!formData.propertyData?.address?.trim()) {
					toast.error("Property address is required");
					goToField("property-address");
					return;
				}
				if (!isLease && (formData.commissionValue ?? 0) <= 0) {
					toast.error("Commission percent is required");
					goToField("commission-percent");
					return;
				}
				if ((formData.commissionAmount ?? 0) <= 0) {
					toast.error(
						isLease
							? "Case commission is required"
							: "Commission amount is required",
					);
					goToField("commission-amount");
					return;
				}
			}
			if (
				formData.marketType !== "secondary" &&
				(!formData.projectName || !formData.unitNo)
			) {
				toast.error("Please complete project name and unit number");
				goToField("project-name");
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

			// Migrate temp uploads from localStorage even if this hook's state is empty
			if (finalTransactionId) {
				await migrateDocuments(finalTransactionId);
			}

			// Submit for review
			if (finalTransactionId) {
				await submitTransaction.mutateAsync({ id: finalTransactionId });
				clearRememberedTransactionDraftId(finalTransactionId);
				toast.success("Transaction submitted for review successfully!");
				clearAutoSave();
				clearTempDocuments();
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
		onSubmit,
		setIsLoading,
		goToStep,
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
		onRegisterSaveDraft?.(() => {
			void handleSaveDraft();
		});
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
						onNext={handleNextWithDraftSave}
					/>
				);
			case 2:
				return (
					<StepUpload
						formData={formData}
						transactionId={effectiveTxId}
						onUpdate={(data) => handleStepUpdate(6, data)}
						onNext={handleNextWithDraftSave}
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
							onClick={() => {
								void handleSaveDraft();
							}}
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
