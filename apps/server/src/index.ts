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

// ✅ SECURITY: Use environment-based CORS configuration
const isDevelopment = process.env.NODE_ENV !== "production";

// Build CORS origins from environment variables
const getCorsOrigins = (): string[] => {
	const origins: string[] = [];

	// Development origins (only in dev mode)
	if (isDevelopment) {
		origins.push(
			"http://localhost:3000",
			"http://localhost:3001",
			"http://localhost:3002"
		);
	}

	// Production origins from environment variable
	// Format: CORS_ORIGINS=https://app.example.com,https://admin.example.com
	const envOrigins = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN;
	if (envOrigins) {
		origins.push(...envOrigins.split(",").map(o => o.trim()).filter(Boolean));
	}

	// Fallback for Vercel preview deployments (configurable via env)
	const vercelProjectName = process.env.VERCEL_PROJECT_NAME;
	if (vercelProjectName) {
		// Allow main deployment and preview deployments
		origins.push(`https://${vercelProjectName}.vercel.app`);
	}

	return origins;
};

app.use(logger());
app.use(
	"/*",
	cors({
		origin: getCorsOrigins(),
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
	// ✅ SECURITY: Only log in development, and never log sensitive data
	if (isDevelopment) {
		console.log(`🔐 Auth request: ${c.req.method} ${c.req.path}`);
	}

	try {
		// Create a new Request object with the correct URL structure
		const url = new URL(c.req.url);
		const authPath = url.pathname.replace("/api/auth", "");

		// Get request body (needed for POST requests)
		let bodyText = "";
		if (c.req.method !== "GET" && c.req.method !== "HEAD") {
			try {
				bodyText = await c.req.text();
			} catch {
				// Body already consumed or empty - this is fine
			}
		}

		// Create request for Better Auth handler
		const authRequest = new Request(url.toString(), {
			method: c.req.method,
			headers: c.req.raw.headers,
			body: bodyText || undefined,
		});

		const result = await auth.handler(authRequest);

		if (!result) {
			// ✅ SECURITY: Don't expose internal paths in production
			return c.json({
				error: "Auth endpoint not found",
				message: "The requested authentication endpoint does not exist",
			}, 404);
		}

		// ✅ SECURITY: Only log errors in development
		if (isDevelopment && result.status >= 400) {
			const clonedResponse = result.clone();
			try {
				const responseBody = await clonedResponse.text();
				console.log("🔐 Auth error response:", responseBody);
			} catch {
				// Could not read response body
			}
		}

		return result;
	} catch (error) {
		console.error("❌ Auth handler error:", error instanceof Error ? error.message : "Unknown error");
		// ✅ SECURITY: Don't expose error details in production
		return c.json({
			error: "Auth handler failed",
			message: isDevelopment && error instanceof Error ? error.message : "Authentication service error",
		}, 500);
	}
});

// Fallback auth handler for root auth paths (in case Better Auth expects different routing)
app.all("/auth/*", async (c) => {
	if (isDevelopment) {
		console.log(`🔐 Fallback auth request: ${c.req.method} ${c.req.path}`);
	}
	try {
		const result = await auth.handler(c.req.raw);
		return result || c.json({ error: "Auth endpoint not found" }, 404);
	} catch (error) {
		console.error("❌ Fallback auth handler error:", error instanceof Error ? error.message : "Unknown error");
		return c.json({
			error: "Auth handler failed",
			message: isDevelopment && error instanceof Error ? error.message : "Authentication service error",
		}, 500);
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
	return c.text(`OK - Server is working! Time: ${new Date().toISOString()}`);
});

app.get("/health", (c) => {
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
// ✅ SECURITY: Only available in development
app.get("/debug/auth-config", (c) => {
	if (!isDevelopment) {
		return c.json({ error: "Debug endpoints disabled in production" }, 403);
	}

	return c.json({
		betterAuthUrl: process.env.BETTER_AUTH_URL,
		corsOrigins: getCorsOrigins(),
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

// ✅ SECURITY: All debug endpoints are development-only
// Debug endpoint to test auth session directly
app.get("/debug/auth-session", async (c) => {
	if (!isDevelopment) {
		return c.json({ error: "Debug endpoints disabled in production" }, 403);
	}
	try {
		const session = await auth.api.getSession({
			headers: c.req.raw.headers
		});

		return c.json({
			hasSession: !!session,
			session: session ? {
				userId: session.user?.id,
				// ✅ SECURITY: Don't expose email even in dev
				hasEmail: !!session.user?.email,
				sessionId: session.session?.id
			} : null,
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		return c.json({
			error: "Failed to get session",
			message: error instanceof Error ? error.message : "Unknown error",
			timestamp: new Date().toISOString()
		}, 500);
	}
});

// Debug endpoint to test database connection
app.get("/debug/db-test", async (c) => {
	if (!isDevelopment) {
		return c.json({ error: "Debug endpoints disabled in production" }, 403);
	}
	try {
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
			error: error instanceof Error ? error.message : "Unknown error"
		}, 500);
	}
});

// Debug endpoint to test auth session
app.get("/debug/session-test", async (c) => {
	if (!isDevelopment) {
		return c.json({ error: "Debug endpoints disabled in production" }, 403);
	}
	try {
		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});
		return c.json({
			hasSession: !!session,
			session: session ? {
				userId: session.user.id,
				// ✅ SECURITY: Don't expose email
				hasEmail: !!session.user.email,
				hasName: !!session.user.name
			} : null,
			hasCookies: !!c.req.header("cookie"),
		});
	} catch (error) {
		return c.json({
			error: error instanceof Error ? error.message : "Unknown error",
			hasSession: false
		}, 500);
	}
});

const port = process.env.PORT || 3000;

// ✅ SECURITY: Minimal startup logging in production
console.log(`🚀 Server starting on port ${port}`);
if (isDevelopment) {
	console.log("📊 Environment check:");
	console.log(`   - NODE_ENV: ${process.env.NODE_ENV}`);
	console.log(`   - PORT: ${process.env.PORT}`);
	console.log(`   - DATABASE_URL: ${process.env.DATABASE_URL ? "SET" : "NOT SET"}`);
	console.log(`   - BETTER_AUTH_URL: ${process.env.BETTER_AUTH_URL}`);
}

// Detect runtime environment
const isBunRuntime = typeof globalThis.Bun !== "undefined";
const isProduction = process.env.NODE_ENV === "production" || !!process.env.RAILWAY_ENVIRONMENT;

if (isBunRuntime) {
	// For development with Bun runtime
	try {
		const server = Bun.serve({
			fetch: app.fetch,
			port: Number(port),
			hostname: "localhost",
		});

		console.log(`✅ Server started on port ${port}`);
		if (isDevelopment) {
			console.log(`🌐 Server accessible at http://localhost:${port}`);
		}

		// Handle graceful shutdown
		process.on("SIGTERM", () => {
			server.stop();
			process.exit(0);
		});

		process.on("SIGINT", () => {
			server.stop();
			process.exit(0);
		});
	} catch (error) {
		console.error("❌ Failed to start server:", error instanceof Error ? error.message : "Unknown error");
		process.exit(1);
	}
} else {
	// For Node.js runtime (production on Railway or local with Node)
	import("@hono/node-server").then(({ serve }) => {
		try {
			const hostname = isProduction ? "0.0.0.0" : "localhost";
			serve({
				fetch: app.fetch,
				port: Number(port),
				hostname,
			});

			console.log(`✅ Server bound to ${hostname}:${port}`);
			if (isProduction) {
				// ✅ SECURITY: Don't log specific URLs in production
				console.log("🌐 Server ready for incoming connections");
			} else if (isDevelopment) {
				console.log(`🌐 Server accessible at http://localhost:${port}`);
			}

			// Handle graceful shutdown (silent in production)
			process.on("SIGTERM", () => {
				if (isDevelopment) console.log("🛑 Shutting down gracefully");
				process.exit(0);
			});

			process.on("SIGINT", () => {
				if (isDevelopment) console.log("🛑 Shutting down gracefully");
				process.exit(0);
			});
		} catch (error) {
			console.error("❌ Failed to start server:", error instanceof Error ? error.message : "Unknown error");
			process.exit(1);
		}
	});
}

// Export the app for compatibility
export default app;
