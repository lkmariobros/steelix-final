import "dotenv/config";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./lib/auth";
import { createContext } from "./lib/context";
import { appRouter } from "./routers/index";

const app = new Hono();

app.use(logger());
app.use(
	"/*",
	cors({
		origin: process.env.CORS_ORIGIN || "",
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
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
	return c.text("OK - Server is working!");
});

app.get("/health", (c) => {
	return c.json({
		status: "healthy",
		timestamp: new Date().toISOString(),
		port: process.env.PORT,
		env: process.env.NODE_ENV
	});
});

const port = process.env.PORT || 3000;

console.log(`🚀 Server starting on port ${port}`);
console.log(`📊 Environment check:`);
console.log(`   - NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`   - PORT: ${process.env.PORT}`);
console.log(`   - DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
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
	console.log(`🌐 Server should be accessible at https://steelix-final-production.up.railway.app`);

	// Keep the process alive
	process.on('SIGTERM', () => {
		console.log('🛑 SIGTERM received, shutting down gracefully');
		server.close(() => {
			console.log('✅ Server closed');
			process.exit(0);
		});
	});

	process.on('SIGINT', () => {
		console.log('🛑 SIGINT received, shutting down gracefully');
		server.close(() => {
			console.log('✅ Server closed');
			process.exit(0);
		});
	});

} catch (error) {
	console.error(`❌ Failed to start server:`, error);
	process.exit(1);
}

export default app;

