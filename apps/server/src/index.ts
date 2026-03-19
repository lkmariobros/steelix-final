import "dotenv/config";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { appRouter } from "./routers/index";
import { debugRoutes } from "./routes/debug";
import { webhookRoutes } from "./routes/webhooks";
import { auth } from "./utils/auth";
import { createContext } from "./utils/context";
import { startServer } from "./utils/server";

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

const allowedOrigins = [
	"http://localhost:3000",
	"http://localhost:3001",
	"http://localhost:3002",
	"https://steelix-final-web.vercel.app",
	"https://steelix-final-web-git-master-lkmariobros-projects.vercel.app",
	"https://steelix-final-mx4or73lk-lkmariobros-projects.vercel.app",
	"https://steelix-final-web-git-admin-typescript-errors-solved-lkmariobros-projects.vercel.app",
	...(process.env.CORS_ORIGIN?.split(",") ?? []),
];

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

app.all("/api/auth/*", async (c) => {
	try {
		const result = await auth.handler(c.req.raw);
		if (!result) {
			return c.json(
				{ error: "Auth endpoint not found", path: c.req.path },
				404,
			);
		}
		return result;
	} catch (error) {
		console.error(
			"❌ Auth handler error:",
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

// Fallback for alternate auth paths
app.all("/auth/*", async (c) => {
	try {
		const result = await auth.handler(c.req.raw);
		return result || c.json({ error: "Auth endpoint not found" }, 404);
	} catch (error) {
		console.error(
			"❌ Fallback auth error:",
			error instanceof Error ? error.message : error,
		);
		return c.json({ error: "Auth handler failed" }, 500);
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

// ─── Health checks ────────────────────────────────────────────────────────────

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

// Debug routes — development only
if (process.env.NODE_ENV !== "production") {
	app.route("/", debugRoutes);
}

// ─── Process error guards ─────────────────────────────────────────────────────

process.on("unhandledRejection", (reason) => {
	console.error("❌ Unhandled rejection:", reason);
});
process.on("uncaughtException", (error) => {
	console.error("❌ Uncaught exception:", error);
});

// ─── Startup ──────────────────────────────────────────────────────────────────

console.log(`🚀 Starting server on port ${process.env.PORT || 8080}`);
console.log(`   NODE_ENV  : ${process.env.NODE_ENV}`);
console.log(`   DATABASE  : ${process.env.DATABASE_URL ? "✓" : "✗ NOT SET"}`);
console.log(`   AUTH_URL  : ${process.env.BETTER_AUTH_URL}`);

startServer(app);

// Prevent Bun from auto-serving the default export
export default {} as Record<string, never>;
