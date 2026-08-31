import "dotenv/config";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { appRouter } from "./routers/index";
import { authRoutes } from "./routes/auth";
import { debugRoutes } from "./routes/debug";
import { webhookRoutes } from "./routes/webhooks";
import { createContext } from "./utils/context";
import { startServer } from "./utils/server";
import { getAllowedOrigins } from "./utils/allowed-origins";
import { ensurePipelineStageEnumValues } from "./utils/pipeline-stage-schema";
import { ensureDocumentCategoryEnumValues } from "./utils/document-category-schema";
import { ensureTransactionStatusEnumValues } from "./utils/transaction-status-schema";
import { ensureTransactionListIndexes } from "./utils/transaction-indexes";
import { ensureLeadListIndexes } from "./utils/lead-indexes";
import {
	ensurePortalRecordLogTable,
	purgeExpiredRecordLogs,
} from "./services/record-log";

const app = new Hono();

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

app.route("/", authRoutes);

app.use(
	"/trpc/*",
	trpcServer({
		router: appRouter,
		createContext: (_opts, context) => createContext({ context }),
	}),
);

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

app.route("/", webhookRoutes);

if (process.env.NODE_ENV !== "production") {
	app.route("/", debugRoutes);
}

process.on("unhandledRejection", (reason) =>
	console.error("❌ Unhandled rejection:", reason),
);
process.on("uncaughtException", (error) =>
	console.error("❌ Uncaught exception:", error),
);

console.log(
	`🚀 Starting on port ${process.env.PORT || 8080} [${process.env.NODE_ENV}]`,
);
console.log(`   DB: ${process.env.DATABASE_URL ? "✓" : "✗ NOT SET"}`);

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

void ensureTransactionStatusEnumValues()
	.then(() => console.log("✅ Transaction status enum values ready"))
	.catch((e) =>
		console.warn(
			"⚠️ Transaction status enum bootstrap failed:",
			e instanceof Error ? e.message : e,
		),
	);

void ensureTransactionListIndexes()
	.then(() => console.log("✅ Transaction list indexes ready"))
	.catch((e) =>
		console.warn(
			"⚠️ Transaction list index bootstrap failed:",
			e instanceof Error ? e.message : e,
		),
	);

void ensureLeadListIndexes()
	.then(() => console.log("✅ Lead/queue list indexes ready"))
	.catch((e) =>
		console.warn(
			"⚠️ Lead/queue index bootstrap failed:",
			e instanceof Error ? e.message : e,
		),
	);

void ensurePortalRecordLogTable()
	.then(() => purgeExpiredRecordLogs())
	.then((result) => {
		console.log("✅ Portal record log ready");
		if (result.portalDeleted || result.tierConfigDeleted) {
			console.log(
				`🧹 Record log retention purge: portal=${result.portalDeleted}, tierConfig=${result.tierConfigDeleted}`,
			);
		}
	})
	.catch((e) =>
		console.warn(
			"⚠️ Portal record log bootstrap/purge failed:",
			e instanceof Error ? e.message : e,
		),
	);

// Daily retention sweep (365-day policy)
const RECORD_LOG_PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;
setInterval(() => {
	void purgeExpiredRecordLogs().catch((e) =>
		console.warn(
			"[record-log] scheduled purge failed:",
			e instanceof Error ? e.message : e,
		),
	);
}, RECORD_LOG_PURGE_INTERVAL_MS).unref?.();

startServer(app);

export default {} as Record<string, never>;
