"use client";

import { Button } from "@/components/ui/button";
import { useTransactionModalActions } from "@/contexts/transaction-modal-context";
import { Plus, Edit, Eye } from "lucide-react";

/**
 * Example component showing how easy it is to use the global transaction modal
 * from any component without being tied to page context.
 * 
 * This component can be dropped anywhere in the app and will work independently.
 */
export function TransactionQuickActions() {
	const { openCreateModal, openEditModal, openViewModal } = useTransactionModalActions();

	return (
		<div className="flex items-center gap-2">
			<Button 
				onClick={openCreateModal}
				size="sm"
				className="flex items-center gap-2"
			>
				<Plus className="h-4 w-4" />
				New Transaction
			</Button>
			
			<Button 
				variant="outline"
				onClick={() => openEditModal("example-id")}
				size="sm"
				className="flex items-center gap-2"
			>
				<Edit className="h-4 w-4" />
				Edit Sample
			</Button>
			
			<Button 
				variant="ghost"
				onClick={() => openViewModal("example-id")}
				size="sm"
				className="flex items-center gap-2"
			>
				<Eye className="h-4 w-4" />
				View Sample
			</Button>
		</div>
	);
}

/**
 * Even simpler component - just a create button
 */
export function CreateTransactionButton({ 
	children = "New Transaction",
	variant = "default" as const,
	size = "default" as const,
	className = "",
}) {
	const { openCreateModal } = useTransactionModalActions();

	return (
		<Button 
			onClick={openCreateModal}
			variant={variant}
			size={size}
			className={className}
		>
			{children}
		</Button>
	);
}
