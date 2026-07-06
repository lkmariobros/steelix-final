import "dotenv/config";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { appRouter } from "./routers/index";
import { debugRoutes } from "./routes/debug";
import { webhookRoutes } from "./routes/webhooks";
import { eq } from "drizzle-orm";
import { user } from "./models/auth";
import { auth } from "./utils/auth";
import { createContext } from "./utils/context";
import { db } from "./utils/db";
import { isAppRole } from "./utils/rbac";
import { hasAdminAccess, hasSuperAdminAccess } from "./utils/user-roles";
import { startServer } from "./utils/server";
import { getAllowedOrigins } from "./utils/allowed-origins";

const app = new Hono();

// ─── Global error handler ────────────────────────────────────────────────────

app.onError((err, c) => {
	console.error(`❌ [${c.req.method}] ${c.req.path}:`, err.message);
	return c.json(
		{
			error: "Internal server error",
			message: err.message,
			...(process.env.NODE_ENV === "development" && { stack: err.stack }),
		},
		500,
	);
});

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(logger());

const allowedOrigins = getAllowedOrigins();

app.use(
	"/*",
	cors({
		origin: allowedOrigins,
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowHeaders: [
			"Content-Type",
			"Authorization",
			"Cookie",
			"Set-Cookie",
			"X-Requested-With",
			"Accept",
			"Origin",
		],
		credentials: true,
		exposeHeaders: ["Set-Cookie"],
	}),
);

// ─── Auth ─────────────────────────────────────────────────────────────────────

/** DB-backed role for middleware / proxies when session JSON omits custom fields. */
app.get("/api/auth/me-role", async (c) => {
	try {
		const session = await auth.api.getSession({ headers: c.req.raw.headers });
		if (!session?.user?.id) {
			return c.json({ hasAdminAccess: false, role: null }, 401);
		}

		const fromSession = (session.user as { role?: string | null }).role;
		if (isAppRole(fromSession)) {
			return c.json({
				role: fromSession,
				hasAdminAccess: hasAdminAccess({ role: fromSession }),
				hasSuperAdminAccess: hasSuperAdminAccess({ role: fromSession }),
			});
		}

		const [record] = await db
			.select({ role: user.role })
			.from(user)
			.where(eq(user.id, session.user.id))
			.limit(1);

		const role = isAppRole(record?.role) ? record.role : "agent";
		return c.json({
			role,
			hasAdminAccess: hasAdminAccess({ role }),
			hasSuperAdminAccess: hasSuperAdminAccess({ role }),
		});
	} catch (error) {
		console.error("❌ me-role error:", error);
		return c.json({ hasAdminAccess: false, role: null }, 500);
	}
});

app.all("/api/auth/*", async (c) => {
	try {
		const result = await auth.handler(c.req.raw);
		return (
			result ??
			c.json({ error: "Auth endpoint not found", path: c.req.path }, 404)
		);
	} catch (error) {
		console.error(
			"❌ Auth error:",
			error instanceof Error ? error.message : error,
		);
		return c.json(
			{
				error: "Auth handler failed",
				details: error instanceof Error ? error.message : String(error),
			},
			500,
		);
	}
});

// ─── tRPC ─────────────────────────────────────────────────────────────────────

app.use(
	"/trpc/*",
	trpcServer({
		router: appRouter,
		createContext: (_opts, context) => createContext({ context }),
	}),
);

// ─── Health ───────────────────────────────────────────────────────────────────

app.get("/", (c) => c.text(`OK - ${new Date().toISOString()}`));
app.get("/health", (c) =>
	c.json({
		status: "healthy",
		timestamp: new Date().toISOString(),
		env: process.env.NODE_ENV,
	}),
);
app.get("/healthz", (c) => c.text("OK"));
app.get("/ping", (c) => c.text("pong"));
app.get("/.well-known/health", (c) => c.json({ status: "ok" }));

// ─── Feature routes ───────────────────────────────────────────────────────────

app.route("/", webhookRoutes);

if (process.env.NODE_ENV !== "production") {
	app.route("/", debugRoutes);
}

// ─── Process error guards ─────────────────────────────────────────────────────

process.on("unhandledRejection", (reason) =>
	console.error("❌ Unhandled rejection:", reason),
);
process.on("uncaughtException", (error) =>
	console.error("❌ Uncaught exception:", error),
);

// ─── Startup ──────────────────────────────────────────────────────────────────

console.log(
	`🚀 Starting on port ${process.env.PORT || 8080} [${process.env.NODE_ENV}]`,
);
console.log(
	`   DB: ${process.env.DATABASE_URL ? "✓" : "✗ NOT SET"}  |  AUTH_URL: ${process.env.BETTER_AUTH_URL}`,
);

startServer(app);

export default {} as Record<string, never>;
