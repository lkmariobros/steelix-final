/**
 * Debug routes — only mounted in non-production environments.
 * Provides endpoints for testing auth, session, and database connectivity.
 */
import { Hono } from "hono";
import { auth } from "../utils/auth";
import { db } from "../utils/db";

const app = new Hono();

// ─── Auth configuration info ─────────────────────────────────────────────────

app.get("/debug/auth-config", (c) => {
	return c.json({
		betterAuthUrl: process.env.BETTER_AUTH_URL,
		corsOrigins: process.env.CORS_ORIGIN?.split(",") || [],
		hasSecret: !!process.env.BETTER_AUTH_SECRET,
		hasDatabaseUrl: !!process.env.DATABASE_URL,
		nodeEnv: process.env.NODE_ENV,
		authInitialized: !!auth,
		authHandlerType: typeof auth?.handler,
		timestamp: new Date().toISOString(),
	});
});

// ─── Auth session test ───────────────────────────────────────────────────────

app.get("/debug/auth-session", async (c) => {
	try {
		const session = await auth.api.getSession({ headers: c.req.raw.headers });
		return c.json({
			hasSession: !!session,
			session: session
				? { userId: session.user?.id, userEmail: session.user?.email }
				: null,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		return c.json(
			{
				error: "Failed to get session",
				details: error instanceof Error ? error.message : String(error),
			},
			500,
		);
	}
});

app.get("/debug/session-test", async (c) => {
	try {
		const session = await auth.api.getSession({ headers: c.req.raw.headers });
		return c.json({
			hasSession: !!session,
			session: session
				? {
						userId: session.user.id,
						email: session.user.email,
						name: session.user.name,
					}
				: null,
			cookies: c.req.header("cookie") || "No cookies",
		});
	} catch (error) {
		return c.json(
			{
				error: error instanceof Error ? error.message : String(error),
				hasSession: false,
			},
			500,
		);
	}
});

// ─── Manual auth session request test ────────────────────────────────────────

app.get("/debug/test-auth-session", async (c) => {
	try {
		const sessionUrl = `${process.env.BETTER_AUTH_URL || "http://localhost:8080"}/api/auth/session`;
		const response = await fetch(sessionUrl, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
				Cookie: c.req.header("Cookie") || "",
			},
		});

		const body = await response.text();
		return c.json({
			sessionUrl,
			status: response.status,
			headers: Object.fromEntries(response.headers.entries()),
			body,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		return c.json(
			{
				error: "Failed to test auth session",
				details: error instanceof Error ? error.message : String(error),
			},
			500,
		);
	}
});

// ─── Database connectivity test ───────────────────────────────────────────────

app.get("/debug/db-test", async (c) => {
	try {
		const result = await db.execute("SELECT 1 as test");
		return c.json({ status: "success", dbConnected: true, testQuery: result });
	} catch (error) {
		return c.json(
			{
				status: "error",
				dbConnected: false,
				error: error instanceof Error ? error.message : String(error),
			},
			500,
		);
	}
});

export { app as debugRoutes };
