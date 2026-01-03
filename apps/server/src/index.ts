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
		origin: [
			// Allow all localhost origins for development
			"http://localhost:3000",
			"http://localhost:3001",
			"http://localhost:3002",
			// Allow all Vercel domains (wildcard pattern)
			"https://steelix-final-web.vercel.app",
			"https://steelix-final-web-git-master-lkmariobros-projects.vercel.app",
			"https://steelix-final-mx4or73lk-lkmariobros-projects.vercel.app",
			// Add branch-specific URLs
			"https://steelix-final-web-git-admin-typescript-errors-solved-lkmariobros-projects.vercel.app",
			...(process.env.CORS_ORIGIN?.split(',') || []),
		],
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
		credentials: true, // CRITICAL: Enable credentials for cross-origin cookies
		exposeHeaders: ["Set-Cookie"], // Allow frontend to see Set-Cookie headers
	}),
);

// Better Auth handler - handle all auth routes
app.all("/api/auth/*", async (c) => {
	console.log(`🔐 Auth request: ${c.req.method} ${c.req.url}`);
	console.log(`🔐 Auth path: ${c.req.path}`);
	console.log("🔐 Auth headers:", Object.fromEntries(c.req.raw.headers.entries()));

	try {
		// Create a new Request object with the correct URL structure
		const url = new URL(c.req.url);
		const authPath = url.pathname.replace('/api/auth', '');
		console.log(`🔐 Extracted auth path: ${authPath}`);

		// Create request for Better Auth handler
		const authRequest = new Request(url.toString(), {
			method: c.req.method,
			headers: c.req.raw.headers,
			body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? c.req.raw.body : undefined,
		});

		const result = await auth.handler(authRequest);
		console.log("🔐 Auth handler result:", result ? "Response received" : "No response");

		if (!result) {
			console.log("⚠️ Auth handler returned null/undefined - creating 404 response");
			return c.json({
				error: "Auth endpoint not found",
				path: c.req.path,
				authPath: authPath,
				availableEndpoints: ['/session', '/sign-in', '/sign-up', '/sign-out']
			}, 404);
		}

		return result;
	} catch (error) {
		console.error("❌ Auth handler error:", error);
		return c.json({ error: "Auth handler failed", details: error instanceof Error ? error.message : String(error) }, 500);
	}
});

// Fallback auth handler for root auth paths (in case Better Auth expects different routing)
app.all("/auth/*", async (c) => {
	console.log(`🔐 Fallback auth request: ${c.req.method} ${c.req.url}`);
	try {
		const result = await auth.handler(c.req.raw);
		return result || c.json({ error: "Auth endpoint not found" }, 404);
	} catch (error) {
		console.error("❌ Fallback auth handler error:", error);
		return c.json({ error: "Auth handler failed", details: error instanceof Error ? error.message : String(error) }, 500);
	}
});

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
	console.log("🔍 Debug: Checking auth configuration");
	console.log("🔍 Auth object:", auth);
	console.log("🔍 Auth handler:", auth?.handler);

	return c.json({
		betterAuthUrl: process.env.BETTER_AUTH_URL,
		corsOrigins: process.env.CORS_ORIGIN?.split(',') || [],
		hasSecret: !!process.env.BETTER_AUTH_SECRET,
		hasDatabaseUrl: !!process.env.DATABASE_URL,
		nodeEnv: process.env.NODE_ENV,
		authInitialized: !!auth,
		authHandlerExists: typeof auth?.handler === 'function',
		authObjectType: typeof auth,
		authHandlerType: typeof auth?.handler,
		timestamp: new Date().toISOString()
	});
});

// Debug endpoint to test auth session directly
app.get("/debug/auth-session", async (c) => {
	try {
		console.log("🔍 Debug: Testing auth session directly");
		console.log("🔍 Request headers:", Object.fromEntries(c.req.raw.headers.entries()));

		// Try to get session using Better Auth
		const session = await auth.api.getSession({
			headers: c.req.raw.headers
		});

		return c.json({
			hasSession: !!session,
			session: session ? {
				userId: session.user?.id,
				userEmail: session.user?.email,
				sessionId: session.session?.id
			} : null,
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		console.error("❌ Debug auth session error:", error);
		return c.json({
			error: "Failed to get session",
			details: error instanceof Error ? error.message : String(error),
			timestamp: new Date().toISOString()
		}, 500);
	}
});

// Manual test endpoint for auth session endpoint
app.get("/debug/test-auth-session", async (c) => {
	try {
		console.log("🧪 Manual test: Creating auth session request");

		// Create a manual request to the auth session endpoint
		const sessionUrl = `${process.env.BETTER_AUTH_URL || 'http://localhost:8080'}/api/auth/session`;
		console.log("🧪 Session URL:", sessionUrl);

		const response = await fetch(sessionUrl, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'Cookie': c.req.header('Cookie') || '',
			}
		});

		console.log("🧪 Session response status:", response.status);
		const responseText = await response.text();
		console.log("🧪 Session response body:", responseText);

		return c.json({
			sessionUrl,
			status: response.status,
			headers: Object.fromEntries(response.headers.entries()),
			body: responseText,
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		console.error("❌ Manual auth session test error:", error);
		return c.json({
			error: "Failed to test auth session",
			details: error instanceof Error ? error.message : String(error),
			timestamp: new Date().toISOString()
		}, 500);
	}
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

// Temporary debug endpoints removed after authentication issue was resolved

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

// For Bun runtime, we export the app directly and let Bun handle serving
// For Railway deployment, we'll use a different approach
if (process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT) {
	// Use @hono/node-server for Railway
	import("@hono/node-server").then(({ serve }) => {
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
	});
} else {
	// For development with Bun, actually start the server
	try {
		const server = Bun.serve({
			fetch: app.fetch,
			port: Number(port),
			hostname: "localhost",
		});

		console.log(`✅ Development server started successfully on port ${port}`);
		console.log(`🌐 Server accessible at http://localhost:${port}`);
		console.log("🔥 Hot reload enabled");

		// Handle graceful shutdown
		process.on("SIGTERM", () => {
			console.log("🛑 SIGTERM received, shutting down gracefully");
			server.stop();
			process.exit(0);
		});

		process.on("SIGINT", () => {
			console.log("🛑 SIGINT received, shutting down gracefully");
			server.stop();
			process.exit(0);
		});
	} catch (error) {
		console.error("❌ Failed to start development server:", error);
		process.exit(1);
	}
}

// Export the app for compatibility
export default app;
