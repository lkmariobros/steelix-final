import { eq } from "drizzle-orm";
import { z } from "zod";
import { user } from "../models/auth";
import {
	addLeadershipBonusPaymentInputSchema,
	addPayoutPaymentInputSchema,
	releasePayoutInputSchema,
} from "../models/commission-payouts";
import {
	addLeadershipBonusPaymentAdmin,
	addPayoutPaymentAdmin,
	adminAgentCommissionSummary,
	approveLeadershipBonusAdmin,
	approvePayoutAdmin,
	bulkApproveAdmin,
	bulkReleaseAdmin,
	cancelLeadershipBonusAdmin,
	cancelPayoutAdmin,
	deleteClaimScheduleAdmin,
	getCommissionPayoutById,
	listClaimSchedulesAdmin,
	listCommissionPayoutsAdmin,
	listCommissionPayoutsAgent,
	listLeadershipBonusPaymentItems,
	listPayoutPayments,
	markPaidAdmin,
	releasePayoutAdmin,
	setOnHoldAdmin,
	summarizeAgentPayoutDashboard,
	summarizePayoutTotalsAdmin,
	upsertClaimScheduleAdmin,
	voidPayoutAdmin,
} from "../services/commission-payouts";
import { db } from "../utils/db";
import { adminProcedure, protectedProcedure, router } from "../utils/trpc";

const payoutStatusZod = z.enum([
	"pending_approval",
	"approved",
	"released",
	"paid",
	"on_hold",
	"voided",
	"cancelled",
]);

const segmentZod = z.enum(["new_project", "subsale", "rental"]);

const listAdminInput = z.object({
	limit: z.number().min(1).max(100).default(20),
	offset: z.number().min(0).default(0),
	search: z.string().optional(),
	agentId: z.string().optional(),
	projectName: z.string().optional(),
	status: payoutStatusZod.optional(),
	statuses: z.array(payoutStatusZod).optional(),
	segment: segmentZod.optional(),
	dateFrom: z.coerce.date().optional(),
	dateTo: z.coerce.date().optional(),
});

const listAgentInput = z.object({
	limit: z.number().min(1).max(100).default(20),
	offset: z.number().min(0).default(0),
	search: z.string().optional(),
	status: payoutStatusZod.optional(),
	dateFrom: z.coerce.date().optional(),
	dateTo: z.coerce.date().optional(),
});

const idInput = z.object({ id: z.string().uuid() });

export const commissionPayoutsRouter = router({
	adminList: adminProcedure.input(listAdminInput).query(async ({ input }) => {
		const { rows, total } = await listCommissionPayoutsAdmin({
			...input,
			limit: input.limit,
			offset: input.offset,
		});
		return {
			items: rows.map((r) => {
				const paid = Number(r.payout.paidAmount ?? 0);
				const net = Number(r.payout.netCommission ?? 0);
				return {
					...r.payout,
					agentName: r.payout.isCompanyShare
						? r.payout.shareLabel || "Devots"
						: r.agentName,
					agentNickName: r.agentNickName,
					agentCode: r.agentCode,
					marketType: r.marketType,
					transactionType: r.transactionType,
					propertyAddress: r.propertyAddress,
					verifiedDate: r.verifiedDate,
					submitDate: r.payout.createdAt,
					paidAmountRm: paid,
					outstandingAmountRm: Math.max(0, Math.round((net - paid) * 100) / 100),
				};
			}),
			total,
			hasMore: input.offset + input.limit < total,
		};
	}),

	adminSummary: adminProcedure
		.input(
			z.object({
				agentId: z.string().optional(),
				projectName: z.string().optional(),
				dateFrom: z.coerce.date().optional(),
				dateTo: z.coerce.date().optional(),
				segment: segmentZod.optional(),
			}),
		)
		.query(async ({ input }) => summarizePayoutTotalsAdmin(input)),

	adminGet: adminProcedure.input(idInput).query(async ({ input }) => {
		const row = await getCommissionPayoutById(input.id);
		if (!row) throw new Error("Not found");
		const payments = await listPayoutPayments(input.id);
		const paid = Number(row.payout.paidAmount ?? 0);
		const net = Number(row.payout.netCommission ?? 0);
		return {
			...row,
			payments,
			paidAmountRm: paid,
			outstandingAmountRm: Math.max(0, Math.round((net - paid) * 100) / 100),
		};
	}),

	adminApprove: adminProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				internalNote: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [me] = await db
				.select({ name: user.name })
				.from(user)
				.where(eq(user.id, ctx.session.user.id))
				.limit(1);
			return approvePayoutAdmin({
				id: input.id,
				adminId: ctx.session.user.id,
				adminName: me?.name,
				internalNote: input.internalNote,
			});
		}),

	adminRelease: adminProcedure
		.input(releasePayoutInputSchema)
		.mutation(async ({ ctx, input }) => {
			const [me] = await db
				.select({ name: user.name })
				.from(user)
				.where(eq(user.id, ctx.session.user.id))
				.limit(1);
			return releasePayoutAdmin({
				id: input.id,
				adminId: ctx.session.user.id,
				adminName: me?.name,
				paymentMethod: input.paymentMethod,
				paymentDate: input.paymentDate,
				paymentReferenceNo: input.paymentReferenceNo,
				paymentReceiptUrl: input.paymentReceiptUrl,
				internalNote: input.internalNote,
			});
		}),

	adminMarkPaid: adminProcedure
		.input(
			z.object({ id: z.string().uuid(), internalNote: z.string().optional() }),
		)
		.mutation(async ({ ctx, input }) => {
			const [me] = await db
				.select({ name: user.name })
				.from(user)
				.where(eq(user.id, ctx.session.user.id))
				.limit(1);
			return markPaidAdmin({
				id: input.id,
				adminId: ctx.session.user.id,
				adminName: me?.name,
				internalNote: input.internalNote,
			});
		}),

	adminHold: adminProcedure
		.input(z.object({ id: z.string().uuid(), reason: z.string().optional() }))
		.mutation(async ({ ctx, input }) => {
			const [me] = await db
				.select({ name: user.name })
				.from(user)
				.where(eq(user.id, ctx.session.user.id))
				.limit(1);
			return setOnHoldAdmin({
				id: input.id,
				adminId: ctx.session.user.id,
				adminName: me?.name,
				reason: input.reason,
			});
		}),

	adminVoid: adminProcedure
		.input(z.object({ id: z.string().uuid(), reason: z.string().optional() }))
		.mutation(async ({ ctx, input }) => {
			const [me] = await db
				.select({ name: user.name })
				.from(user)
				.where(eq(user.id, ctx.session.user.id))
				.limit(1);
			return voidPayoutAdmin({
				id: input.id,
				adminId: ctx.session.user.id,
				adminName: me?.name,
				reason: input.reason,
			});
		}),

	adminCancel: adminProcedure
		.input(z.object({ id: z.string().uuid(), reason: z.string().optional() }))
		.mutation(async ({ ctx, input }) => {
			const [me] = await db
				.select({ name: user.name })
				.from(user)
				.where(eq(user.id, ctx.session.user.id))
				.limit(1);
			return cancelPayoutAdmin({
				id: input.id,
				adminId: ctx.session.user.id,
				adminName: me?.name,
				reason: input.reason,
			});
		}),

	adminAddPayment: adminProcedure
		.input(addPayoutPaymentInputSchema)
		.mutation(async ({ ctx, input }) => {
			const [me] = await db
				.select({ name: user.name })
				.from(user)
				.where(eq(user.id, ctx.session.user.id))
				.limit(1);
			return addPayoutPaymentAdmin({
				payoutId: input.payoutId,
				adminId: ctx.session.user.id,
				adminName: me?.name,
				paymentDate: input.paymentDate,
				amount: input.amount,
				receiptUrl: input.receiptUrl || undefined,
				note: input.note,
			});
		}),

	adminListPayments: adminProcedure
		.input(z.object({ payoutId: z.string().uuid() }))
		.query(async ({ input }) => listPayoutPayments(input.payoutId)),

	adminApproveLeadershipBonus: adminProcedure
		.input(z.object({ paymentId: z.string().uuid() }))
		.mutation(async ({ input }) => approveLeadershipBonusAdmin(input.paymentId)),

	adminCancelLeadershipBonus: adminProcedure
		.input(z.object({ paymentId: z.string().uuid() }))
		.mutation(async ({ input }) => cancelLeadershipBonusAdmin(input.paymentId)),

	adminAddLeadershipBonusPayment: adminProcedure
		.input(addLeadershipBonusPaymentInputSchema)
		.mutation(async ({ ctx, input }) =>
			addLeadershipBonusPaymentAdmin({
				paymentId: input.paymentId,
				adminId: ctx.session.user.id,
				paymentDate: input.paymentDate,
				amount: input.amount,
				receiptUrl: input.receiptUrl || undefined,
				note: input.note,
			}),
		),

	adminListLeadershipBonusPayments: adminProcedure
		.input(z.object({ paymentId: z.string().uuid() }))
		.query(async ({ input }) => listLeadershipBonusPaymentItems(input.paymentId)),

	adminBulkApprove: adminProcedure
		.input(z.object({ ids: z.array(z.string().uuid()).min(1).max(50) }))
		.mutation(async ({ ctx, input }) =>
			bulkApproveAdmin(input.ids, ctx.session.user.id),
		),

	adminBulkRelease: adminProcedure
		.input(
			z.object({
				ids: z.array(z.string().uuid()).min(1).max(50),
				paymentMethod: z.enum(["bank_transfer", "cheque", "cash"]),
				paymentDate: z.coerce.date(),
				paymentReferenceNo: z.string().min(1),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			bulkReleaseAdmin(
				input.ids,
				ctx.session.user.id,
				{
					paymentMethod: input.paymentMethod,
					paymentDate: input.paymentDate,
					paymentReferenceNo: input.paymentReferenceNo,
				},
			),
		),

	adminAgentReport: adminProcedure
		.input(z.object({ agentId: z.string().min(1) }))
		.query(async ({ input }) => adminAgentCommissionSummary(input.agentId)),

	claimSchedulesList: adminProcedure
		.input(z.object({ projectName: z.string().optional() }))
		.query(async ({ input }) => listClaimSchedulesAdmin(input.projectName)),

	claimScheduleUpsert: adminProcedure
		.input(
			z.object({
				id: z.string().uuid().optional(),
				projectName: z.string().min(1),
				claimStage: z.string().min(1),
				percentPayable: z.number().min(0).max(100),
				sortOrder: z.number().int().default(0),
			}),
		)
		.mutation(async ({ input }) => upsertClaimScheduleAdmin(input)),

	claimScheduleDelete: adminProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ input }) => deleteClaimScheduleAdmin(input.id)),

	// --- Agent (read-only) ---
	agentList: protectedProcedure.input(listAgentInput).query(async ({ ctx, input }) => {
		const { rows, total } = await listCommissionPayoutsAgent({
			agentId: ctx.session.user.id,
			search: input.search,
			status: input.status,
			dateFrom: input.dateFrom,
			dateTo: input.dateTo,
			limit: input.limit,
			offset: input.offset,
		});
		return {
			items: rows.map((r) => r.payout),
			total,
			hasMore: input.offset + input.limit < total,
		};
	}),

	agentSummary: protectedProcedure.query(async ({ ctx }) =>
		summarizeAgentPayoutDashboard(ctx.session.user.id),
	),

	agentGet: protectedProcedure.input(idInput).query(async ({ ctx, input }) => {
		const row = await getCommissionPayoutById(input.id);
		if (!row || row.payout.payeeAgentId !== ctx.session.user.id) {
			throw new Error("Not found");
		}
		return row;
	}),
});
