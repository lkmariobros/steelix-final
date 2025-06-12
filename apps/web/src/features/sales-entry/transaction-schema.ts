import { z } from "zod";

// Step 1: Initiation Schema
export const initiationSchema = z.object({
	marketType: z.enum(["primary", "secondary"], {
		required_error: "Please select a market type",
	}),
	transactionType: z.enum(["sale", "lease", "rental"], {
		required_error: "Please select a transaction type",
	}),
	transactionDate: z.date({
		required_error: "Please select a transaction date",
	}),
});

// Step 2: Property Schema
export const propertySchema = z.object({
	address: z.string().min(1, "Property address is required"),
	propertyType: z.string().min(1, "Property type is required"),
	bedrooms: z.number().min(0).optional(),
	bathrooms: z.number().min(0).optional(),
	area: z.number().min(0).optional(),
	price: z.number().min(1, "Property price must be greater than 0"),
	description: z.string().optional(),
});

// Step 3: Client Schema
export const clientSchema = z.object({
	name: z.string().min(1, "Client name is required"),
	email: z.string().email("Please enter a valid email address"),
	phone: z.string().min(1, "Phone number is required"),
	type: z.enum(["buyer", "seller", "tenant", "landlord"], {
		required_error: "Please select client type",
	}),
	source: z.string().min(1, "Client source is required"),
	notes: z.string().optional(),
});

// Step 4: Co-Broking Schema
const coBrokingBaseSchema = z.object({
	isCoBroking: z.boolean(),
	coBrokingData: z
		.object({
			agentName: z.string().min(1, "Co-broking agent name is required"),
			agencyName: z.string().min(1, "Co-broking agency name is required"),
			commissionSplit: z
				.number()
				.min(0)
				.max(100, "Commission split must be between 0-100%"),
			contactInfo: z.string().min(1, "Contact information is required"),
		})
		.optional(),
});

export const coBrokingSchema = coBrokingBaseSchema.refine(
	(data) => {
		// If co-broking is enabled, require the co-broking data
		if (data.isCoBroking) {
			return (
				data.coBrokingData?.agentName &&
				data.coBrokingData.agencyName &&
				data.coBrokingData.contactInfo &&
				data.coBrokingData.commissionSplit >= 0
			);
		}
		return true;
	},
	{
		message: "Co-broking details are required when co-broking is enabled",
		path: ["coBrokingData"],
	},
);

// Step 5: Commission Schema
export const commissionSchema = z.object({
	commissionType: z.enum(["percentage", "fixed"], {
		required_error: "Please select commission type",
	}),
	commissionValue: z.number().min(0, "Commission value must be positive"),
	commissionAmount: z.number().min(0, "Commission amount must be positive"),
});

// Step 6: Documents Schema
export const documentsSchema = z.object({
	documents: z
		.array(
			z.object({
				id: z.string(),
				name: z.string(),
				type: z.string(),
				url: z.string(),
				uploadedAt: z.string(),
			}),
		)
		.optional(),
	notes: z.string().optional(),
});

// Complete Transaction Schema (all steps combined)
export const completeTransactionSchema = z.object({
	// Step 1: Initiation
	...initiationSchema.shape,

	// Step 2: Property
	propertyData: propertySchema,

	// Step 3: Client
	clientData: clientSchema,

	// Step 4: Co-Broking
	...coBrokingBaseSchema.shape,

	// Step 5: Commission
	...commissionSchema.shape,

	// Step 6: Documents
	...documentsSchema.shape,
});

// Individual step schemas for validation
export const stepSchemas = {
	1: initiationSchema,
	2: propertySchema,
	3: clientSchema,
	4: coBrokingSchema,
	5: commissionSchema,
	6: documentsSchema,
	7: z.object({}), // Review step has no additional validation
} as const;

// TypeScript types
export type InitiationData = z.infer<typeof initiationSchema>;
export type PropertyData = z.infer<typeof propertySchema>;
export type ClientData = z.infer<typeof clientSchema>;
export type CoBrokingData = z.infer<typeof coBrokingSchema>;
export type CommissionData = z.infer<typeof commissionSchema>;
export type DocumentsData = z.infer<typeof documentsSchema>;
export type CompleteTransactionData = z.infer<typeof completeTransactionSchema>;

// Form step type
export type FormStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// Transaction status types
export type TransactionStatus =
	| "draft"
	| "submitted"
	| "under_review"
	| "approved"
	| "rejected"
	| "completed";

// Market and transaction type options
export const marketTypeOptions = [
	{ value: "primary", label: "Primary Market" },
	{ value: "secondary", label: "Secondary Market" },
] as const;

export const transactionTypeOptions = [
	{ value: "sale", label: "Sale" },
	{ value: "lease", label: "Lease" },
	{ value: "rental", label: "Rental" },
] as const;

export const clientTypeOptions = [
	{ value: "buyer", label: "Buyer" },
	{ value: "seller", label: "Seller" },
	{ value: "tenant", label: "Tenant" },
	{ value: "landlord", label: "Landlord" },
] as const;

export const commissionTypeOptions = [
	{ value: "percentage", label: "Percentage" },
	{ value: "fixed", label: "Fixed Amount" },
] as const;

export const propertyTypeOptions = [
	{ value: "apartment", label: "Apartment" },
	{ value: "house", label: "House" },
	{ value: "condo", label: "Condominium" },
	{ value: "townhouse", label: "Townhouse" },
	{ value: "commercial", label: "Commercial" },
	{ value: "land", label: "Land" },
	{ value: "other", label: "Other" },
] as const;

export const clientSourceOptions = [
	{ value: "referral", label: "Referral" },
	{ value: "website", label: "Website" },
	{ value: "social_media", label: "Social Media" },
	{ value: "walk_in", label: "Walk-in" },
	{ value: "phone_call", label: "Phone Call" },
	{ value: "advertisement", label: "Advertisement" },
	{ value: "other", label: "Other" },
] as const;

// Step configuration
export const stepConfig = [
	{ step: 1, title: "Initiation", description: "Basic transaction details" },
	{ step: 2, title: "Property", description: "Property information" },
	{ step: 3, title: "Client", description: "Client details" },
	{ step: 4, title: "Co-Broking", description: "Co-broking arrangement" },
	{ step: 5, title: "Commission", description: "Commission calculation" },
	{ step: 6, title: "Documents", description: "Upload documents" },
	{ step: 7, title: "Review", description: "Review and submit" },
] as const;

// Helper functions
export function getStepTitle(step: FormStep): string {
	return stepConfig[step - 1].title;
}

export function getStepDescription(step: FormStep): string {
	return stepConfig[step - 1].description;
}

export function isStepValid(
	step: FormStep,
	data: Partial<CompleteTransactionData>,
): boolean {
	try {
		if (step === 7) return true; // Review step is always valid if we reach it

		const schema = stepSchemas[step];
		if (step === 2) {
			schema.parse(data.propertyData);
		} else if (step === 3) {
			schema.parse(data.clientData);
		} else {
			schema.parse(data);
		}
		return true;
	} catch {
		return false;
	}
}

export function calculateCommission(
	propertyPrice: number,
	commissionType: "percentage" | "fixed",
	commissionValue: number,
): number {
	if (commissionType === "percentage") {
		return (propertyPrice * commissionValue) / 100;
	}
	return commissionValue;
}
