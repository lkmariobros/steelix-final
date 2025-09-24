/**
 * Commission calculation utilities for real estate transactions
 */

export interface CommissionCalculation {
	baseAmount: number;
	commissionRate: number;
	commissionAmount: number;
	netAmount: number;
	coBrokingSplit?: {
		agentAmount: number;
		coBrokerAmount: number;
		agentPercentage: number;
		coBrokerPercentage: number;
	};
}

/**
 * Calculate commission based on property price and commission type
 */
export function calculateCommission(
	propertyPrice: number,
	commissionType: "percentage" | "fixed",
	commissionValue: number,
): number {
	if (propertyPrice <= 0 || commissionValue <= 0) {
		return 0;
	}

	if (commissionType === "percentage") {
		return (propertyPrice * commissionValue) / 100;
	}

	return commissionValue;
}

/**
 * Calculate detailed commission breakdown including co-broking split
 */
export function calculateDetailedCommission(
	propertyPrice: number,
	commissionType: "percentage" | "fixed",
	commissionValue: number,
	isCoBroking = false,
	coBrokingSplit = 50,
): CommissionCalculation {
	const commissionAmount = calculateCommission(
		propertyPrice,
		commissionType,
		commissionValue,
	);

	const result: CommissionCalculation = {
		baseAmount: propertyPrice,
		commissionRate:
			commissionType === "percentage"
				? commissionValue
				: (commissionValue / propertyPrice) * 100,
		commissionAmount,
		netAmount: propertyPrice - commissionAmount,
	};

	if (isCoBroking && coBrokingSplit > 0 && coBrokingSplit < 100) {
		const coBrokerAmount = (commissionAmount * coBrokingSplit) / 100;
		const agentAmount = commissionAmount - coBrokerAmount;

		result.coBrokingSplit = {
			agentAmount,
			coBrokerAmount,
			agentPercentage: 100 - coBrokingSplit,
			coBrokerPercentage: coBrokingSplit,
		};
	}

	return result;
}

/**
 * Format currency amount for display
 */
export function formatCurrency(amount: number, currency = "USD"): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amount);
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number | string | null | undefined, decimals = 1): string {
	// Handle null, undefined, or invalid values
	if (value === null || value === undefined) {
		return "0.0%";
	}

	// Convert to number if it's a string
	const numValue = typeof value === "string" ? parseFloat(value) : value;

	// Check if the conversion resulted in a valid number
	if (isNaN(numValue) || typeof numValue !== 'number') {
		return "0.0%";
	}

	return `${numValue.toFixed(decimals)}%`;
}

/**
 * Calculate commission rate as percentage of property price
 */
export function calculateCommissionRate(
	propertyPrice: number,
	commissionAmount: number,
): number {
	if (propertyPrice <= 0) return 0;
	return (commissionAmount / propertyPrice) * 100;
}

/**
 * Validate commission parameters
 */
export function validateCommissionInput(
	propertyPrice: number,
	commissionType: "percentage" | "fixed",
	commissionValue: number,
): { isValid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (propertyPrice <= 0) {
		errors.push("Property price must be greater than 0");
	}

	if (commissionValue <= 0) {
		errors.push("Commission value must be greater than 0");
	}

	if (commissionType === "percentage") {
		if (commissionValue > 100) {
			errors.push("Commission percentage cannot exceed 100%");
		}
		if (commissionValue > 20) {
			errors.push("Commission percentage seems unusually high (>20%)");
		}
	} else {
		if (commissionValue >= propertyPrice) {
			errors.push("Fixed commission cannot exceed property price");
		}
		const rate = calculateCommissionRate(propertyPrice, commissionValue);
		if (rate > 20) {
			errors.push("Commission rate seems unusually high (>20%)");
		}
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
}

/**
 * Calculate estimated taxes on commission (placeholder for future tax calculations)
 */
export function calculateEstimatedTaxes(
	commissionAmount: number,
	taxRate = 0.25,
): {
	grossCommission: number;
	estimatedTax: number;
	netCommission: number;
} {
	const estimatedTax = commissionAmount * taxRate;
	return {
		grossCommission: commissionAmount,
		estimatedTax,
		netCommission: commissionAmount - estimatedTax,
	};
}

/**
 * Generate commission summary text
 */
export function generateCommissionSummary(
	calculation: CommissionCalculation,
): string {
	const { baseAmount, commissionAmount, coBrokingSplit } = calculation;

	let summary = `Commission of ${formatCurrency(commissionAmount)} on property price of ${formatCurrency(baseAmount)}`;

	if (coBrokingSplit) {
		summary += `. Split: Agent ${formatCurrency(coBrokingSplit.agentAmount)} (${coBrokingSplit.agentPercentage}%), Co-broker ${formatCurrency(coBrokingSplit.coBrokerAmount)} (${coBrokingSplit.coBrokerPercentage}%)`;
	}

	return summary;
}

/**
 * Common commission rates for different property types (for suggestions)
 */
export const COMMON_COMMISSION_RATES = {
	residential: {
		sale: { min: 5, max: 7, typical: 6 },
		lease: { min: 8, max: 15, typical: 10 },
	},
	commercial: {
		sale: { min: 3, max: 10, typical: 6 },
		lease: { min: 3, max: 6, typical: 4 },
	},
} as const;

/**
 * Get suggested commission rate based on property and transaction type
 */
export function getSuggestedCommissionRate(
	propertyType: string,
	transactionType: string,
): number {
	const isCommercial = propertyType === "commercial";
	const isLease = transactionType === "lease" || transactionType === "rental";

	if (isCommercial) {
		return isLease
			? COMMON_COMMISSION_RATES.commercial.lease.typical
			: COMMON_COMMISSION_RATES.commercial.sale.typical;
	}

	return isLease
		? COMMON_COMMISSION_RATES.residential.lease.typical
		: COMMON_COMMISSION_RATES.residential.sale.typical;
}
