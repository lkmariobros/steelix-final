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
	return c.text("OK");
});

const port = process.env.PORT || 3000;

console.log(`🚀 Server starting on port ${port}`);

// For Railway deployment, we need to use serve() to start the server
import { serve } from "@hono/node-server";

serve({
	fetch: app.fetch,
	port: Number(port),
	hostname: "0.0.0.0", // Bind to all interfaces for Railway
});

console.log(`✅ Server running on http://0.0.0.0:${port}`);

export default app;

