import { protectedProcedure, publicProcedure, router } from "../lib/trpc";
import { adminRouter } from "./admin";
import { dashboardRouter } from "./dashboard";
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
});

export type AppRouter = typeof appRouter;
