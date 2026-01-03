"use client";

import { useTransactionModal } from "@/contexts/transaction-modal-context";
import { TransactionFormModal } from "@/features/sales-entry/transaction-form-modal";
import { toast } from "sonner";
import { useEffect } from "react";

/**
 * Global Transaction Modal Component
 *
 * This component renders the transaction modal at the app level,
 * making it available from anywhere in the application without
 * being tied to specific page contexts.
 */
export function GlobalTransactionModal() {
	const { isOpen, mode, transactionId, closeModal } = useTransactionModal();

	// Debug: Log when isOpen changes
	useEffect(() => {
		console.log("[GlobalTransactionModal] isOpen changed:", isOpen, "mode:", mode);
	}, [isOpen, mode]);

	const handleSubmit = () => {
		// Show success message based on mode
		const messages = {
			create: "Transaction created successfully!",
			edit: "Transaction updated successfully!",
			view: "Transaction viewed",
			resume: "Transaction resumed successfully!",
		};

		toast.success(messages[mode]);
		closeModal();
	};

	const handleClose = () => {
		closeModal();
	};

	// ✅ Removed client check to prevent hydration mismatch
	return (
		<TransactionFormModal
			isOpen={isOpen}
			onClose={handleClose}
			transactionId={transactionId}
			onSubmit={handleSubmit}
			mode={mode}
		/>
	);
}
