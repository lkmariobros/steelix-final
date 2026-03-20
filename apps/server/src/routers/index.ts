import { adminRouter } from "../controllers/admin";
import { adminLeadsRouter } from "../controllers/admin-leads";
import { agentTiersRouter } from "../controllers/agent-tiers";
import { agentsRouter } from "../controllers/agents";
import { approvalsRouter } from "../controllers/approvals";
import { autoReplyRouter } from "../controllers/auto-reply";
import { calendarRouter } from "../controllers/calendar";
import { crmRouter } from "../controllers/crm";
import { dashboardRouter } from "../controllers/dashboard";
import { documentsRouter } from "../controllers/documents";
import { feedbackRouter } from "../controllers/feedback";
import { leadTasksRouter } from "../controllers/lead-tasks";
import { reportsRouter } from "../controllers/reports";
import { tagsRouter } from "../controllers/tags";
import { transactionsRouter } from "../controllers/transactions";
import { whatsappRouter } from "../controllers/whatsapp";
import { publicProcedure, router } from "../utils/trpc";

export const appRouter = router({
	health: publicProcedure.query(() => "OK"),
	transactions: transactionsRouter,
	dashboard: dashboardRouter,
	admin: adminRouter,
	adminLeads: adminLeadsRouter,
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
	leadTasks: leadTasksRouter,
});

export type AppRouter = typeof appRouter;
