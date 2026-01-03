"use client";

import { useEffect, useState } from "react";

/**
 * Simple hook to detect client-side rendering
 * Prevents hydration mismatches with minimal complexity
 */
export function useClientSide(): boolean {
	const [isClient, setIsClient] = useState(false);

	useEffect(() => {
		setIsClient(true);
	}, []);

	return isClient;
}

/**
 * Hook that returns true only after the component has mounted
 * and the DOM is fully ready. More robust than useClientSide
 * for components that need to interact with the DOM.
 */
export function useMounted(): boolean {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	return mounted;
}
