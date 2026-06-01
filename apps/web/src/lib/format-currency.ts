/**
 * Formats a monetary amount: up to 2 decimal places when needed;
 * whole amounts render without a fractional part (e.g. $1,360 not $1,360.00).
 */
export function formatCurrency(
	amount: number | string | null | undefined,
): string {
	const num =
		amount === null || amount === undefined
			? 0
			: typeof amount === "string"
				? Number.parseFloat(amount)
				: amount;

	if (!Number.isFinite(num)) {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(0);
	}

	const rounded = Math.round(num * 100) / 100;
	const isWholeNumber =
		Math.abs(rounded - Math.trunc(rounded)) < 1e-9;

	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: isWholeNumber ? 0 : 2,
		maximumFractionDigits: isWholeNumber ? 0 : 2,
	}).format(rounded);
}
