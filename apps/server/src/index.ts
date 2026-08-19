import "dotenv/config";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { appRouter } from "./routers/index";
import { debugRoutes } from "./routes/debug";
import { webhookRoutes } from "./routes/webhooks";
import { eq, sql } from "drizzle-orm";
import { user } from "./models/auth";
import { auth } from "./utils/auth";
import { evaluateAccountSignInAccess } from "./utils/account-access";
import { createContext } from "./utils/context";
import { db } from "./utils/db";
import { isAppRole } from "./utils/rbac";
import { hasAdminAccess, hasSuperAdminAccess } from "./utils/user-roles";
import { startServer } from "./utils/server";
import { getAllowedOrigins } from "./utils/allowed-origins";
import { ensurePipelineStageEnumValues } from "./utils/pipeline-stage-schema";
import { ensureDocumentCategoryEnumValues } from "./utils/document-category-schema";

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

/**
 * Hard gate: prevent pending/suspended users from creating sessions.
 * This is intentionally duplicated from auth databaseHooks as a defense-in-depth
 * check in case the auth adapter bypasses session.create hooks.
 */
async function handleEmailSignIn(c: Context) {
	try {
		const bodyText = await c.req.text();
		let parsedBody: Record<string, unknown> | null = null;
		if (bodyText) {
			try {
				const json: unknown = JSON.parse(bodyText);
				if (json && typeof json === "object" && !Array.isArray(json)) {
					parsedBody = json as Record<string, unknown>;
				}
			} catch {
				parsedBody = null;
			}
		}

		const email =
			parsedBody && "email" in parsedBody
				? String(parsedBody.email ?? "").toLowerCase().trim()
				: "";
		const password =
			parsedBody && "password" in parsedBody
				? String(parsedBody.password ?? "")
				: "";

		console.log(
			`🔐 sign-in/email: bodyLength=${bodyText.length} hasEmail=${Boolean(email)} origin=${c.req.header("origin") ?? "none"}`,
		);

		if (!email || !password) {
			return c.json(
				{
					code: "INVALID_EMAIL_OR_PASSWORD",
					message: "Invalid email or password",
				},
				401,
			);
		}

		const [record] = await db
			.select({
				role: user.role,
				agentStatus: user.agentStatus,
				isActive: user.isActive,
			})
			.from(user)
			.where(sql`lower(${user.email}) = ${email}`)
			.limit(1);

		console.log(
			`🔐 sign-in/email: dbUser=${record ? "found" : "missing"} role=${record?.role ?? "n/a"} status=${record?.agentStatus ?? "n/a"}`,
		);

		const access = evaluateAccountSignInAccess(record);
		if (!access.allowed) {
			return c.json(
				{
					code: "FORBIDDEN",
					message: access.message,
				},
				403,
			);
		}

		const origin =
			c.req.header("origin") ||
			allowedOrigins.find((item) => item.startsWith("https://portal.")) ||
			allowedOrigins[0] ||
			"https://portal.devots.com.my";

		const authHeaders = new Headers();
		authHeaders.set("origin", origin);
		authHeaders.set("content-type", "application/json");
		const userAgent = c.req.header("user-agent");
		if (userAgent) authHeaders.set("user-agent", userAgent);

		// Call Better Auth with a reconstructed body. Forwarding the raw Vercel
		// request (and X-Forwarded-Host=portal.devots.com.my) made Better Auth
		// look up a missing email and log "User not found".
		return await auth.api.signInEmail({
			body: {
				email,
				password,
				rememberMe: parsedBody?.rememberMe !== false,
				...(typeof parsedBody?.callbackURL === "string"
					? { callbackURL: parsedBody.callbackURL }
					: {}),
			},
			headers: authHeaders,
			asResponse: true,
		});
	} catch (error) {
		console.error("❌ Auth sign-in gate error:", error);
		return c.json({ error: "Auth handler failed" }, 500);
	}
}

app.post("/api/auth/sign-in/email", (c) => handleEmailSignIn(c));
app.post("/api/auth/signin/email", (c) => handleEmailSignIn(c));

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

void ensurePipelineStageEnumValues()
	.then(() => console.log("✅ Pipeline stage enum values ready"))
	.catch((e) =>
		console.warn(
			"⚠️ Pipeline stage enum bootstrap failed (stage updates may fail until SQL patch is applied):",
			e instanceof Error ? e.message : e,
		),
	);

void ensureDocumentCategoryEnumValues()
	.then(() => console.log("✅ Document category enum values ready"))
	.catch((e) =>
		console.warn(
			"⚠️ Document category enum bootstrap failed:",
			e instanceof Error ? e.message : e,
		),
	);

startServer(app);

export default {} as Record<string, never>;
