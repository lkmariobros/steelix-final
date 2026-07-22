"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
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
	size?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
	showCloseButton?: boolean;
	closeOnEscape?: boolean;
	closeOnBackdropClick?: boolean;
	hasUnsavedChanges?: boolean;
	/** Extra controls rendered in the sticky header (before close). */
	headerActions?: ReactNode;
}

const sizeClasses = {
	sm: "max-w-md",
	md: "max-w-lg",
	lg: "max-w-2xl",
	xl: "max-w-4xl",
	"2xl": "max-w-5xl",
	full: "max-w-[95vw] sm:max-w-[92vw]",
};

function ModalHeader({
	title,
	description,
	headerActions,
	showCloseButton,
	onClose,
}: {
	title?: string;
	description?: string;
	headerActions?: ReactNode;
	showCloseButton: boolean;
	onClose: () => void;
}) {
	if (!title && !showCloseButton && !headerActions) return null;

	return (
		<div className="flex shrink-0 items-start justify-between gap-3 border-b bg-background px-5 py-4">
			<div className="min-w-0 flex-1">
				{title ? (
					<h2 className="font-semibold text-lg leading-tight tracking-tight">
						{title}
					</h2>
				) : null}
				{description ? (
					<p className="mt-1 text-muted-foreground text-sm">{description}</p>
				) : null}
			</div>
			<div className="flex shrink-0 items-center gap-2">
				{headerActions}
				{showCloseButton ? (
					<Button
						variant="ghost"
						size="sm"
						onClick={onClose}
						className="h-8 w-8 p-0 hover:bg-muted"
					>
						<X className="h-4 w-4" />
						<span className="sr-only">Close</span>
					</Button>
				) : null}
			</div>
		</div>
	);
}

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
	headerActions,
}: EnhancedModalProps) {
	const modalRef = useRef<HTMLDivElement>(null);
	const isClient = useClientSide();

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

	const handleBackdropClick = useCallback(
		(event: React.MouseEvent) => {
			if (!closeOnBackdropClick) return;

			if (event.target === event.currentTarget) {
				handleClose();
			}
		},
		[closeOnBackdropClick, handleClose],
	);

	useEffect(() => {
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

	const panelClassName = `
		relative flex w-full flex-col overflow-hidden
		${sizeClasses[size]}
		max-h-[90vh]
		bg-background rounded-lg border shadow-2xl
		${className}
	`;

	const header = (
		<ModalHeader
			title={title}
			description={description}
			headerActions={headerActions}
			showCloseButton={showCloseButton}
			onClose={handleClose}
		/>
	);

	if (!isClient) {
		return isOpen ? (
			<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
				<div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
				<div className={panelClassName}>
					{header}
					<div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
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
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.3, ease: "easeOut" }}
						className="absolute inset-0 bg-black/60 backdrop-blur-sm"
					/>

					<motion.div
						ref={modalRef}
						initial={{ opacity: 0, scale: 0.95, y: 20 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: 20 }}
						transition={{
							duration: 0.3,
							ease: [0.16, 1, 0.3, 1],
							type: "spring",
							damping: 25,
							stiffness: 300,
						}}
						className={panelClassName}
						onClick={(e) => e.stopPropagation()}
					>
						{header}
						<div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}

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
						You have unsaved changes. Are you sure you want to close without
						saving?
					</DialogDescription>
				</DialogHeader>
				<div className="mt-4 flex justify-end gap-2">
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
