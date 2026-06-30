import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { user } from "../models/auth";
import { erecruitmentSubmitSchema } from "../models/erecruitment";
import {
	approveRecruitmentApplication,
	createRecruitmentLink,
	listRecruitmentApplications,
	listRecruitmentLinks,
	rejectRecruitmentApplication,
	resolveRecruitmentLink,
	submitRecruitmentApplication,
	uploadRecruitmentDocument,
	getRecruitmentApplication,
} from "../services/erecruitment";
import { db } from "../utils/db";
import {
	adminProcedure,
	protectedProcedure,
	publicProcedure,
	router,
} from "../utils/trpc";

const uploadDocumentInput = z.object({
	token: z.string().min(1),
	category: z.enum(["icFront", "icBack", "registrationFeeReceipt"]),
	fileName: z.string().min(1).max(255),
	fileType: z.string(),
	fileSize: z.number().max(10 * 1024 * 1024),
	base64Data: z.string(),
});

export const erecruitmentRouter = router({
	getLinkByToken: publicProcedure
		.input(z.object({ token: z.string().min(1) }))
		.query(async ({ input }) => {
			const link = await resolveRecruitmentLink(input.token);
			if (!link) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Recruitment link not found",
				});
			}
			return {
				recruiterName: link.recruiterName,
				inviteeName: link.inviteeName,
				inviteeEmail: link.inviteeEmail,
				expired: link.expired,
				reason: link.reason,
				expiresAt: link.expiresAt.toISOString(),
			};
		}),

	uploadDocument: publicProcedure
		.input(uploadDocumentInput)
		.mutation(async ({ input }) => {
			return uploadRecruitmentDocument(input);
		}),

	submitApplication: publicProcedure
		.input(erecruitmentSubmitSchema)
		.mutation(async ({ input }) => {
			return submitRecruitmentApplication(input);
		}),

	createLink: adminProcedure
		.input(
			z.object({
				inviteeName: z.string().optional(),
				inviteeEmail: z.string().email().optional().or(z.literal("")),
				recruiterId: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const sessionUser = ctx.session.user;

			let recruiterId = sessionUser.id;
			let recruiterName = sessionUser.name ?? "Recruiter";

			if (input.recruiterId) {
				const [recruiter] = await db
					.select({ id: user.id, name: user.name })
					.from(user)
					.where(eq(user.id, input.recruiterId))
					.limit(1);
				if (!recruiter) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Recruiter not found",
					});
				}
				recruiterId = recruiter.id;
				recruiterName = recruiter.name;
			}

			const link = await createRecruitmentLink({
				recruiterId,
				recruiterName,
				inviteeName: input.inviteeName,
				inviteeEmail: input.inviteeEmail || undefined,
			});

			return {
				...link,
				joinUrl: `/join/${link.token}`,
			};
		}),

	listApplications: adminProcedure
		.input(
			z.object({
				status: z
					.enum(["pending_review", "approved", "rejected"])
					.optional(),
				limit: z.number().min(1).max(100).default(50),
				offset: z.number().min(0).default(0),
			}),
		)
		.query(async ({ input }) => {
			return listRecruitmentApplications(input);
		}),

	getApplication: adminProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ input }) => {
			const application = await getRecruitmentApplication(input.id);
			if (!application) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Application not found",
				});
			}
			return application;
		}),

	approve: adminProcedure
		.input(
			z.object({
				applicationId: z.string().uuid(),
				temporaryPassword: z.string().min(8).optional(),
				agentCode: z.string().min(1).max(32).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			try {
				return await approveRecruitmentApplication({
					applicationId: input.applicationId,
					reviewerId: ctx.session.user.id,
					temporaryPassword: input.temporaryPassword,
					agentCode: input.agentCode,
				});
			} catch (e) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: e instanceof Error ? e.message : "Approval failed",
				});
			}
		}),

	reject: adminProcedure
		.input(
			z.object({
				applicationId: z.string().uuid(),
				reason: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			try {
				return await rejectRecruitmentApplication({
					applicationId: input.applicationId,
					reviewerId: ctx.session.user.id,
					reason: input.reason,
				});
			} catch (e) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: e instanceof Error ? e.message : "Rejection failed",
				});
			}
		}),

	listLinks: adminProcedure
		.input(
			z.object({
				recruiterId: z.string().optional(),
				limit: z.number().min(1).max(50).default(20),
			}),
		)
		.query(async ({ input }) => {
			return listRecruitmentLinks(input);
		}),
});
