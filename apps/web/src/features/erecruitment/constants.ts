import { BRAND_NAME } from "@/lib/brand";

export const COMPANY_POLICY = `${BRAND_NAME} Company Policies

1. All agents must comply with agency regulations and professional conduct standards.
2. Client information must be kept confidential at all times.
3. Commission claims must be supported by valid documentation.
4. Agents must complete mandatory training within the probation period.
5. Misrepresentation of property or commission terms is strictly prohibited.`;

export const NDA_TEXT = `Non-Disclosure Agreement (NDA)

By joining ${BRAND_NAME}, you agree not to disclose confidential business information, client data, commission structures, internal systems, or proprietary sales materials to any third party without written approval from management. This obligation continues after your association with the agency ends.`;

/** Devots branch offices — used on agent onboarding & profile. */
export const BRANCH_OPTIONS = [
	{ value: "GENTING", label: "GENTING" },
	{ value: "PUCHONG", label: "PUCHONG" },
] as const;

export type BranchValue = (typeof BRANCH_OPTIONS)[number]["value"];

export function isBranchValue(value: string): value is BranchValue {
	return BRANCH_OPTIONS.some((o) => o.value === value);
}
