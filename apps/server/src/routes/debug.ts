import { Hono } from "hono";
import { getAllowedOrigins } from "../utils/allowed-origins";
import { db } from "../utils/db";
import { getSession } from "../utils/session";

const app = new Hono();

app.get("/debug/auth-config", (c) => {
	return c.json({
		corsOrigins: getAllowedOrigins(),
		hasDatabaseUrl: !!process.env.DATABASE_URL,
		nodeEnv: process.env.NODE_ENV,
		timestamp: new Date().toISOString(),
	});
});

app.get("/debug/auth-session", async (c) => {
	try {
		const session = await getSession(c.req.raw.headers);
		return c.json({
			hasSession: !!session,
			session: session
				? { userId: session.user.id, userEmail: session.user.email }
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
