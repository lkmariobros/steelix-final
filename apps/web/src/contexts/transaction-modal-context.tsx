"use client";

import {
	clearRememberedTransactionDraftId,
	getRememberedTransactionDraftId,
} from "@/features/sales-entry/draft-persistence";
import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useState,
} from "react";

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
	/** Opens create, or resumes the last saved draft after refresh (unless forceNew). */
	openCreateModal: (opts?: { forceNew?: boolean }) => void;
	openEditModal: (transactionId: string) => void;
	openViewModal: (transactionId: string) => void;
	openResumeModal: (transactionId?: string) => void;
}

const TransactionModalContext = createContext<
	TransactionModalContextType | undefined
>(undefined);

interface TransactionModalProviderProps {
	children: ReactNode;
}

export function TransactionModalProvider({
	children,
}: TransactionModalProviderProps) {
	const [state, setState] = useState<TransactionModalState>({
		isOpen: false,
		mode: "create",
		transactionId: undefined,
	});

	const openModal = useCallback(
		(mode: TransactionModalMode, transactionId?: string) => {
			setState({
				isOpen: true,
				mode,
				transactionId,
			});
		},
		[],
	);

	const closeModal = useCallback(() => {
		setState((prev) => ({
			...prev,
			isOpen: false,
		}));
	}, []);

	const openCreateModal = useCallback(
		(opts?: { forceNew?: boolean }) => {
			if (opts?.forceNew) {
				clearRememberedTransactionDraftId();
				openModal("create");
				return;
			}
			const draftId = getRememberedTransactionDraftId();
			if (draftId) {
				openModal("resume", draftId);
				return;
			}
			openModal("create");
		},
		[openModal],
	);

	const openEditModal = useCallback(
		(transactionId: string) => openModal("edit", transactionId),
		[openModal],
	);
	const openViewModal = useCallback(
		(transactionId: string) => openModal("view", transactionId),
		[openModal],
	);
	const openResumeModal = useCallback(
		(transactionId?: string) => {
			const id =
				transactionId ?? getRememberedTransactionDraftId() ?? undefined;
			if (id) openModal("resume", id);
			else openModal("create");
		},
		[openModal],
	);

	const contextValue: TransactionModalContextType = {
		isOpen: state.isOpen,
		mode: state.mode,
		transactionId: state.transactionId,
		openModal,
		closeModal,
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
		throw new Error(
			"useTransactionModal must be used within a TransactionModalProvider",
		);
	}
	return context;
}

// Hook for components that just need to trigger the modal (lightweight)
export function useTransactionModalActions() {
	const { openCreateModal, openEditModal, openViewModal, openResumeModal } =
		useTransactionModal();
	return {
		openCreateModal,
		openEditModal,
		openViewModal,
		openResumeModal,
	};
}

// Convenience hook for quick transaction creation
export function useCreateTransaction() {
	const { openCreateModal } = useTransactionModal();
	return openCreateModal;
}
