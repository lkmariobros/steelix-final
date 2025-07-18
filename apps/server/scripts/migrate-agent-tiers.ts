import { db } from "../src/db/index.js";
import { sql } from "drizzle-orm";

async function runMigration() {
	try {
		console.log("🚀 Starting agent tier migration...");

		// Create agent_tier enum if it doesn't exist
		await db.execute(sql`
			DO $$ BEGIN
				CREATE TYPE agent_tier AS ENUM('advisor', 'sales_leader', 'team_leader', 'group_leader', 'supreme_leader');
			EXCEPTION
				WHEN duplicate_object THEN null;
			END $$;
		`);

		// Add agent tier fields to user table
		await db.execute(sql`
			DO $$ BEGIN
				ALTER TABLE "user" ADD COLUMN "agent_tier" agent_tier DEFAULT 'advisor';
			EXCEPTION
				WHEN duplicate_column THEN null;
			END $$;
		`);

		await db.execute(sql`
			DO $$ BEGIN
				ALTER TABLE "user" ADD COLUMN "company_commission_split" integer DEFAULT 60;
			EXCEPTION
				WHEN duplicate_column THEN null;
			END $$;
		`);

		await db.execute(sql`
			DO $$ BEGIN
				ALTER TABLE "user" ADD COLUMN "tier_effective_date" timestamp DEFAULT now();
			EXCEPTION
				WHEN duplicate_column THEN null;
			END $$;
		`);

		await db.execute(sql`
			DO $$ BEGIN
				ALTER TABLE "user" ADD COLUMN "tier_promoted_by" text;
			EXCEPTION
				WHEN duplicate_column THEN null;
			END $$;
		`);
		
		console.log("✅ Agent tier migration completed successfully!");

	} catch (error) {
		console.error("❌ Migration failed:", error);
		throw error;
	}
}

// Run the migration
runMigration()
	.then(() => {
		console.log("🎉 Migration script completed!");
		process.exit(0);
	})
	.catch((error) => {
		console.error("💥 Migration script failed:", error);
		process.exit(1);
	});
