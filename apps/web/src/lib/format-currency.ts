/**
 * Portal currency: Malaysian Ringgit (RM).
 * Whole amounts omit decimals (e.g. RM1,360); otherwise up to 2 places.
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
		return new Intl.NumberFormat("en-MY", {
			style: "currency",
			currency: "MYR",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(0);
	}

	const rounded = Math.round(num * 100) / 100;
	const isWholeNumber = Math.abs(rounded - Math.trunc(rounded)) < 1e-9;

	return new Intl.NumberFormat("en-MY", {
		style: "currency",
		currency: "MYR",
		minimumFractionDigits: isWholeNumber ? 0 : 2,
		maximumFractionDigits: isWholeNumber ? 0 : 2,
	}).format(rounded);
}
