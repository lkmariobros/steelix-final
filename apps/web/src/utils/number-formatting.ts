/**
 * Production-safe number formatting utilities
 * Handles edge cases that can cause runtime errors in production builds
 */

/**
 * Safely format a number to fixed decimal places
 * Handles null, undefined, string, and invalid number cases
 */
export function safeToFixed(value: unknown, decimals = 1): string {
	// Handle null, undefined, or invalid values
	if (value === null || value === undefined) {
		return "0".padEnd(decimals + 2, ".0");
	}

	// Convert to number if it's a string
	const numValue = typeof value === "string" ? parseFloat(value) : Number(value);

	// Check if the conversion resulted in a valid number
	if (isNaN(numValue) || typeof numValue !== 'number') {
		return "0".padEnd(decimals + 2, ".0");
	}

	return numValue.toFixed(decimals);
}

/**
 * Safely format a percentage with proper validation
 */
export function safeFormatPercentage(value: unknown, decimals = 1): string {
	const fixedValue = safeToFixed(value, decimals);
	return `${fixedValue}%`;
}

/**
 * Safely format currency with proper validation
 */
export function safeFormatCurrency(amount: unknown, currency = "USD"): string {
	// Handle null, undefined, or invalid values
	if (amount === null || amount === undefined) {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency,
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(0);
	}

	// Convert to number if it's a string
	const numAmount = typeof amount === "string" ? parseFloat(amount) : Number(amount);

	// Check if the conversion resulted in a valid number
	if (isNaN(numAmount) || typeof numAmount !== 'number') {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency,
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(0);
	}

	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(numAmount);
}

/**
 * Safely convert any value to a number with fallback
 */
export function safeToNumber(value: unknown, fallback = 0): number {
	if (value === null || value === undefined) {
		return fallback;
	}

	const numValue = typeof value === "string" ? parseFloat(value) : Number(value);

	if (isNaN(numValue) || typeof numValue !== 'number') {
		return fallback;
	}

	return numValue;
}

/**
 * Safely calculate percentage with division by zero protection
 */
export function safeCalculatePercentage(numerator: unknown, denominator: unknown): number {
	const num = safeToNumber(numerator, 0);
	const den = safeToNumber(denominator, 1);

	if (den === 0) {
		return 0;
	}

	return (num / den) * 100;
}
