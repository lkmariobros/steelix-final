import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as authSchema from "./schema/auth";
import * as transactionSchema from "./schema/transactions";
import * as approvalsSchema from "./schema/approvals";
import * as reportsSchema from "./schema/reports";
import * as crmSchema from "./schema/crm";
import * as autoReplySchema from "./schema/auto-reply";
import * as whatsappSchema from "./schema/whatsapp";

const schema = {
	...authSchema,
	...transactionSchema,
	...approvalsSchema,
	...reportsSchema,
	...crmSchema,
	...autoReplySchema,
	...whatsappSchema,
};

// ✅ PERFORMANCE: Connection pooling for better database performance
// This reuses connections instead of creating new ones for each request
const connectionString = process.env.DATABASE_URL || "";

// Detect if using Supabase Supavisor transaction mode (port 6543)
const isTransactionMode = connectionString.includes(":6543");

const pool = new Pool({
	connectionString,
	// Pool configuration optimized for serverless/Railway deployment
	max: 10,                      // Maximum number of connections in pool
	min: 2,                       // Minimum connections to keep open
	idleTimeoutMillis: 30000,     // Close idle connections after 30 seconds
	connectionTimeoutMillis: 5000, // Fail fast if can't connect in 5 seconds
	// Supavisor transaction mode doesn't support prepared statements
	...(isTransactionMode && {
		allowExitOnIdle: true,
	}),
});

// Log pool configuration on startup (helpful for debugging)
console.log("🔗 Database pool initialized:", {
	max: 10,
	min: 2,
	isTransactionMode,
	hasConnectionString: !!connectionString,
});

// Handle pool errors gracefully
pool.on("error", (err) => {
	console.error("❌ Unexpected database pool error:", err);
});

// Create Drizzle instance with the pool
// Note: If using Supavisor transaction mode, prepared statements are handled by pg.Pool
export const db = drizzle(pool, { schema });

// Export pool for graceful shutdown if needed
export { pool };

// Export types for use in other files
export type Database = typeof db;
export type Schema = typeof schema;
