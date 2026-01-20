#!/usr/bin/env bun
/**
 * Migration Script: Convert property column from enum to text
 * 
 * This script converts the property column from enum type (property_developer, secondary_market_owner)
 * to a free text column so users can enter any property name.
 * 
 * Usage:
 *   cd apps/server
 *   bun run scripts/run-property-to-text-migration.ts
 */

import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	console.error("❌ DATABASE_URL environment variable is not set");
	process.exit(1);
}

const pool = new Pool({
	connectionString,
});

async function runMigration() {
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		
		console.log("🔄 Running migration: Convert property column from enum to text...");
		
		// Check current column type
		const checkQuery = `
			SELECT data_type, udt_name
			FROM information_schema.columns
			WHERE table_name = 'prospects' AND column_name = 'property';
		`;
		const currentType = await client.query(checkQuery);
		
		if (currentType.rows.length === 0) {
			console.log("❌ Column 'property' not found in prospects table");
			await client.query("ROLLBACK");
			process.exit(1);
		}
		
		const dataType = currentType.rows[0].data_type;
		const udtName = currentType.rows[0].udt_name;
		console.log(`📋 Current property column type: ${dataType} (${udtName})`);
		
		// Check if it's already text
		if (dataType === "text" || dataType === "character varying") {
			console.log("✅ Property column is already text type. No migration needed.");
			await client.query("COMMIT");
			return;
		}
		
		// Step 1: Add a new text column
		console.log("📝 Step 1: Adding temporary text column...");
		await client.query(`ALTER TABLE prospects ADD COLUMN IF NOT EXISTS property_new TEXT`);
		
		// Step 2: Migrate existing data
		console.log("📝 Step 2: Migrating existing data...");
		await client.query(`
			UPDATE prospects 
			SET property_new = CASE 
				WHEN property::text = 'property_developer' THEN 'Property Developer'
				WHEN property::text = 'secondary_market_owner' THEN 'Secondary Market Owner'
				ELSE property::TEXT
			END
			WHERE property_new IS NULL;
		`);
		
		// Step 3: Make NOT NULL
		console.log("📝 Step 3: Setting NOT NULL constraint...");
		await client.query(`ALTER TABLE prospects ALTER COLUMN property_new SET NOT NULL`);
		
		// Step 4: Drop the old column
		console.log("📝 Step 4: Dropping old enum column...");
		await client.query(`ALTER TABLE prospects DROP COLUMN property`);
		
		// Step 5: Rename new column
		console.log("📝 Step 5: Renaming new column...");
		await client.query(`ALTER TABLE prospects RENAME COLUMN property_new TO property`);
		
		await client.query("COMMIT");
		
		console.log("✅ Migration completed successfully!");
		console.log("📋 Property column is now TEXT type - users can enter any property name");
		
		// Optional: Check if property_type enum is still used
		const enumCheckQuery = `
			SELECT COUNT(*) as usage_count
			FROM information_schema.columns
			WHERE udt_name = 'property_type';
		`;
		const enumUsage = await client.query(enumCheckQuery);
		const usageCount = parseInt(enumUsage.rows[0].usage_count || "0");
		
		if (usageCount === 0) {
			console.log("💡 Tip: The property_type enum type is no longer used. You can drop it with:");
			console.log("   DROP TYPE IF EXISTS property_type;");
		}
		
	} catch (error: any) {
		await client.query("ROLLBACK");
		console.error("❌ Migration failed:", error.message);
		console.error("Error details:", error);
		process.exit(1);
	} finally {
		client.release();
		await pool.end();
	}
}

runMigration();
