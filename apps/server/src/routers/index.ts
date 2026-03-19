import { adminRouter } from "../controllers/admin";
import { agentTiersRouter } from "../controllers/agent-tiers";
import { agentsRouter } from "../controllers/agents";
import { approvalsRouter } from "../controllers/approvals";
import { autoReplyRouter } from "../controllers/auto-reply";
import { calendarRouter } from "../controllers/calendar";
import { crmRouter } from "../controllers/crm";
import { dashboardRouter } from "../controllers/dashboard";
import { documentsRouter } from "../controllers/documents";
import { feedbackRouter } from "../controllers/feedback";
import { reportsRouter } from "../controllers/reports";
import { tagsRouter } from "../controllers/tags";
import { transactionsRouter } from "../controllers/transactions";
import { whatsappRouter } from "../controllers/whatsapp";
import { protectedProcedure, publicProcedure, router } from "../utils/trpc";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	privateData: protectedProcedure.query(({ ctx }) => {
		return {
			message: "This is private",
			user: ctx.session.user,
		};
	}),
	transactions: transactionsRouter,
	dashboard: dashboardRouter,
	admin: adminRouter,
	agentTiers: agentTiersRouter,
	agents: agentsRouter,
	approvals: approvalsRouter,
	documents: documentsRouter,
	reports: reportsRouter,
	crm: crmRouter,
	autoReply: autoReplyRouter,
	whatsapp: whatsappRouter,
	tags: tagsRouter,
	calendar: calendarRouter,
	feedback: feedbackRouter,
});

export type AppRouter = typeof appRouter;
