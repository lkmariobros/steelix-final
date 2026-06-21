import { z } from "zod";

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

export const commissionSchemeBlockTypeSchema = z.enum(
	COMMISSION_SCHEME_BLOCK_TYPES,
);
