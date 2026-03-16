import "dotenv/config";
import { trpcServer } from "@hono/trpc-server";
import type { Context } from "hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { db } from "./db";
import { auth } from "./lib/auth";
import { createContext } from "./lib/context";
import { appRouter } from "./routers/index";

const app = new Hono();

// Global error handler to prevent crashes
app.onError((err, c) => {
	console.error("❌ Unhandled error in Hono app:", err);
	console.error("❌ Error stack:", err.stack);
	console.error("❌ Request path:", c.req.path);
	console.error("❌ Request method:", c.req.method);

	return c.json(
		{
			error: "Internal server error",
			message: err.message || "An unexpected error occurred",
			...(process.env.NODE_ENV === "development" && { stack: err.stack }),
		},
		500,
	);
});

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
			...(process.env.CORS_ORIGIN?.split(",") || []),
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
	console.log(
		"🔐 Auth headers:",
		Object.fromEntries(c.req.raw.headers.entries()),
	);

	try {
		// Create a new Request object with the correct URL structure
		const url = new URL(c.req.url);
		const authPath = url.pathname.replace("/api/auth", "");
		console.log(`🔐 Extracted auth path: ${authPath}`);

		// Get request body for logging
		let bodyText = "";
		if (c.req.method !== "GET" && c.req.method !== "HEAD") {
			try {
				bodyText = await c.req.text();
				console.log(
					"🔐 Auth request body:",
					bodyText ? `${bodyText.substring(0, 100)}...` : "(empty)",
				);
			} catch (e) {
				console.log("🔐 Could not read body:", e);
			}
		}

		// Create request for Better Auth handler
		const authRequest = new Request(url.toString(), {
			method: c.req.method,
			headers: c.req.raw.headers,
			body: bodyText || undefined,
		});

		console.log("🔐 Calling auth.handler...");
		const result = await auth.handler(authRequest);
		console.log(
			"🔐 Auth handler result:",
			result ? `Response received (status: ${result.status})` : "No response",
		);

		if (!result) {
			console.log(
				"⚠️ Auth handler returned null/undefined - creating 404 response",
			);
			return c.json(
				{
					error: "Auth endpoint not found",
					path: c.req.path,
					authPath: authPath,
					availableEndpoints: ["/session", "/sign-in", "/sign-up", "/sign-out"],
				},
				404,
			);
		}

		// Log response body for debugging
		if (result.status >= 400) {
			const clonedResponse = result.clone();
			try {
				const responseBody = await clonedResponse.text();
				console.log("🔐 Auth error response body:", responseBody);
			} catch (e) {
				console.log("🔐 Could not read response body");
			}
		}

		return result;
	} catch (error) {
		console.error("❌ Auth handler error:", error);
		console.error(
			"❌ Error stack:",
			error instanceof Error ? error.stack : "No stack",
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

// Fallback auth handler for root auth paths (in case Better Auth expects different routing)
app.all("/auth/*", async (c) => {
	console.log(`🔐 Fallback auth request: ${c.req.method} ${c.req.url}`);
	try {
		const result = await auth.handler(c.req.raw);
		return result || c.json({ error: "Auth endpoint not found" }, 404);
	} catch (error) {
		console.error("❌ Fallback auth handler error:", error);
		return c.json(
			{
				error: "Auth handler failed",
				details: error instanceof Error ? error.message : String(error),
			},
			500,
		);
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

// Kapso WhatsApp Webhook - receives incoming messages from Kapso
// Support multiple webhook paths that Kapso might use
const handleKapsoWebhookRequest = async (c: Context) => {
	try {
		const body = await c.req.json();
		console.log("📨 Kapso webhook received at:", c.req.path);
		console.log("📨 Webhook payload:", JSON.stringify(body, null, 2));

		// Import webhook handler (dynamic import to avoid circular dependencies)
		const { handleKapsoWebhook } = await import("./lib/kapso-webhook");
		const result = await handleKapsoWebhook(body);

		if (result.success) {
			console.log("✅ Webhook processed successfully");
			return c.json({ success: true, message: "Webhook processed" }, 200);
		}
		console.error("❌ Webhook processing failed:", result.error);
		return c.json(
			{ success: false, error: result.error },
			(result.statusCode || 400) as 200 | 400 | 500,
		);
	} catch (error: unknown) {
		const msg =
			error instanceof Error ? error.message : "Webhook processing failed";
		console.error("❌ Kapso webhook error:", error);
		if (error instanceof Error) console.error("❌ Error stack:", error.stack);
		return c.json({ success: false, error: msg }, 500);
	}
};

// Register webhook endpoints for different Kapso webhook URL formats
// Kapso is calling: /webhooks/kapso/whatsapp (plural "webhooks" with "/whatsapp" suffix)
app.post("/webhook/kapso", handleKapsoWebhookRequest);
app.post("/webhooks/kapso", handleKapsoWebhookRequest);
app.post("/webhooks/kapso/whatsapp", handleKapsoWebhookRequest); // This is what Kapso is calling!
app.post("/webhook/kapso/whatsapp", handleKapsoWebhookRequest);
// Test endpoint to send first message (initiates conversation)
app.post("/test/send-first-message", async (c) => {
	try {
		const { phoneNumber, message } = await c.req.json();

		if (!phoneNumber) {
			return c.json({ error: "phoneNumber is required" }, 400);
		}

		const { getKapsoClient } = await import("./lib/kapso");
		const kapsoClient = getKapsoClient();

		if (!kapsoClient) {
			return c.json({ error: "Kapso client not configured" }, 500);
		}

		// Format phone number (ensure it starts with + and remove any double plus)
		let formattedPhone = phoneNumber.trim();
		// Remove any double plus signs
		formattedPhone = formattedPhone.replace(/^\+\+/, "+");
		// Ensure it starts with +
		if (!formattedPhone.startsWith("+")) {
			formattedPhone = `+${formattedPhone}`;
		}
		const messageText =
			message ||
			"Hello! This is a test message from your WhatsApp Business account. You can now reply to this message.";

		console.log(`📤 Sending first message to ${formattedPhone}...`);

		const result = await kapsoClient.sendMessage({
			to: formattedPhone,
			message: messageText,
		});

		if (result.success) {
			return c.json({
				success: true,
				message: "First message sent successfully!",
				messageId: result.messageId,
				note: "The recipient can now reply to this message within 24 hours.",
			});
		}
		return c.json(
			{
				success: false,
				error: result.error || "Failed to send message",
			},
			500,
		);
	} catch (error: unknown) {
		console.error("❌ Test send message error:", error);
		return c.json(
			{
				success: false,
				error:
					error instanceof Error
						? error.message
						: "Failed to send test message",
			},
			500,
		);
	}
});

// Debug endpoint to check WhatsApp conversations in database
app.get("/debug/whatsapp-conversations", async (c) => {
	try {
		const { db } = await import("./db");
		const { whatsappConversations, whatsappMessages } = await import(
			"./db/schema/whatsapp"
		);

		const allConversations = await db
			.select()
			.from(whatsappConversations)
			.limit(20);

		const allMessages = await db.select().from(whatsappMessages).limit(20);

		return c.json({
			conversationsCount: allConversations.length,
			conversations: allConversations.map((conv) => ({
				id: conv.id,
				kapsoContactId: conv.kapsoContactId,
				contactName: conv.contactName,
				contactPhone: conv.contactPhone,
				assignedAgentId: conv.assignedAgentId,
				lastMessage: conv.lastMessage,
				unreadCount: conv.unreadCount,
				lastMessageAt: conv.lastMessageAt,
				createdAt: conv.createdAt,
			})),
			messagesCount: allMessages.length,
			messages: allMessages.map((msg) => ({
				id: msg.id,
				conversationId: msg.conversationId,
				content: msg.content,
				direction: msg.direction,
				status: msg.status,
				sentAt: msg.sentAt,
			})),
		});
	} catch (error: unknown) {
		console.error("❌ Error in /debug/whatsapp-conversations:", error);
		return c.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to fetch conversations",
			},
			500,
		);
	}
});

// Debug endpoint to test Kapso API connection
app.get("/test/kapso-connection", async (c) => {
	try {
		const { getKapsoClient } = await import("./lib/kapso");
		const kapsoClient = getKapsoClient();

		if (!kapsoClient) {
			return c.json(
				{
					error: "Kapso client not configured",
					hint: "Check KAPSO_API_KEY in .env file",
				},
				500,
			);
		}

		// Get the API URL being used
		const apiUrl = process.env.KAPSO_API_URL || "https://api.kapso.ai";

		// Test different endpoints (Kapso uses /meta/whatsapp/v24.0 as base)
		const testEndpoints = [
			`${apiUrl}/meta/whatsapp/v24.0/messages`,
			`${apiUrl}/v1/messages`,
			`${apiUrl}/api/v1/messages`,
			`${apiUrl}/messages`,
			`${apiUrl}/health`,
			`${apiUrl}/api/health`,
		];

		const results = [];

		for (const endpoint of testEndpoints) {
			try {
				const response = await fetch(endpoint, {
					method: "GET",
					headers: {
						Authorization: `Bearer ${process.env.KAPSO_API_KEY}`,
					},
				});
				results.push({
					endpoint,
					status: response.status,
					statusText: response.statusText,
					reachable: true,
				});
			} catch (error: unknown) {
				const e = error as { message?: string; code?: string };
				results.push({
					endpoint,
					reachable: false,
					error: e?.message,
					code: e?.code,
				});
			}
		}

		return c.json({
			apiUrl,
			apiKeySet: !!process.env.KAPSO_API_KEY,
			apiKeyLength: process.env.KAPSO_API_KEY?.length || 0,
			testResults: results,
			recommendation:
				"Check your Kapso dashboard for the correct API URL and update KAPSO_API_URL in .env",
		});
	} catch (error: unknown) {
		return c.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to test connection",
			},
			500,
		);
	}
});

app.get("/.well-known/health", (c) => c.json({ status: "ok" }));

// Debug endpoint to check auth configuration
app.get("/debug/auth-config", (c) => {
	console.log("🔍 Debug: Checking auth configuration");
	console.log("🔍 Auth object:", auth);
	console.log("🔍 Auth handler:", auth?.handler);

	return c.json({
		betterAuthUrl: process.env.BETTER_AUTH_URL,
		corsOrigins: process.env.CORS_ORIGIN?.split(",") || [],
		hasSecret: !!process.env.BETTER_AUTH_SECRET,
		hasDatabaseUrl: !!process.env.DATABASE_URL,
		nodeEnv: process.env.NODE_ENV,
		authInitialized: !!auth,
		authHandlerExists: typeof auth?.handler === "function",
		authObjectType: typeof auth,
		authHandlerType: typeof auth?.handler,
		timestamp: new Date().toISOString(),
	});
});

// Debug endpoint to test auth session directly
app.get("/debug/auth-session", async (c) => {
	try {
		console.log("🔍 Debug: Testing auth session directly");
		console.log(
			"🔍 Request headers:",
			Object.fromEntries(c.req.raw.headers.entries()),
		);

		// Try to get session using Better Auth
		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});

		return c.json({
			hasSession: !!session,
			session: session
				? {
						userId: session.user?.id,
						userEmail: session.user?.email,
						sessionId: session.session?.id,
					}
				: null,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("❌ Debug auth session error:", error);
		return c.json(
			{
				error: "Failed to get session",
				details: error instanceof Error ? error.message : String(error),
				timestamp: new Date().toISOString(),
			},
			500,
		);
	}
});

// Manual test endpoint for auth session endpoint
app.get("/debug/test-auth-session", async (c) => {
	try {
		console.log("🧪 Manual test: Creating auth session request");

		// Create a manual request to the auth session endpoint
		const sessionUrl = `${process.env.BETTER_AUTH_URL || "http://localhost:8080"}/api/auth/session`;
		console.log("🧪 Session URL:", sessionUrl);

		const response = await fetch(sessionUrl, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
				Cookie: c.req.header("Cookie") || "",
			},
		});

		console.log("🧪 Session response status:", response.status);
		const responseText = await response.text();
		console.log("🧪 Session response body:", responseText);

		return c.json({
			sessionUrl,
			status: response.status,
			headers: Object.fromEntries(response.headers.entries()),
			body: responseText,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("❌ Manual auth session test error:", error);
		return c.json(
			{
				error: "Failed to test auth session",
				details: error instanceof Error ? error.message : String(error),
				timestamp: new Date().toISOString(),
			},
			500,
		);
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
			testQuery: result,
		});
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

// Temporary debug endpoints removed after authentication issue was resolved

// Debug endpoint to test auth session
app.get("/debug/session-test", async (c) => {
	try {
		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});
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
			headers: Object.fromEntries(c.req.raw.headers.entries()),
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

const port = process.env.PORT || 8080;

// Add global error handlers to prevent crashes
process.on("unhandledRejection", (reason, promise) => {
	console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
	// Don't exit - log and continue
});

process.on("uncaughtException", (error) => {
	console.error("❌ Uncaught Exception:", error);
	// Don't exit - log and continue (server should keep running)
});

console.log(`🚀 Server starting on port ${port}`);
console.log("📊 Environment check:");
console.log(`   - NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`   - PORT: ${process.env.PORT}`);
console.log(
	`   - DATABASE_URL: ${process.env.DATABASE_URL ? "SET" : "NOT SET"}`,
);
console.log(`   - BETTER_AUTH_URL: ${process.env.BETTER_AUTH_URL}`);

// Detect runtime environment
const isBunRuntime = typeof globalThis.Bun !== "undefined";
const isProduction =
	process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT;

if (isBunRuntime) {
	// For development with Bun runtime
	// Store server reference globally to handle hot reload
	const globalServer = globalThis as unknown as {
		server?: ReturnType<typeof Bun.serve>;
		serverStopping?: boolean;
	};

	// Helper function to check if port is available
	const checkPortAvailable = async (port: number): Promise<boolean> => {
		try {
			const server = Bun.serve({
				fetch: () => new Response("test"),
				port,
				hostname: "127.0.0.1",
			});
			server.stop();
			return true;
		} catch {
			return false;
		}
	};

	// Stop existing server if it exists (for hot reload)
	if (globalServer.server && !globalServer.serverStopping) {
		try {
			console.log("🔄 Stopping existing server for hot reload...");
			globalServer.serverStopping = true;
			globalServer.server.stop(true); // Force stop immediately
			globalServer.server = undefined;
			// Wait longer for port to be released
			await new Promise((resolve) => setTimeout(resolve, 1000));
			globalServer.serverStopping = false;
		} catch (error) {
			console.warn("⚠️ Error stopping existing server:", error);
			globalServer.serverStopping = false;
		}
	}

	// Start server with retry logic for hot reload
	let retryCount = 0;
	const MAX_RETRIES = 15; // Increased to 15 retries (7.5 seconds total)

	const startServer = async () => {
		if (globalServer.serverStopping) {
			// Wait a bit and retry
			setTimeout(startServer, 300);
			return;
		}

		// Check if port is available before trying to start
		const portAvailable = await checkPortAvailable(Number(port));
		if (!portAvailable && retryCount < MAX_RETRIES) {
			retryCount++;
			console.warn(
				`⚠️ Port ${port} is still in use, waiting... (${retryCount}/${MAX_RETRIES})`,
			);
			setTimeout(startServer, 500);
			return;
		}

		try {
			const server = Bun.serve({
				fetch: app.fetch,
				port: Number(port),
				hostname: "127.0.0.1", // Use 127.0.0.1 for better Windows compatibility
				idleTimeout: 60, // 60 seconds timeout for long-running queries (default is 10s)
			});

			// Store server reference for hot reload
			globalServer.server = server;
			retryCount = 0; // Reset retry count on success

			console.log(`✅ Development server started successfully on port ${port}`);
			console.log(`🌐 Server accessible at http://localhost:${port}`);
			console.log("🔥 Hot reload enabled");

			// Handle graceful shutdown
			process.on("SIGTERM", () => {
				console.log("🛑 SIGTERM received, shutting down gracefully");
				server.stop();
				globalServer.server = undefined;
				process.exit(0);
			});

			process.on("SIGINT", () => {
				console.log("🛑 SIGINT received, shutting down gracefully");
				server.stop();
				globalServer.server = undefined;
				process.exit(0);
			});
		} catch (error: unknown) {
			const e = error as { code?: string; message?: string };
			// If port is in use, wait and retry (common during hot reload)
			if (
				(e?.code === "EADDRINUSE" ||
					e?.message?.includes("port") ||
					e?.message?.includes("in use")) &&
				retryCount < MAX_RETRIES
			) {
				retryCount++;
				console.warn(
					`⚠️ Port ${port} is in use, retrying (${retryCount}/${MAX_RETRIES})...`,
				);
				setTimeout(startServer, 500);
			} else if (retryCount >= MAX_RETRIES) {
				console.error(
					`❌ Failed to start server after ${MAX_RETRIES} retries. Port ${port} is still in use.`,
				);
				console.error("💡 Solutions:");
				console.error(`   1. Kill the process using port ${port}:`);
				console.error(`      netstat -ano | findstr :${port}`);
				console.error("      taskkill /PID <PID> /F");
				console.error(
					"   2. Or use a different port by setting PORT environment variable",
				);
				console.error("   3. Or wait a few seconds and try again");
				console.error(
					"   4. Or stop the server and restart: Press Ctrl+C to stop",
				);
				process.exit(1);
			} else {
				console.error("❌ Failed to start development server:", error);
				console.error(
					"💡 Tip: Run 'netstat -ano | findstr :8080' to find the process, then 'taskkill /PID <PID> /F' to kill it",
				);
				process.exit(1);
			}
		}
	};

	// Start the server
	startServer();
} else {
	// For Node.js runtime (production on Railway or local with Node)
	import("@hono/node-server").then(({ serve }) => {
		try {
			const hostname = isProduction ? "0.0.0.0" : "localhost";
			const server = serve({
				fetch: app.fetch,
				port: Number(port),
				hostname,
			});

			console.log(`✅ Server successfully bound to ${hostname}:${port}`);
			if (isProduction) {
				console.log(
					"🌐 Server should be accessible at https://steelix-final-production.up.railway.app",
				);
			} else {
				console.log(`🌐 Server accessible at http://localhost:${port}`);
			}

			// Handle graceful shutdown
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
}

// Export the app for compatibility
// Note: When using `bun run --hot`, Bun will try to auto-serve the default export
// if it has a fetch method. Since we're manually starting the server above with Bun.serve(),
// we export a wrapper that prevents Bun from auto-serving by not having a fetch method
// at the top level. The manual Bun.serve() call above handles the server.
// This prevents the "port in use" error during hot reload.
export default {
	// Don't include fetch to prevent Bun's auto-serve
	// The app is manually served via Bun.serve() above
} as Record<string, never>;
