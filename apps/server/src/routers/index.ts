import { protectedProcedure, publicProcedure, router } from "../lib/trpc";
import { adminRouter } from "./admin";
import { agentTiersRouter } from "./agent-tiers";
import { agentsRouter } from "./agents";
import { approvalsRouter } from "./approvals";
import { dashboardRouter } from "./dashboard";
import { documentsRouter } from "./documents";
import { reportsRouter } from "./reports";
import { transactionsRouter } from "./transactions";

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
});

export type AppRouter = typeof appRouter;
