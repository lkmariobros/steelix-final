"use client";

import { Badge } from "@/components/badge";
import {
	EnhancedModal,
	UnsavedChangesDialog,
} from "@/components/enhanced-modal";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { TransactionForm } from "./transaction-form";

interface TransactionFormModalProps {
	isOpen: boolean;
	onClose: () => void;
	transactionId?: string;
	onSubmit?: () => void;
	mode?: "create" | "edit" | "view" | "resume";
}

export function TransactionFormModal({
	isOpen,
	onClose,
	transactionId,
	onSubmit,
	mode = "create",
}: TransactionFormModalProps) {
	const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const saveDraftRef = useRef<(() => void) | null>(null);

	const handleConfirmClose = useCallback(async (): Promise<boolean> => {
		if (hasUnsavedChanges) {
			setShowUnsavedDialog(true);
			return false;
		}
		return true;
	}, [hasUnsavedChanges]);

	const handleConfirmedClose = useCallback(() => {
		setShowUnsavedDialog(false);
		setHasUnsavedChanges(false);
		setIsSaving(false);
		onClose();
	}, [onClose]);

	const handleCancelClose = useCallback(() => {
		setShowUnsavedDialog(false);
	}, []);

	const handleFormSubmit = useCallback(() => {
		setHasUnsavedChanges(false);
		setIsSaving(false);
		onSubmit?.();
		onClose();
	}, [onSubmit, onClose]);

	const handleFormCancel = useCallback(() => {
		if (hasUnsavedChanges) {
			setShowUnsavedDialog(true);
		} else {
			onClose();
		}
	}, [hasUnsavedChanges, onClose]);

	const handleUnsavedChanges = useCallback((hasChanges: boolean) => {
		setHasUnsavedChanges(hasChanges);
	}, []);

	const handleSavingChange = useCallback((saving: boolean) => {
		setIsSaving(saving);
	}, []);

	const handleRegisterSaveDraft = useCallback((fn: (() => void) | null) => {
		saveDraftRef.current = fn;
	}, []);

	const getModalTitle = () => {
		switch (mode) {
			case "create":
				return "New Sales Transaction";
			case "edit":
				return "Edit Transaction";
			case "view":
				return "View Transaction";
			case "resume":
				return "Resume Transaction";
			default:
				return "Sales Transaction";
		}
	};

	const getModalDescription = () => {
		switch (mode) {
			case "create":
				return "Complete all steps to submit your transaction for review";
			case "edit":
				return "Update transaction details and resubmit for review";
			case "view":
				return "Review transaction details";
			case "resume":
				return "Continue where you left off";
			default:
				return "";
		}
	};

	const headerActions = (
		<>
			{hasUnsavedChanges ? (
				<Badge
					variant="outline"
					className="hidden text-orange-600 sm:inline-flex"
				>
					Unsaved
				</Badge>
			) : null}
			<Button
				variant="outline"
				size="sm"
				disabled={isSaving}
				className="gap-1.5"
				onClick={() => saveDraftRef.current?.()}
			>
				{isSaving ? (
					<Loader2 className="h-4 w-4 animate-spin" />
				) : (
					<Save className="h-4 w-4" />
				)}
				<span className="hidden sm:inline">
					{isSaving ? "Saving..." : "Save Draft"}
				</span>
			</Button>
			<Button variant="outline" size="sm" onClick={handleFormCancel}>
				Cancel
			</Button>
		</>
	);

	return (
		<>
			<EnhancedModal
				isOpen={isOpen}
				onClose={onClose}
				onConfirmClose={handleConfirmClose}
				title={getModalTitle()}
				description={getModalDescription()}
				size="2xl"
				hasUnsavedChanges={hasUnsavedChanges}
				headerActions={headerActions}
			>
				<TransactionForm
					key={
						isOpen
							? `${transactionId ?? "new"}-${mode === "view" ? "edit" : mode}`
							: "closed"
					}
					transactionId={transactionId}
					mode={mode === "view" ? "edit" : mode}
					embedded
					onSubmit={handleFormSubmit}
					onCancel={handleFormCancel}
					onUnsavedChanges={handleUnsavedChanges}
					onSavingChange={handleSavingChange}
					onRegisterSaveDraft={handleRegisterSaveDraft}
				/>
			</EnhancedModal>

			<UnsavedChangesDialog
				isOpen={showUnsavedDialog}
				onConfirm={handleConfirmedClose}
				onCancel={handleCancelClose}
			/>
		</>
	);
}
