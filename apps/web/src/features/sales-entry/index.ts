// Main components
export { TransactionForm } from "./transaction-form";
export { TransactionFormModal } from "./transaction-form-modal";

// Step components
export { StepInitiation } from "./steps/step-1-initiation";
export { StepProperty } from "./steps/step-2-property";
export { StepClient } from "./steps/step-3-client";
export { StepCoBroking } from "./steps/step-4-co-broking";
export { StepCommission } from "./steps/step-5-commission";
export { StepDocuments } from "./steps/step-6-documents";
export { StepReview } from "./steps/step-7-review";

// Schema and types
export * from "./transaction-schema";

// Utilities
export * from "./utils/form-state";
export {
	calculateDetailedCommission,
	formatCurrency,
	formatPercentage,
	calculateCommissionRate,
	validateCommissionInput,
	calculateEstimatedTaxes,
	generateCommissionSummary,
	getSuggestedCommissionRate,
	COMMON_COMMISSION_RATES,
} from "./utils/calculations";
