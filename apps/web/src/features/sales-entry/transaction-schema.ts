import { z } from "zod";

// Simplified Representation Type - 2 options only
// "direct" = Direct Representation (you represent your own client exclusively)
// "co_broking" = Co-Broking (working with another agent, splitting commission)
export const representationTypeEnum = z.enum(["direct", "co_broking"]);
export type RepresentationType = z.infer<typeof representationTypeEnum>;

// Step 1: Initiation Schema with Primary Market → Sale validation
export const initiationSchema = z.object({
	marketType: z.enum(["primary", "secondary"], {
		required_error: "Please select a market type",
	}),
	transactionType: z.enum(["sale", "lease"], {
		required_error: "Please select a transaction type",
	}),
	transactionDate: z.date({
		required_error: "Please select a transaction date",
	}),
}).refine(
	(data) => {
		// Primary market transactions must be sales
		if (data.marketType === "primary") {
			return data.transactionType === "sale";
		}
		return true;
	},
	{
		message: "Primary market transactions must be sales",
		path: ["transactionType"], // Target the error to the transaction type field
	}
);

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
// Note: isDualPartyDeal has been moved to unified representationType in Step 4
export const clientSchema = z.object({
	name: z.string().min(1, "Client name is required"),
	email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
	phone: z.string().min(1, "Phone number is required"),
	type: z.enum(["buyer", "seller", "tenant", "landlord"], {
		required_error: "Please select client type",
	}),
	source: z.string().min(1, "Client source is required"),
	notes: z.string().optional(),
});

// Step 4: Representation & Co-Broking Schema
// Simplified to 2 options: direct representation or co-broking
const coBrokingBaseSchema = z.object({
	// Simplified representation type - single source of truth (required field)
	representationType: representationTypeEnum,
	// Legacy field for backward compatibility (derived from representationType)
	isCoBroking: z.boolean().optional(),
	coBrokingData: z
		.object({
			// All fields are optional at base level - validation is done via refine based on representationType
			agentName: z.string().optional(),
			agencyName: z.string().optional(),
			commissionSplit: z
				.number()
				.min(0)
				.max(100, "Commission split must be between 0-100%")
				.optional(),
			// Separate email and phone fields for clarity (Issue #11)
			agentEmail: z.string().email("Please enter a valid email").optional().or(z.literal("")),
			agentPhone: z.string().optional(),
			// Legacy field for backward compatibility
			contactInfo: z.string().optional(),
		})
		.optional(),
});

// Create a more flexible co-broking schema that validates based on representation type
export const createCoBrokingSchema = () => {
	return coBrokingBaseSchema.superRefine((data, ctx) => {
		// If co-broking is selected, validate required fields
		if (data.representationType === "co_broking") {
			const { agentName, agencyName, agentPhone } = data.coBrokingData || {};

			if (!agentName?.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Agent name is required for co-broking transactions",
					path: ["coBrokingData", "agentName"],
				});
			}
			if (!agencyName?.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Agency name is required for co-broking transactions",
					path: ["coBrokingData", "agencyName"],
				});
			}
			if (!agentPhone?.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Phone number is required for co-broking transactions",
					path: ["coBrokingData", "agentPhone"],
				});
			}
		}
		// Direct representation doesn't require co-broking data - always valid
	});
};

// Default schema for backward compatibility
export const coBrokingSchema = createCoBrokingSchema();

// Step 5: Enhanced Commission Schema with agent tier support
// Note: representationType is passed from Step 4 for commission calculation display
export const commissionSchema = z.object({
	commissionType: z.enum(["percentage", "fixed"], {
		required_error: "Please select commission type",
	}),
	commissionValue: z.number().min(0, "Commission value must be positive"),
	commissionAmount: z.number().min(0, "Commission amount must be positive"),
	// Representation type for commission calculation display (from Step 4)
	representationType: representationTypeEnum.optional(),
	// Agent tier system fields
	agentTier: z.enum(["advisor", "sales_leader", "team_leader", "group_leader", "supreme_leader"]).optional(),
	companyCommissionSplit: z.number().min(0).max(100).optional(),
	// Commission breakdown for transparency (Issue #6 - clearer earnings display)
	breakdown: z.object({
		totalCommission: z.number(),
		agentCommissionShare: z.number(),
		coBrokerShare: z.number().optional(),
		companyShare: z.number(),
		agentEarnings: z.number(),
		// New: Explicit "Your Share" for clarity
		yourShare: z.number(),
		yourSharePercentage: z.number(),
	}).optional(),
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
				category: z.enum(['contract', 'identification', 'financial', 'miscellaneous']).optional(),
			}),
		)
		.optional(),
	notes: z.string().optional(),
	transactionId: z.string().optional(), // For linking to transaction
});

// Complete Transaction Schema (all steps combined) with Primary Market → Sale validation
export const completeTransactionSchema = z.object({
	// Step 1: Initiation
	marketType: z.enum(["primary", "secondary"], {
		required_error: "Please select a market type",
	}),
	transactionType: z.enum(["sale", "lease"], {
		required_error: "Please select a transaction type",
	}),
	transactionDate: z.date({
		required_error: "Please select a transaction date",
	}),

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
}).refine(
	(data) => {
		// Primary market transactions must be sales
		if (data.marketType === "primary") {
			return data.transactionType === "sale";
		}
		return true;
	},
	{
		message: "Primary market transactions must be sales",
		path: ["transactionType"],
	}
);

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

// Simplified representation type options - 2 options only
export const representationTypeOptions = [
	{
		value: "direct",
		label: "Direct Representation",
		description: "You represent your own client exclusively in this transaction.",
		commissionInfo: "You receive your full agent share of the commission.",
		primaryMarketNote: "For developer projects: You represent the buyer/tenant, developer represents their project.",
		secondaryMarketNote: "For resale: You represent the buyer/tenant, owner represents themselves or has their own agent."
	},
	{
		value: "co_broking",
		label: "Co-Broking",
		description: "Working with another agent/agency. Commission split required.",
		commissionInfo: "Commission split with co-broker (configurable percentage)."
	},
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
	{ step: 4, title: "Representation", description: "How you represent this deal" },
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

// Enhanced commission calculation with simplified representation type support
// Leadership bonus info for upline display
export interface LeadershipBonusInfo {
	uplineName?: string;
	uplineTier?: string;
	bonusRate: number;
	bonusAmount: number;
	fromCompanyShare: number;
}

export function calculateEnhancedCommission(
	propertyPrice: number,
	commissionType: "percentage" | "fixed",
	commissionValue: number,
	representationType: RepresentationType,
	agentTier: string = "advisor",
	companyCommissionSplit: number = 70, // Updated default for New Leadership Plan
	coBrokerSplitPercentage: number = 50,
	uplineInfo?: { uplineTier: string; leadershipBonusRate: number } | null
) {
	// Level 1: Calculate total commission from property
	const totalCommission = calculateCommission(propertyPrice, commissionType, commissionValue);

	// Level 2: Apply representation type split (simplified to 2 options)
	let agentCommissionShare: number;
	let coBrokerShare: number | undefined;

	switch (representationType) {
		case "co_broking":
			// Co-broking: split with co-broker based on configured split
			agentCommissionShare = totalCommission * ((100 - coBrokerSplitPercentage) / 100);
			coBrokerShare = totalCommission * (coBrokerSplitPercentage / 100);
			break;
		case "direct":
		default:
			// Direct representation: agent gets full commission share (no co-broker)
			agentCommissionShare = totalCommission;
			coBrokerShare = undefined;
			break;
	}

	// Level 3: Apply company-agent split based on tier
	const agentSharePercentage = companyCommissionSplit / 100;
	const companyShare = agentCommissionShare * (1 - agentSharePercentage);
	const agentEarnings = agentCommissionShare * agentSharePercentage;

	// Level 4: Calculate Leadership Bonus from company's share (New Leadership Plan)
	let leadershipBonus: LeadershipBonusInfo | undefined;
	let companyNetShare = companyShare;

	if (uplineInfo && uplineInfo.leadershipBonusRate > 0) {
		const bonusAmount = companyShare * (uplineInfo.leadershipBonusRate / 100);
		companyNetShare = companyShare - bonusAmount;
		leadershipBonus = {
			uplineTier: uplineInfo.uplineTier,
			bonusRate: uplineInfo.leadershipBonusRate,
			bonusAmount: Math.round(bonusAmount * 100) / 100,
			fromCompanyShare: companyShare,
		};
	}

	// Calculate "Your Share" percentage for clear display (Issue #6)
	const yourSharePercentage = (agentEarnings / totalCommission) * 100;

	return {
		totalCommission,
		agentCommissionShare,
		coBrokerShare,
		companyShare,
		companyNetShare: Math.round(companyNetShare * 100) / 100,
		agentEarnings,
		leadershipBonus,
		// Clear "Your Share" display for Issue #6
		yourShare: agentEarnings,
		yourSharePercentage: Math.round(yourSharePercentage * 10) / 10,
		breakdown: {
			totalCommission,
			agentCommissionShare,
			coBrokerShare,
			companyShare: Math.round(companyNetShare * 100) / 100,
			leadershipBonus: leadershipBonus?.bonusAmount,
			agentEarnings,
			yourShare: agentEarnings,
			yourSharePercentage: Math.round(yourSharePercentage * 10) / 10,
		}
	};
}
