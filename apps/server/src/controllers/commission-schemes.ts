import { z } from "zod";
import {
	insertCommissionSchemeSchema,
	updateCommissionSchemeSchema,
} from "../models/commission-schemes";
import { adminProcedure, protectedProcedure, router } from "../utils/trpc";
import {
	bulkUpdateCommissionSchemesAdmin,
	createCommissionSchemeAdmin,
	deleteCommissionSchemeAdmin,
	duplicateCommissionSchemeAdmin,
	getCommissionSchemeAdmin,
	listBlockListingsForSchemesAdmin,
	listCommissionSchemesAdmin,
	listProjectNamesForSchemesAdmin,
	updateCommissionSchemeAdmin,
} from "../services/commission-schemes";

const listInput = z.object({
	search: z.string().optional(),
	projectName: z.string().optional(),
	blockListingId: z.string().uuid().optional(),
	includeInactive: z.boolean().optional(),
	limit: z.number().min(1).max(200).default(50),
	offset: z.number().min(0).default(0),
});

export const commissionSchemesRouter = router({
	list: adminProcedure.input(listInput).query(async ({ input }) => {
		return await listCommissionSchemesAdmin(input);
	}),

	get: adminProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ input }) => {
			const scheme = await getCommissionSchemeAdmin(input.id);
			if (!scheme) throw new Error("Scheme not found");
			return scheme;
		}),

	listProjects: adminProcedure.query(async () => {
		return await listProjectNamesForSchemesAdmin();
	}),

	/** Agent-facing project list for transaction wizard */
	listProjectsForAgent: protectedProcedure.query(async () => {
		return await listProjectNamesForSchemesAdmin();
	}),

	listByProject: protectedProcedure
		.input(z.object({ projectName: z.string().min(1) }))
		.query(async ({ input }) => {
			return await listCommissionSchemesAdmin({
				projectName: input.projectName,
				includeInactive: false,
				limit: 50,
				offset: 0,
			});
		}),

	listBlocks: adminProcedure.query(async () => {
		return await listBlockListingsForSchemesAdmin();
	}),

	create: adminProcedure
		.input(insertCommissionSchemeSchema)
		.mutation(async ({ input, ctx }) => {
			return await createCommissionSchemeAdmin({
				...input,
				tiers: input.tiers.map((t) => ({
					tierName: t.tierName,
					commissionPercent: t.commissionPercent,
					overridePercent: t.overridePercent ?? 0,
					effectiveFrom: t.effectiveFrom,
					effectiveTo: t.effectiveTo ?? null,
					isActive: t.isActive ?? true,
				})),
				blockType: input.blockType ?? null,
				blockListingId: input.blockListingId ?? null,
				actorId: ctx.session.user.id,
			});
		}),

	update: adminProcedure
		.input(updateCommissionSchemeSchema)
		.mutation(async ({ input, ctx }) => {
			const { id, tiers, ...patch } = input;
			return await updateCommissionSchemeAdmin({
				id,
				patch: patch as any,
				tiers: tiers as any,
				actorId: ctx.session.user.id,
			});
		}),

	duplicate: adminProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ input, ctx }) => {
			return await duplicateCommissionSchemeAdmin({
				id: input.id,
				actorId: ctx.session.user.id,
			});
		}),

	delete: adminProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ input }) => {
			return await deleteCommissionSchemeAdmin(input.id);
		}),

	bulkUpdate: adminProcedure
		.input(
			z.object({
				ids: z.array(z.string().uuid()).min(1),
				setActive: z.boolean().optional(),
				setIncSst: z.boolean().optional(),
				setSstPercent: z.number().min(0).max(100).optional(),
				setSstBorneBy: z.enum(["client", "agent"]).optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			return await bulkUpdateCommissionSchemesAdmin({
				...input,
				actorId: ctx.session.user.id,
			});
		}),
});

