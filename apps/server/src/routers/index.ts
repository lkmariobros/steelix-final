import { protectedProcedure, publicProcedure, router } from "../lib/trpc";
import { adminRouter } from "./admin";
import { agentTiersRouter } from "./agent-tiers";
import { agentsRouter } from "./agents";
import { approvalsRouter } from "./approvals";
import { autoReplyRouter } from "./auto-reply";
import { crmRouter } from "./crm";
import { dashboardRouter } from "./dashboard";
import { documentsRouter } from "./documents";
import { reportsRouter } from "./reports";
import { tagsRouter } from "./tags";
import { transactionsRouter } from "./transactions";
import { whatsappRouter } from "./whatsapp";

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
});

export type AppRouter = typeof appRouter;
