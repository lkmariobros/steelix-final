import { useCallback, useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";

interface UseKeyboardNavigationOptions {
	onEnter?: () => void;
	onSpace?: () => void;
	onEscape?: () => void;
	onArrowUp?: () => void;
	onArrowDown?: () => void;
	onArrowLeft?: () => void;
	onArrowRight?: () => void;
	preventDefault?: boolean;
	stopPropagation?: boolean;
}

export function useKeyboardNavigation(options: UseKeyboardNavigationOptions = {}) {
	const {
		onEnter,
		onSpace,
		onEscape,
		onArrowUp,
		onArrowDown,
		onArrowLeft,
		onArrowRight,
		preventDefault = true,
		stopPropagation = true,
	} = options;

	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLElement>) => {
			let handled = false;

			switch (event.key) {
				case "Enter":
					if (onEnter) {
						onEnter();
						handled = true;
					}
					break;
				case " ":
					if (onSpace) {
						onSpace();
						handled = true;
					}
					break;
				case "Escape":
					if (onEscape) {
						onEscape();
						handled = true;
					}
					break;
				case "ArrowUp":
					if (onArrowUp) {
						onArrowUp();
						handled = true;
					}
					break;
				case "ArrowDown":
					if (onArrowDown) {
						onArrowDown();
						handled = true;
					}
					break;
				case "ArrowLeft":
					if (onArrowLeft) {
						onArrowLeft();
						handled = true;
					}
					break;
				case "ArrowRight":
					if (onArrowRight) {
						onArrowRight();
						handled = true;
					}
					break;
			}

			if (handled) {
				if (preventDefault) event.preventDefault();
				if (stopPropagation) event.stopPropagation();
			}
		},
		[
			onEnter,
			onSpace,
			onEscape,
			onArrowUp,
			onArrowDown,
			onArrowLeft,
			onArrowRight,
			preventDefault,
			stopPropagation,
		]
	);

	return { handleKeyDown };
}

// Hook for managing focus within a component
export function useFocusManagement() {
	const containerRef = useRef<HTMLElement>(null);

	const focusFirst = useCallback(() => {
		if (!containerRef.current) return;
		
		const focusableElements = containerRef.current.querySelectorAll(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
		);
		
		const firstElement = focusableElements[0] as HTMLElement;
		if (firstElement) {
			firstElement.focus();
		}
	}, []);

	const focusLast = useCallback(() => {
		if (!containerRef.current) return;
		
		const focusableElements = containerRef.current.querySelectorAll(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
		);
		
		const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
		if (lastElement) {
			lastElement.focus();
		}
	}, []);

	const trapFocus = useCallback((event: globalThis.KeyboardEvent) => {
		if (event.key !== "Tab" || !containerRef.current) return;

		const focusableElements = containerRef.current.querySelectorAll(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
		);

		const firstElement = focusableElements[0] as HTMLElement;
		const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

		if (event.shiftKey) {
			if (document.activeElement === firstElement) {
				event.preventDefault();
				lastElement.focus();
			}
		} else {
			if (document.activeElement === lastElement) {
				event.preventDefault();
				firstElement.focus();
			}
		}
	}, []);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		container.addEventListener("keydown", trapFocus);
		return () => container.removeEventListener("keydown", trapFocus);
	}, [trapFocus]);

	return {
		containerRef,
		focusFirst,
		focusLast,
		trapFocus,
	};
}
