"use client";

import { useTransactionModal } from "@/contexts/transaction-modal-context";
import { TransactionFormModal } from "@/features/sales-entry/transaction-form-modal";
import { usePathname, useRouter } from "next/navigation";
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
	const router = useRouter();
	const pathname = usePathname();

	// View mode opens the dedicated detail page instead of the edit wizard
	useEffect(() => {
		if (!isOpen || mode !== "view" || !transactionId) return;
		closeModal();
		const base = pathname.startsWith("/admin")
			? `/admin/transactions/case/${transactionId}`
			: `/dashboard/transactions/${transactionId}`;
		router.push(base);
	}, [isOpen, mode, transactionId, closeModal, router, pathname]);

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
	if (mode === "view") {
		return null;
	}

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
