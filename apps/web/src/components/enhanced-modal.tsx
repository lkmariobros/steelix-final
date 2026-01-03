"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { useClientSide } from "@/hooks/use-client-side";
import { Button } from "./ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog";

interface EnhancedModalProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirmClose?: () => Promise<boolean> | boolean;
	title?: string;
	description?: string;
	children: React.ReactNode;
	className?: string;
	size?: "sm" | "md" | "lg" | "xl" | "full";
	showCloseButton?: boolean;
	closeOnEscape?: boolean;
	closeOnBackdropClick?: boolean;
	hasUnsavedChanges?: boolean;
}

const sizeClasses = {
	sm: "max-w-md",
	md: "max-w-lg",
	lg: "max-w-2xl",
	xl: "max-w-4xl",
	full: "max-w-[95vw] max-h-[95vh] sm:max-w-[90vw] sm:max-h-[90vh]",
};

export function EnhancedModal({
	isOpen,
	onClose,
	onConfirmClose,
	title,
	description,
	children,
	className = "",
	size = "xl",
	showCloseButton = true,
	closeOnEscape = true,
	closeOnBackdropClick = true,
	hasUnsavedChanges = false,
}: EnhancedModalProps) {
	const modalRef = useRef<HTMLDivElement>(null);
	const isClient = useClientSide();

	// Debug: Log modal state
	console.log("[EnhancedModal] isOpen:", isOpen, "isClient:", isClient, "title:", title);

	// Handle close with confirmation if there are unsaved changes
	const handleClose = useCallback(async () => {
		if (hasUnsavedChanges && onConfirmClose) {
			const shouldClose = await onConfirmClose();
			if (shouldClose) {
				onClose();
			}
		} else {
			onClose();
		}
	}, [hasUnsavedChanges, onConfirmClose, onClose]);

	// Handle ESC key
	useEffect(() => {
		if (!closeOnEscape) return;

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape" && isOpen) {
				event.preventDefault();
				handleClose();
			}
		};

		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [isOpen, closeOnEscape, handleClose]);

	// Handle backdrop click
	const handleBackdropClick = useCallback(
		(event: React.MouseEvent) => {
			if (!closeOnBackdropClick) return;
			
			if (event.target === event.currentTarget) {
				handleClose();
			}
		},
		[closeOnBackdropClick, handleClose]
	);

	// Prevent body scroll when modal is open (client-side only)
	useEffect(() => {
		// Ensure we're on the client side
		if (typeof window === "undefined") return;

		if (isOpen) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "unset";
		}

		return () => {
			document.body.style.overflow = "unset";
		};
	}, [isOpen]);

	// Render without animations on server, with animations on client
	if (!isClient) {
		return isOpen ? (
			<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
				<div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
				<div className={`relative w-full ${sizeClasses[size]} max-h-[90vh] overflow-hidden bg-background rounded-lg border shadow-2xl ${className}`}>
					{(title || showCloseButton) && (
						<div className="flex items-center justify-between border-b p-6 pb-4">
							<div>
								{title && <h2 className="text-lg font-semibold leading-none tracking-tight">{title}</h2>}
								{description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
							</div>
							{showCloseButton && (
								<Button variant="ghost" size="sm" onClick={handleClose} className="h-8 w-8 p-0 hover:bg-muted">
									<X className="h-4 w-4" />
									<span className="sr-only">Close</span>
								</Button>
							)}
						</div>
					)}
					<div className="overflow-y-auto max-h-[calc(90vh-8rem)] sm:max-h-[calc(85vh-8rem)]">
						{children}
					</div>
				</div>
			</div>
		) : null;
	}

	return (
		<AnimatePresence mode="wait">
			{isOpen && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.2, ease: "easeOut" }}
					className="fixed inset-0 z-50 flex items-center justify-center p-4"
					onClick={handleBackdropClick}
				>
					{/* Backdrop with blur */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.3, ease: "easeOut" }}
						className="absolute inset-0 bg-black/50 backdrop-blur-sm"
					/>

					{/* Modal Content */}
					<motion.div
						ref={modalRef}
						initial={{ opacity: 0, scale: 0.95, y: 20 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: 20 }}
						transition={{ 
							duration: 0.3, 
							ease: [0.16, 1, 0.3, 1], // Custom easing for smooth feel
							type: "spring",
							damping: 25,
							stiffness: 300
						}}
						className={`
							relative w-full ${sizeClasses[size]} 
							max-h-[90vh] overflow-hidden
							bg-background rounded-lg border shadow-2xl
							${className}
						`}
						onClick={(e) => e.stopPropagation()}
					>
						{/* Header */}
						{(title || showCloseButton) && (
							<div className="flex items-center justify-between border-b p-6 pb-4">
								<div>
									{title && (
										<h2 className="text-lg font-semibold leading-none tracking-tight">
											{title}
										</h2>
									)}
									{description && (
										<p className="text-sm text-muted-foreground mt-1">
											{description}
										</p>
									)}
								</div>
								{showCloseButton && (
									<Button
										variant="ghost"
										size="sm"
										onClick={handleClose}
										className="h-8 w-8 p-0 hover:bg-muted"
									>
										<X className="h-4 w-4" />
										<span className="sr-only">Close</span>
									</Button>
								)}
							</div>
						)}

						{/* Content */}
						<div className="overflow-y-auto max-h-[calc(90vh-8rem)] sm:max-h-[calc(85vh-8rem)]">
							{children}
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}

// Confirmation dialog for unsaved changes
export function UnsavedChangesDialog({
	isOpen,
	onConfirm,
	onCancel,
}: {
	isOpen: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}) {
	return (
		<Dialog open={isOpen} onOpenChange={onCancel}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Unsaved Changes</DialogTitle>
					<DialogDescription>
						You have unsaved changes. Are you sure you want to close without saving?
					</DialogDescription>
				</DialogHeader>
				<div className="flex justify-end gap-2 mt-4">
					<Button variant="outline" onClick={onCancel}>
						Cancel
					</Button>
					<Button variant="destructive" onClick={onConfirm}>
						Close Without Saving
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
