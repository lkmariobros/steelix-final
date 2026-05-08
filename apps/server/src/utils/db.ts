import { drizzle } from "drizzle-orm/node-postgres";
import type { PoolConfig } from "pg";
import { Pool } from "pg";
import * as approvalsSchema from "../models/approvals";
import * as authSchema from "../models/auth";
import * as autoReplySchema from "../models/auto-reply";
import * as calendarSchema from "../models/calendar";
import * as commissionPayoutsSchema from "../models/commission-payouts";
import * as commissionSchema from "../models/commission-schemes";
import * as crmSchema from "../models/crm";
import * as listingsSchema from "../models/listings";
import * as reportsSchema from "../models/reports";
import * as transactionSchema from "../models/transactions";
import * as whatsappSchema from "../models/whatsapp";

const schema = {
	...authSchema,
	...transactionSchema,
	...approvalsSchema,
	...reportsSchema,
	...crmSchema,
	...listingsSchema,
	...commissionSchema,
	...commissionPayoutsSchema,
	...autoReplySchema,
	...whatsappSchema,
	...calendarSchema,
};

/**
 * Normalize DATABASE_URL for hosted poolers (Supabase Supavisor, etc.).
 * - Appends `pgbouncer=true` so drivers avoid patterns that break transaction pooling.
 * Without this, intermittent "connection terminated" / timeout errors are common.
 */
function augmentDatabaseUrl(raw: string): string {
	if (!raw.trim()) return raw;
	try {
		const u = new URL(raw);
		const host = u.hostname;
		const port = u.port || "5432";
		const isSupabasePooler =
			host.includes("pooler.supabase.com") || host.includes(".pooler.supabase.com");
		const isTransactionPort = port === "6543";

		if ((isSupabasePooler || isTransactionPort) && !u.searchParams.has("pgbouncer")) {
			u.searchParams.set("pgbouncer", "true");
		}
		return u.toString();
	} catch {
		return raw;
	}
}

function isLocalDatabase(urlStr: string): boolean {
	try {
		const u = new URL(urlStr);
		const h = u.hostname.toLowerCase();
		return h === "localhost" || h === "127.0.0.1" || h === "::1";
	} catch {
		return false;
	}
}

function buildPoolConfig(): PoolConfig {
	const rawUrl = process.env.DATABASE_URL || "";
	const connectionString = augmentDatabaseUrl(rawUrl);

	const isPooler =
		connectionString.includes(":6543") ||
		connectionString.includes("pooler.supabase.com");

	const maxFromEnv = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "", 10);
	// IMPORTANT: A max of 1 serializes *all* DB access (auth + tRPC). Under load that
	// queues requests until connectionTimeoutMillis — exactly the "10–16s then 500" symptom.
	const defaultMax = 10;
	const maxConnections =
		Number.isFinite(maxFromEnv) && maxFromEnv > 0
			? Math.min(maxFromEnv, 100)
			: defaultMax;

	const minConnections = Math.min(2, maxConnections);

	const connectTimeout = Number.parseInt(
		process.env.DATABASE_CONNECT_TIMEOUT_MS ?? "15000",
		10,
	);

	const remoteSsl =
		process.env.DATABASE_SSL === "true" ||
		(!isLocalDatabase(connectionString) && process.env.DATABASE_SSL !== "false");

	/** NODE/pg TLS: many hosted DBs + corp proxies use chains Node rejects as "self-signed".
	 * Opt into strict verification with DATABASE_SSL_REJECT_UNAUTHORIZED=true (use NODE_EXTRA_CA_CERTS if needed).
	 */
	const sslRejectUnauthorized =
		process.env.DATABASE_SSL_REJECT_UNAUTHORIZED?.toLowerCase() === "true";

	const ssl: PoolConfig["ssl"] = remoteSsl
		? {
				rejectUnauthorized: sslRejectUnauthorized,
			}
		: undefined;

	const cfg: PoolConfig = {
		connectionString,
		max: maxConnections,
		min: minConnections,
		idleTimeoutMillis: isPooler ? 60_000 : 30_000,
		connectionTimeoutMillis: Number.isFinite(connectTimeout)
			? connectTimeout
			: 15_000,
		// Keep TCP alive through NAT / cloud load balancers (reduces surprise disconnects)
		keepAlive: true,
		keepAliveInitialDelayMillis: 10_000,
		application_name: process.env.DATABASE_APPLICATION_NAME || "steelix-server",
		statement_timeout: 30_000,
		query_timeout: 30_000,
		ssl,
		// Recycle pooled clients periodically — avoids holding half-dead connections forever
		maxLifetimeSeconds: isPooler ? 30 * 60 : 60 * 60,
	};

	// Long-lived API server: keep the pool warm (do not exit workers when idle).
	if (process.env.DATABASE_ALLOW_EXIT_ON_IDLE === "true") {
		cfg.allowExitOnIdle = true;
	}

	return cfg;
}

const poolConfig = buildPoolConfig();

const pool = new Pool(poolConfig);

console.log("🔗 Database pool initialized:", {
	max: poolConfig.max,
	min: poolConfig.min,
	connectionTimeoutMillis: poolConfig.connectionTimeoutMillis,
	hasConnectionString: !!(process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0),
	poolerUrl: poolConfig.connectionString?.includes(":6543") ?? false,
	ssl: !!poolConfig.ssl,
	sslStrictVerify:
		process.env.DATABASE_SSL_REJECT_UNAUTHORIZED?.toLowerCase() === "true",
});

pool.on("error", (err) => {
	const e = err as Error & { code?: string };
	console.error("❌ Unexpected database pool error:", e.message, e.code ?? "");
});

if (process.env.NODE_ENV !== "production") {
	pool.on("connect", () => {
		console.log("✅ New database connection established");
	});
	pool.on("remove", () => {
		console.log("🔄 Database connection removed from pool");
	});
	setInterval(
		() => {
			console.log("📊 Database pool stats:", {
				totalCount: pool.totalCount,
				idleCount: pool.idleCount,
				waitingCount: pool.waitingCount,
			});
		},
		5 * 60 * 1000,
	);
}

export const db = drizzle(pool, { schema });

export { pool };

export type Database = typeof db;
export type Schema = typeof schema;
