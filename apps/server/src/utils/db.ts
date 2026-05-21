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

const globalForPool = globalThis as typeof globalThis & {
	__steelixPgPool?: Pool;
};

/**
 * Normalize DATABASE_URL for hosted poolers (Supabase Supavisor, etc.).
 * - Transaction pool (port 6543): append `pgbouncer=true` (required for node-postgres).
 * - Session pool (port 5432): leave URL as-is; prepared statements are supported.
 */
function augmentDatabaseUrl(raw: string): string {
	if (!raw.trim()) return raw;
	try {
		const u = new URL(raw);
		const port = u.port || "5432";
		const isTransactionPort = port === "6543";

		if (isTransactionPort && !u.searchParams.has("pgbouncer")) {
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

function isSupabasePooler(connectionString: string): boolean {
	return (
		connectionString.includes("pooler.supabase.com") ||
		connectionString.includes(".pooler.supabase.com")
	);
}

/**
 * TLS for node-postgres `Pool`.
 *
 * Do NOT auto-enable `ssl: { rejectUnauthorized: false }` for remote hosts.
 * With Supabase Supavisor (pooler.supabase.com:5432) that misconfiguration causes
 * ~15s connection acquire timeouts and "Connection terminated unexpectedly" on
 * Better Auth session lookups — exactly the GET /api/auth/get-session 500 symptom.
 *
 * Default: omit `ssl` and let the connection string / host handle TLS.
 * Opt in with DATABASE_SSL=true only when your provider requires an explicit Pool.ssl object.
 */
function resolvePoolSsl(connectionString: string): PoolConfig["ssl"] | undefined {
	const mode = process.env.DATABASE_SSL?.toLowerCase();

	if (mode === "false") return false;
	if (mode !== "true") return undefined;

	// Supabase session pooler works without Pool.ssl; forcing it breaks connectivity.
	if (isSupabasePooler(connectionString)) return undefined;

	if (isLocalDatabase(connectionString)) return undefined;

	const strict =
		process.env.DATABASE_SSL_REJECT_UNAUTHORIZED?.toLowerCase() === "true";
	return { rejectUnauthorized: strict };
}

function isTransientConnectionError(error: unknown): boolean {
	const err = error as Error & { code?: string };
	const msg = err?.message ?? "";
	return (
		msg.includes("Connection terminated") ||
		msg.includes("connection timeout") ||
		msg.includes("ECONNRESET") ||
		msg.includes("ECONNREFUSED") ||
		msg.includes("ETIMEDOUT") ||
		msg.includes("MaxClientsInSessionMode") ||
		err?.code === "57P01" ||
		err?.code === "XX000" ||
		err?.code === "53300"
	);
}

/** Retry once on stale pooler connections (idle disconnect / half-open TCP). */
function attachQueryRetry(pool: Pool) {
	const original = pool.query.bind(pool);

	pool.query = ((...args: Parameters<Pool["query"]>) => {
		const callback = args[args.length - 1];
		if (typeof callback === "function") {
			return original(...args);
		}

		const run = () => original(...(args as [string, unknown[]?]));
		const attempt = async (n: number): Promise<ReturnType<typeof original>> => {
			try {
				return await run();
			} catch (error) {
				if (!isTransientConnectionError(error) || n >= 2) throw error;
				await new Promise((r) => setTimeout(r, 75 * 2 ** n));
				return attempt(n + 1);
			}
		};

		return attempt(0);
	}) as Pool["query"];
}

function buildPoolConfig(): PoolConfig {
	const rawUrl = process.env.DATABASE_URL || "";
	const connectionString = augmentDatabaseUrl(rawUrl);

	const isPooler =
		connectionString.includes(":6543") || isSupabasePooler(connectionString);

	const maxFromEnv = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "", 10);
	// IMPORTANT: max=1 serializes auth + tRPC and queues until connectionTimeoutMillis.
	const defaultMax = isPooler ? 8 : 10;
	const maxConnections =
		Number.isFinite(maxFromEnv) && maxFromEnv > 0
			? Math.min(maxFromEnv, 100)
			: defaultMax;

	// Avoid eager connects on pooler startup (reduces MaxClientsInSessionMode spikes on hot reload).
	const minConnections = isPooler ? 0 : Math.min(2, maxConnections);

	const connectTimeout = Number.parseInt(
		process.env.DATABASE_CONNECT_TIMEOUT_MS ?? "15000",
		10,
	);

	const ssl = resolvePoolSsl(connectionString);

	const cfg: PoolConfig = {
		connectionString,
		max: maxConnections,
		min: minConnections,
		idleTimeoutMillis: isPooler ? 60_000 : 30_000,
		connectionTimeoutMillis: Number.isFinite(connectTimeout)
			? connectTimeout
			: 15_000,
		keepAlive: true,
		keepAliveInitialDelayMillis: 10_000,
		application_name: process.env.DATABASE_APPLICATION_NAME || "steelix-server",
		statement_timeout: 30_000,
		query_timeout: 30_000,
		ssl,
		maxLifetimeSeconds: isPooler ? 30 * 60 : 60 * 60,
	};

	if (process.env.DATABASE_ALLOW_EXIT_ON_IDLE === "true") {
		cfg.allowExitOnIdle = true;
	}

	return cfg;
}

const poolConfig = buildPoolConfig();

function createPool(): Pool {
	const existing = globalForPool.__steelixPgPool;
	if (existing && !(existing as Pool & { ended?: boolean }).ended) {
		return existing;
	}

	if (existing) {
		existing.end().catch(() => undefined);
	}

	const next = new Pool(poolConfig);
	attachQueryRetry(next);
	globalForPool.__steelixPgPool = next;
	return next;
}

const pool = createPool();

console.log("🔗 Database pool initialized:", {
	max: poolConfig.max,
	min: poolConfig.min,
	connectionTimeoutMillis: poolConfig.connectionTimeoutMillis,
	hasConnectionString: !!(process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0),
	supabasePooler: isSupabasePooler(poolConfig.connectionString ?? ""),
	transactionPooler: poolConfig.connectionString?.includes(":6543") ?? false,
	sslMode: poolConfig.ssl === false ? "off" : poolConfig.ssl ? "explicit" : "default",
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
}

export async function closeDatabasePool(): Promise<void> {
	const p = globalForPool.__steelixPgPool;
	globalForPool.__steelixPgPool = undefined;
	if (p) await p.end();
}

export const db = drizzle(pool, { schema });

export { pool };

export type Database = typeof db;
export type Schema = typeof schema;
