import { z } from "zod";

// Simplified Representation Type - 2 options only
// "direct" = Direct Representation (you represent your own client exclusively)
// "co_broking" = Co-Broking (working with another agent, splitting commission)
export const representationTypeEnum = z.enum(["direct", "co_broking"]);
export type RepresentationType = z.infer<typeof representationTypeEnum>;

// Step 1: Initiation Schema with Primary Market → Sale validation
export const initiationSchema = z
	.object({
		marketType: z.enum(["primary", "secondary"], {
			required_error: "Please select a market type",
		}),
		transactionType: z.enum(["sale", "lease"], {
			required_error: "Please select a transaction type",
		}),
		transactionDate: z.date({
			required_error: "Please select a transaction date",
		}),
	})
	.refine(
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
		},
	);

// Step 2: Property Schema (primary market — simplified)
export const propertySchema = z.object({
	listingId: z.string().uuid().optional(),
	listingTitle: z.string().optional(),
	schemeId: z.string().uuid().optional(),
	salesPackage: z.string().optional(),
	rebateAmount: z.number().nonnegative().optional(),
	purchasingMethod: z.enum(["cash", "loan"]).optional(),
	sstPayBy: z.enum(["landlord", "agent"]).optional(),
	listingReferralShareType: z.enum(["percentage", "fixed"]).optional(),
	listingReferralShareValue: z.number().nonnegative().optional(),
	address: z.string().optional(),
	propertyType: z.string().optional(),
	bedrooms: z.number().min(0).optional(),
	bathrooms: z.number().min(0).optional(),
	area: z.number().min(0).optional(),
	price: z.number().min(1, "Property price must be greater than 0"),
	spaPrice: z.number().positive().optional(),
	nettPrice: z.number().positive().optional(),
	description: z.string().optional(),
});

// Step 3: Purchaser Schema
export const clientSchema = z.object({
	name: z.string().min(1, "Purchaser name is required"),
	icNo: z.string().min(1, "IC / Passport is required"),
	email: z
		.string()
		.email("Please enter a valid email address")
		.optional()
		.or(z.literal("")),
	phone: z.string().min(1, "Phone number is required"),
	address: z.string().min(1, "Correspondence address is required"),
	race: z.string().optional(),
	nationality: z.string().optional(),
	gender: z.string().optional(),
	emergencyName: z.string().optional(),
	emergencyContact: z.string().optional(),
	type: z.enum(["buyer", "seller", "tenant", "landlord"]).optional(),
	source: z.string().optional(),
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
			internalAgentId: z.string().optional(),
			agentName: z.string().optional(),
			agencyName: z.string().optional(),
			commissionSplit: z
				.number()
				.min(0)
				.max(100, "Commission split must be between 0-100%")
				.optional(),
			contactInfo: z.string().optional(),
			agentEmail: z
				.string()
				.email("Please enter a valid email")
				.optional()
				.or(z.literal("")),
			agentPhone: z.string().optional(),
		})
		.optional(),
});

// Create a more flexible co-broking schema that validates based on representation type
export const createCoBrokingSchema = () => {
	return coBrokingBaseSchema.superRefine((data, ctx) => {
		// If co-broking is selected, validate required fields
		if (data.representationType === "co_broking") {
			const { internalAgentId, agentName, agentPhone, agencyName } =
				data.coBrokingData || {};
			const hasInternal = Boolean(internalAgentId?.trim());
			const hasCoAgency = Boolean(
				agencyName?.trim() && agentName?.trim(),
			);

			if (!hasInternal && !hasCoAgency) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Select a co-broke agent or enter co-agency details",
					path: ["coBrokingData", "agentName"],
				});
			}
			if (!hasInternal && !hasCoAgency && !agentPhone?.trim()) {
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
	agentTier: z
		.enum([
			"advisor",
			"sales_leader",
			"team_leader",
			"group_leader",
			"supreme_leader",
		])
		.optional(),
	companyCommissionSplit: z.number().min(0).max(100).optional(),
	// Commission breakdown for transparency (Issue #6 - clearer earnings display)
	breakdown: z
		.object({
			totalCommission: z.number(),
			agentCommissionShare: z.number(),
			coBrokerShare: z.number().optional(),
			companyShare: z.number(),
			agentEarnings: z.number(),
			// New: Explicit "Your Share" for clarity
			yourShare: z.number(),
			yourSharePercentage: z.number(),
		})
		.optional(),
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
				category: z
					.enum([
						"ic_passport",
						"sales_form",
						"bank_letter",
						"payment_proof",
						"other",
						"contract",
						"identification",
						"financial",
						"miscellaneous",
					])
					.optional(),
			}),
		)
		.optional(),
	notes: z.string().optional(),
	transactionId: z.string().optional(),
});

/** Combined validation for wizard step 1 (Details). */
export const detailsStepSchema = z
	.object({
		marketType: z.enum(["primary", "secondary"]),
		transactionType: z.enum(["sale", "lease"]),
		projectName: z.string().optional(),
		unitNo: z.string().optional(),
		blockListingId: z.string().uuid().optional(),
		bookingDate: z.date({ required_error: "Booking date is required" }),
		propertyData: propertySchema,
		clientData: clientSchema,
		representationType: representationTypeEnum,
		isCoBroking: z.boolean().optional(),
		coBrokingData: coBrokingBaseSchema.shape.coBrokingData,
		commissionType: z.enum(["percentage", "fixed"]).optional(),
		commissionValue: z.number().optional(),
		agentId: z.string().min(1).optional(),
	})
	.superRefine((data, ctx) => {
		if (data.marketType === "primary") {
			if (!data.projectName?.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Project is required",
					path: ["projectName"],
				});
			}
			if (!data.unitNo?.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Unit number is required",
					path: ["unitNo"],
				});
			}
		} else {
			if (!data.propertyData?.address?.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Property address is required",
					path: ["propertyData", "address"],
				});
			}
			const cv = data.commissionValue ?? 0;
			if (cv <= 0) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Commission rate is required for secondary market",
					path: ["commissionValue"],
				});
			}
		}

		if (data.representationType === "co_broking") {
			const { internalAgentId, agentName, agentPhone, agencyName } =
				data.coBrokingData || {};
			const hasInternal = Boolean(internalAgentId?.trim());
			const hasCoAgency =
				data.marketType === "secondary" &&
				Boolean(agencyName?.trim() && agentName?.trim());

			if (!hasInternal && !hasCoAgency) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Select a co-broke agent or enter co-agency details",
					path: ["coBrokingData", "agentName"],
				});
			}
			if (!hasInternal && !hasCoAgency && !agentPhone?.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Co-broke agent phone is required",
					path: ["coBrokingData", "agentPhone"],
				});
			}
		}

		if (!data.agentId?.trim()) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Transaction agent is required",
				path: ["agentId"],
			});
		}
	});

// Complete Transaction Schema (all steps combined) with Primary Market → Sale validation
export const completeTransactionSchema = z
	.object({
		marketType: z.enum(["primary", "secondary"]).default("primary"),
		transactionType: z.enum(["sale", "lease"]).default("sale"),
		transactionDate: z.date().optional(),
		projectName: z.string().optional(),
		unitNo: z.string().optional(),
		blockListingId: z.string().uuid().optional(),
		bookingDate: z.date().optional(),
		propertyData: propertySchema,
		clientData: clientSchema,
		...coBrokingBaseSchema.shape,
		agentId: z.string().min(1).optional(),
		commissionType: z.enum(["percentage", "fixed"]).optional(),
		commissionValue: z.number().min(0).optional(),
		commissionAmount: z.number().min(0).optional(),
		agentTier: z
			.enum([
				"advisor",
				"sales_leader",
				"team_leader",
				"group_leader",
				"supreme_leader",
			])
			.optional(),
		companyCommissionSplit: z.number().min(0).max(100).optional(),
		breakdown: z
			.object({
				totalCommission: z.number(),
				agentCommissionShare: z.number(),
				coBrokerShare: z.number().optional(),
				companyShare: z.number(),
				agentEarnings: z.number(),
				yourShare: z.number(),
				yourSharePercentage: z.number(),
			})
			.optional(),
		...documentsSchema.shape,
	})
	.refine(
		(data) => {
			if (data.marketType === "primary") {
				return data.transactionType === "sale";
			}
			return true;
		},
		{
			message: "Primary market transactions must be sales",
			path: ["transactionType"],
		},
	);

// Legacy section schemas (data sections within the 4-step wizard)
export const sectionSchemas = {
	1: initiationSchema,
	2: propertySchema,
	3: clientSchema,
	4: coBrokingSchema,
	5: commissionSchema,
	6: documentsSchema,
} as const;

/** @deprecated Use sectionSchemas — kept for internal references */
export const stepSchemas = {
	...sectionSchemas,
	7: z.object({}),
} as const;

// TypeScript types
export type InitiationData = z.infer<typeof initiationSchema>;
export type PropertyData = z.infer<typeof propertySchema>;
export type ClientData = z.infer<typeof clientSchema>;
export type CoBrokingData = z.infer<typeof coBrokingSchema>;
export type CommissionData = z.infer<typeof commissionSchema>;
export type DocumentsData = z.infer<typeof documentsSchema>;
export type CompleteTransactionData = z.infer<typeof completeTransactionSchema>;

// Wizard UI step type (3 steps)
export type FormStep = 1 | 2 | 3;

/** Internal data sections (legacy mapping for updateStepData). */
export type SectionStep = 1 | 2 | 3 | 4 | 5 | 6;

export const FORM_STEP_COUNT = 3 as const;

// Transaction status types
export type TransactionStatus =
	| "draft"
	| "pending"
	| "verified"
	| "converted"
	| "cancelled"
	| "revoke";

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
		description:
			"You represent your own client exclusively in this transaction.",
		commissionInfo: "You receive your full agent share of the commission.",
		primaryMarketNote:
			"For developer projects: You represent the buyer/tenant, developer represents their project.",
		secondaryMarketNote:
			"For resale: You represent the buyer/tenant, owner represents themselves or has their own agent.",
	},
	{
		value: "co_broking",
		label: "Co-Broking",
		description:
			"Working with another agent/agency. Commission split required.",
		commissionInfo:
			"Commission split with co-broker (configurable percentage).",
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

export const purchasingMethodOptions = [
	{ value: "cash", label: "Cash" },
	{ value: "loan", label: "Loan" },
] as const;

export const sstPayByOptions = [
	{ value: "landlord", label: "Landlord" },
	{ value: "agent", label: "Agent" },
] as const;

export const genderOptions = [
	{ value: "male", label: "Male" },
	{ value: "female", label: "Female" },
	{ value: "other", label: "Other" },
] as const;

// Step configuration (3-step wizard)
export const stepConfig = [
	{
		step: 1,
		title: "Details",
		description: "Property, purchaser, and representation",
	},
	{
		step: 2,
		title: "Upload",
		description: "Supporting documents",
	},
	{ step: 3, title: "Verify", description: "Review and submit" },
] as const;

/** Map a legacy step index to the 3-step wizard. */
export function normalizeFormStep(step: number): FormStep {
	if (step >= 1 && step <= FORM_STEP_COUNT) return step as FormStep;
	if (step <= 4) return 1;
	if (step <= 6) return 2;
	return 3;
}

/** Map a data section (1–6) to the wizard step used for edit navigation. */
export function sectionToFormStep(section: number): FormStep {
	if (section <= 4) return 1;
	if (section <= 6) return 2;
	return 3;
}

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
		if (step === 3) return true;
		if (step === 1) {
			detailsStepSchema.parse({
				marketType: data.marketType ?? "primary",
				transactionType: data.transactionType ?? "sale",
				projectName: data.projectName,
				unitNo: data.unitNo,
				blockListingId: data.blockListingId,
				bookingDate: data.bookingDate ?? data.transactionDate,
				propertyData: data.propertyData,
				clientData: data.clientData,
				representationType: data.representationType ?? "direct",
				isCoBroking: data.isCoBroking,
				coBrokingData: data.coBrokingData,
				commissionType: data.commissionType,
				commissionValue: data.commissionValue,
			});
			return true;
		}
		if (step === 2) return true;
		return false;
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
	agentTier = "advisor",
	companyCommissionSplit = 70, // Updated default for New Leadership Plan
	coBrokerSplitPercentage = 50,
	uplineInfo?: { uplineTier: string; leadershipBonusRate: number } | null,
) {
	// Level 1: Calculate total commission from property
	const totalCommission = calculateCommission(
		propertyPrice,
		commissionType,
		commissionValue,
	);

	// Level 2: Apply representation type split (simplified to 2 options)
	let agentCommissionShare: number;
	let coBrokerShare: number | undefined;

	switch (representationType) {
		case "co_broking":
			// Co-broking: split with co-broker based on configured split
			agentCommissionShare =
				totalCommission * ((100 - coBrokerSplitPercentage) / 100);
			coBrokerShare = totalCommission * (coBrokerSplitPercentage / 100);
			break;
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
		},
	};
}
