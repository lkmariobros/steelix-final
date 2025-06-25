import "dotenv/config";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./lib/auth";
import { createContext } from "./lib/context";
import { appRouter } from "./routers/index";
import { db } from "./db";

const app = new Hono();

app.use(logger());
app.use(
	"/*",
	cors({
		origin: process.env.CORS_ORIGIN?.split(',') || [],
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization", "Cookie"],
		credentials: true,
	}),
);

app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw));

app.use(
	"/trpc/*",
	trpcServer({
		router: appRouter,
		createContext: (_opts, context) => {
			return createContext({ context });
		},
	}),
);

app.get("/", (c) => {
	console.log(`📥 Received request to / at ${new Date().toISOString()}`);
	console.log("📊 Request headers:", c.req.header());
	console.log("🌐 Request URL:", c.req.url);
	return c.text(`OK - Server is working! Time: ${new Date().toISOString()}`);
});

app.get("/health", (c) => {
	console.log(`🏥 Health check requested at ${new Date().toISOString()}`);
	return c.json({
		status: "healthy",
		timestamp: new Date().toISOString(),
		port: process.env.PORT,
		env: process.env.NODE_ENV,
	});
});

// Railway might check these paths
app.get("/healthz", (c) => c.text("OK"));
app.get("/ping", (c) => c.text("pong"));
app.get("/.well-known/health", (c) => c.json({ status: "ok" }));

// Debug endpoint to check auth configuration
app.get("/debug/auth-config", (c) => {
	return c.json({
		betterAuthUrl: process.env.BETTER_AUTH_URL,
		corsOrigins: process.env.CORS_ORIGIN?.split(',') || [],
		hasSecret: !!process.env.BETTER_AUTH_SECRET,
		hasDatabaseUrl: !!process.env.DATABASE_URL,
		nodeEnv: process.env.NODE_ENV,
		timestamp: new Date().toISOString()
	});
});

// Debug endpoint to test database connection
app.get("/debug/db-test", async (c) => {
	try {
		// Simple query to test database connection
		const result = await db.execute("SELECT 1 as test");
		return c.json({
			status: "success",
			dbConnected: true,
			testQuery: result
		});
	} catch (error) {
		return c.json({
			status: "error",
			dbConnected: false,
			error: error instanceof Error ? error.message : String(error)
		}, 500);
	}
});

// Debug endpoint to test auth session
app.get("/debug/session-test", async (c) => {
	try {
		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});
		return c.json({
			hasSession: !!session,
			session: session ? {
				userId: session.user.id,
				email: session.user.email,
				name: session.user.name
			} : null,
			cookies: c.req.header('cookie') || 'No cookies',
			headers: Object.fromEntries(c.req.raw.headers.entries())
		});
	} catch (error) {
		return c.json({
			error: error instanceof Error ? error.message : String(error),
			hasSession: false
		}, 500);
	}
});

const port = process.env.PORT || 3000;

console.log(`🚀 Server starting on port ${port}`);
console.log("📊 Environment check:");
console.log(`   - NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`   - PORT: ${process.env.PORT}`);
console.log(
	`   - DATABASE_URL: ${process.env.DATABASE_URL ? "SET" : "NOT SET"}`,
);
console.log(`   - BETTER_AUTH_URL: ${process.env.BETTER_AUTH_URL}`);

// For Railway deployment, we need to use serve() to start the server
import { serve } from "@hono/node-server";

try {
	const server = serve({
		fetch: app.fetch,
		port: Number(port),
		hostname: "0.0.0.0", // Bind to all interfaces for Railway
	});

	console.log(`✅ Server successfully bound to 0.0.0.0:${port}`);
	console.log(
		"🌐 Server should be accessible at https://steelix-final-production.up.railway.app",
	);

	// Keep the process alive
	process.on("SIGTERM", () => {
		console.log("🛑 SIGTERM received, shutting down gracefully");
		server.close(() => {
			console.log("✅ Server closed");
			process.exit(0);
		});
	});

	process.on("SIGINT", () => {
		console.log("🛑 SIGINT received, shutting down gracefully");
		server.close(() => {
			console.log("✅ Server closed");
			process.exit(0);
		});
	});
} catch (error) {
	console.error("❌ Failed to start server:", error);
	process.exit(1);
}

export default app;
