/** Primary market commission scheme block types (admin dropdown). */
export const COMMISSION_SCHEME_BLOCK_TYPES = [
	"Block",
	"Tower A",
	"Tower B",
	"Tower C",
	"Landed",
	"Shoplot",
	"LOT",
	"Level",
	"Others",
] as const;

export type CommissionSchemeBlockType =
	(typeof COMMISSION_SCHEME_BLOCK_TYPES)[number];

export function isCommissionSchemeBlockType(
	value: string | null | undefined,
): value is CommissionSchemeBlockType {
	return (
		!!value &&
		(COMMISSION_SCHEME_BLOCK_TYPES as readonly string[]).includes(value)
	);
}

export function formatSchemeBlockLabel(
	blockType: string | null | undefined,
	blockListingTitle: string | null | undefined,
): string {
	if (blockType) return blockType;
	if (blockListingTitle) return blockListingTitle;
	return "No block selected";
}
