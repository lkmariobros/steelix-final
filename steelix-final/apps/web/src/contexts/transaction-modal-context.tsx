"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type TransactionModalMode = "create" | "edit" | "view" | "resume";

interface TransactionModalState {
	isOpen: boolean;
	mode: TransactionModalMode;
	transactionId?: string;
}

interface TransactionModalContextType {
	// State
	isOpen: boolean;
	mode: TransactionModalMode;
	transactionId?: string;
	
	// Actions
	openModal: (mode: TransactionModalMode, transactionId?: string) => void;
	closeModal: () => void;
	
	// Convenience methods
	openCreateModal: () => void;
	openEditModal: (transactionId: string) => void;
	openViewModal: (transactionId: string) => void;
	openResumeModal: () => void;
}

const TransactionModalContext = createContext<TransactionModalContextType | undefined>(undefined);

interface TransactionModalProviderProps {
	children: ReactNode;
}

export function TransactionModalProvider({ children }: TransactionModalProviderProps) {
	const [state, setState] = useState<TransactionModalState>({
		isOpen: false,
		mode: "create",
		transactionId: undefined,
	});

	// ✅ Wrap in useCallback to prevent recreation
	const openModal = useCallback((mode: TransactionModalMode, transactionId?: string) => {
		setState({
			isOpen: true,
			mode,
			transactionId,
		});
	}, []);

	const closeModal = useCallback(() => {
		setState(prev => ({
			...prev,
			isOpen: false,
		}));
	}, []);

	// ✅ Wrap convenience methods too
	const openCreateModal = useCallback(() => openModal("create"), [openModal]);
	const openEditModal = useCallback((transactionId: string) => openModal("edit", transactionId), [openModal]);
	const openViewModal = useCallback((transactionId: string) => openModal("view", transactionId), [openModal]);
	const openResumeModal = useCallback(() => openModal("resume"), [openModal]);

	const contextValue: TransactionModalContextType = {
		// State
		isOpen: state.isOpen,
		mode: state.mode,
		transactionId: state.transactionId,
		
		// Actions
		openModal,
		closeModal,
		
		// Convenience methods
		openCreateModal,
		openEditModal,
		openViewModal,
		openResumeModal,
	};

	return (
		<TransactionModalContext.Provider value={contextValue}>
			{children}
		</TransactionModalContext.Provider>
	);
}

export function useTransactionModal() {
	const context = useContext(TransactionModalContext);
	if (context === undefined) {
		throw new Error("useTransactionModal must be used within a TransactionModalProvider");
	}
	return context;
}

// Hook for components that just need to trigger the modal (lightweight)
export function useTransactionModalActions() {
	const { openCreateModal, openEditModal, openViewModal } = useTransactionModal();
	return {
		openCreateModal,
		openEditModal,
		openViewModal,
	};
}

// Convenience hook for quick transaction creation
export function useCreateTransaction() {
	const { openCreateModal } = useTransactionModal();
	return openCreateModal;
}
