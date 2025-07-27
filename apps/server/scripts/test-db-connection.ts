import { db } from "../src/db/index.js";
import { sql } from "drizzle-orm";

async function testDatabaseConnection() {
	try {
		console.log("🔍 Testing database connection...");
		
		// Test basic connection
		const result = await db.execute(sql`SELECT 1 as test`);
		console.log("✅ Database connection successful:", result);
		
		// Check what tables exist
		const allTables = await db.execute(sql`
			SELECT table_name
			FROM information_schema.tables
			WHERE table_schema = 'public'
			ORDER BY table_name
		`);
		console.log("📋 Existing tables:", allTables.rows?.map(t => t.table_name) || []);

		// Test if user table exists (check both cases)
		const userTableCheck = await db.execute(sql`
			SELECT table_name
			FROM information_schema.tables
			WHERE table_schema = 'public'
			AND (table_name = 'user' OR table_name = 'User')
		`);
		console.log("👤 User table exists:", userTableCheck.rows?.length > 0);

		// Check user table columns
		if (userTableCheck.rows?.length > 0) {
			const userColumns = await db.execute(sql`
				SELECT column_name, data_type
				FROM information_schema.columns
				WHERE table_name = 'user'
				AND table_schema = 'public'
				ORDER BY column_name
			`);
			console.log("📋 User table columns:", userColumns.rows?.map(c => `${c.column_name} (${c.data_type})`) || []);
		}
		
		// Test if agent_tier column exists
		const agentTierCheck = await db.execute(sql`
			SELECT column_name 
			FROM information_schema.columns 
			WHERE table_name = 'user' 
			AND column_name = 'agent_tier'
		`);
		console.log("🏷️  Agent tier column exists:", agentTierCheck.rows.length > 0);
		
		// Count existing users
		try {
			const userCount = await db.execute(sql`SELECT COUNT(*) as count FROM "user"`);
			console.log("👥 Total users in database:", userCount.rows?.[0]?.count || 0);
		} catch (error) {
			console.log("👥 Could not count users:", error instanceof Error ? error.message : String(error));
		}
		
		console.log("🎉 Database test completed successfully!");
		
	} catch (error) {
		console.error("❌ Database test failed:", error);
		throw error;
	}
}

// Run the test
testDatabaseConnection()
	.then(() => {
		console.log("✅ Database test passed!");
		process.exit(0);
	})
	.catch((error) => {
		console.error("💥 Database test failed:", error);
		process.exit(1);
	});
