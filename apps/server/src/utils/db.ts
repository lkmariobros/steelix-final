import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as approvalsSchema from "../models/approvals";
import * as authSchema from "../models/auth";
import * as autoReplySchema from "../models/auto-reply";
import * as calendarSchema from "../models/calendar";
import * as crmSchema from "../models/crm";
import * as reportsSchema from "../models/reports";
import * as transactionSchema from "../models/transactions";
import * as whatsappSchema from "../models/whatsapp";

const schema = {
	...authSchema,
	...transactionSchema,
	...approvalsSchema,
	...reportsSchema,
	...crmSchema,
	...autoReplySchema,
	...whatsappSchema,
	...calendarSchema,
};

// ✅ PERFORMANCE: Connection pooling for better database performance
// This reuses connections instead of creating new ones for each request
const connectionString = process.env.DATABASE_URL || "";

// Detect if using Supabase Supavisor transaction mode (port 6543)
const isTransactionMode = connectionString.includes(":6543");

// Pool configuration optimized for different environments
// Supavisor transaction mode has strict connection limits
const maxConnections = isTransactionMode ? 1 : 10; // Only 1 connection for Supavisor Session mode
const minConnections = isTransactionMode ? 0 : 2; // Don't keep idle connections for transaction mode

const pool = new Pool({
	connectionString,
	max: maxConnections,
	min: minConnections,
	idleTimeoutMillis: isTransactionMode ? 10000 : 30000, // 10s for transaction mode, 30s otherwise
	connectionTimeoutMillis: 10000, // Increased to 10 seconds for better reliability
	statement_timeout: 30000, // 30 second query timeout
	query_timeout: 30000, // 30 second query timeout
	// Supavisor transaction mode doesn't support prepared statements
	...(isTransactionMode && {
		allowExitOnIdle: true,
	}),
});

// Log pool configuration on startup (helpful for debugging)
console.log("🔗 Database pool initialized:", {
	max: maxConnections,
	min: minConnections,
	isTransactionMode,
	hasConnectionString: !!connectionString,
	idleTimeoutMillis: isTransactionMode ? 10000 : 30000,
	connectionTimeoutMillis: 10000,
});

// Handle pool errors gracefully
pool.on("error", (err) => {
	console.error("❌ Unexpected database pool error:", err);
	// Don't crash the app on pool errors - let queries handle their own errors
});

// Monitor pool lifecycle
pool.on("connect", (_client) => {
	console.log("✅ New database connection established");
});

pool.on("remove", (_client) => {
	console.log("🔄 Database connection removed from pool");
});

// Log pool stats periodically in development (every 5 minutes)
if (process.env.NODE_ENV !== "production") {
	setInterval(
		() => {
			console.log("📊 Database pool stats:", {
				totalCount: pool.totalCount,
				idleCount: pool.idleCount,
				waitingCount: pool.waitingCount,
			});
		},
		5 * 60 * 1000,
	); // Every 5 minutes
}

// Create Drizzle instance with the pool
// Note: If using Supavisor transaction mode, prepared statements are handled by pg.Pool
export const db = drizzle(pool, { schema });

// Export pool for graceful shutdown if needed
export { pool };

// Export types for use in other files
export type Database = typeof db;
export type Schema = typeof schema;
