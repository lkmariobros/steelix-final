"use client";

import { useCallback, useState } from "react";
import { EnhancedModal, UnsavedChangesDialog } from "@/components/enhanced-modal";
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

	// Handle close confirmation
	const handleConfirmClose = useCallback(async (): Promise<boolean> => {
		if (hasUnsavedChanges) {
			setShowUnsavedDialog(true);
			return false; // Don't close yet, wait for user confirmation
		}
		return true; // No unsaved changes, safe to close
	}, [hasUnsavedChanges]);

	// Handle confirmed close (user chose to discard changes)
	const handleConfirmedClose = useCallback(() => {
		setShowUnsavedDialog(false);
		setHasUnsavedChanges(false);
		onClose();
	}, [onClose]);

	// Handle cancel close (user wants to keep editing)
	const handleCancelClose = useCallback(() => {
		setShowUnsavedDialog(false);
	}, []);

	// Handle successful form submission
	const handleFormSubmit = useCallback(() => {
		setHasUnsavedChanges(false);
		onSubmit?.();
		onClose();
	}, [onSubmit, onClose]);

	// Handle form cancellation
	const handleFormCancel = useCallback(() => {
		if (hasUnsavedChanges) {
			setShowUnsavedDialog(true);
		} else {
			onClose();
		}
	}, [hasUnsavedChanges, onClose]);

	// Stable callback for unsaved changes
	const handleUnsavedChanges = useCallback((hasChanges: boolean) => {
		setHasUnsavedChanges(hasChanges);
	}, []);

	const getModalTitle = () => {
		switch (mode) {
			case "create":
				return "New Sales Transaction";
			case "edit":
				return "Edit Transaction";
			case "view":
				return "View Transaction";
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
			default:
				return "";
		}
	};

	return (
		<>
			<EnhancedModal
				isOpen={isOpen}
				onClose={onClose}
				onConfirmClose={handleConfirmClose}
				title={getModalTitle()}
				description={getModalDescription()}
				size="full"
				hasUnsavedChanges={hasUnsavedChanges}
				className="mx-4"
			>
				<div className="p-6">
					<TransactionForm
						transactionId={transactionId}
						mode={mode === "view" ? "edit" : mode} // Map view to edit for form compatibility
						onSubmit={handleFormSubmit}
						onCancel={handleFormCancel}
						onUnsavedChanges={handleUnsavedChanges}
					/>
				</div>
			</EnhancedModal>

			<UnsavedChangesDialog
				isOpen={showUnsavedDialog}
				onConfirm={handleConfirmedClose}
				onCancel={handleCancelClose}
			/>
		</>
	);
}
