#!/usr/bin/env bun
/**
 * Migration Script: Convert "owner" to "buyer" in prospects table
 * 
 * This script updates all existing prospects with type "owner" to "buyer"
 * to match the new enum definition before running db:push
 * 
 * Usage:
 *   cd apps/server
 *   bun run scripts/fix-prospect-owner-records.ts
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

async function fixOwnerRecords() {
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		
		console.log("🔄 Fixing prospect records: Converting 'owner' to 'buyer'...");
		
		// Check how many records have "owner" type
		const checkQuery = `
			SELECT COUNT(*) as count
			FROM prospects
			WHERE type::text = 'owner';
		`;
		const countResult = await client.query(checkQuery);
		const count = parseInt(countResult.rows[0].count || "0");
		
		if (count === 0) {
			console.log("✅ No records with 'owner' type found. Nothing to update.");
			await client.query("COMMIT");
			return;
		}
		
		console.log(`📊 Found ${count} records with type 'owner'`);
		
		// First, we need to check if 'buyer' exists in the enum
		// If not, add it first
		console.log("📝 Checking if 'buyer' exists in prospect_type enum...");
		const enumCheckQuery = `
			SELECT enumlabel 
			FROM pg_enum 
			WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'prospect_type')
			AND enumlabel = 'buyer';
		`;
		const buyerExists = await client.query(enumCheckQuery);
		
		if (buyerExists.rows.length === 0) {
			console.log("📝 Adding 'buyer' to prospect_type enum...");
			await client.query(`ALTER TYPE prospect_type ADD VALUE IF NOT EXISTS 'buyer'`);
			console.log("✅ Added 'buyer' to enum");
		} else {
			console.log("✅ 'buyer' already exists in enum");
		}
		
		// Now update all 'owner' records to 'buyer'
		// We need to cast to text first, then cast back to enum
		console.log("📝 Updating records...");
		
		// Since PostgreSQL doesn't allow direct update of enum values,
		// we need to use a temporary approach: update via text cast
		// But first, let's check the actual column type
		const columnTypeQuery = `
			SELECT data_type, udt_name
			FROM information_schema.columns
			WHERE table_name = 'prospects' AND column_name = 'type';
		`;
		const columnType = await client.query(columnTypeQuery);
		const udtName = columnType.rows[0]?.udt_name;
		
		console.log(`📋 Column type: ${udtName}`);
		
		if (udtName === 'prospect_type') {
			// Update using text casting workaround for enum type
			const updateQuery = `
				UPDATE prospects
				SET type = CASE 
					WHEN type::text = 'owner' THEN 'buyer'::prospect_type
					ELSE type
				END
				WHERE type::text = 'owner';
			`;
			
			const result = await client.query(updateQuery);
			console.log(`✅ Updated ${result.rowCount} records from 'owner' to 'buyer'`);
		} else if (udtName === 'text' || udtName === 'character varying') {
			// Column is text type - direct update
			console.log("📝 Column is text type. Updating directly...");
			const updateQuery = `
				UPDATE prospects
				SET type = 'buyer'
				WHERE type = 'owner';
			`;
			
			const result = await client.query(updateQuery);
			console.log(`✅ Updated ${result.rowCount} records from 'owner' to 'buyer'`);
		} else {
			console.log(`⚠️ Column type is ${udtName}. Attempting direct update...`);
			// Try direct update as fallback
			const updateQuery = `
				UPDATE prospects
				SET type = 'buyer'
				WHERE type::text = 'owner';
			`;
			
			try {
				const result = await client.query(updateQuery);
				console.log(`✅ Updated ${result.rowCount} records from 'owner' to 'buyer'`);
			} catch (updateError: any) {
				console.error(`❌ Failed to update: ${updateError.message}`);
				throw updateError;
			}
		}
		
		// Verify the update
		const verifyQuery = `
			SELECT COUNT(*) as count
			FROM prospects
			WHERE type::text = 'owner';
		`;
		const verifyResult = await client.query(verifyQuery);
		const remainingCount = parseInt(verifyResult.rows[0].count || "0");
		
		if (remainingCount === 0) {
			console.log("✅ All 'owner' records have been converted to 'buyer'");
		} else {
			console.warn(`⚠️ Warning: ${remainingCount} records still have type 'owner'`);
		}
		
		await client.query("COMMIT");
		console.log("✅ Migration completed successfully!");
		
	} catch (error: any) {
		await client.query("ROLLBACK");
		console.error("❌ Migration failed:", error.message);
		console.error("Error details:", error);
		
		// If it's a specific error about enum, provide helpful message
		if (error.message.includes("invalid input value for enum")) {
			console.error("\n💡 Tip: You may need to run the prospect_type enum migration first:");
			console.error("   bun run scripts/run-prospect-type-migration.ts");
		}
		
		process.exit(1);
	} finally {
		client.release();
		await pool.end();
	}
}

fixOwnerRecords();
