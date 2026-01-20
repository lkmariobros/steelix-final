#!/usr/bin/env bun
/**
 * Migration Script: Add 'buyer' to prospect_type enum
 * 
 * This script adds 'buyer' as a valid value to the prospect_type enum in the database.
 * Run this script before using the updated CRM forms that use 'buyer' instead of 'owner'.
 * 
 * Usage:
 *   cd apps/server
 *   bun run scripts/run-prospect-type-migration.ts
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
		console.log("🔄 Running migration: Add 'buyer' to prospect_type enum...");
		
		// Check current enum values
		const checkQuery = `
			SELECT enumlabel 
			FROM pg_enum 
			WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'prospect_type')
			ORDER BY enumsortorder;
		`;
		const currentValues = await client.query(checkQuery);
		console.log("📋 Current prospect_type enum values:", currentValues.rows.map(r => r.enumlabel));
		
		// Check if 'buyer' already exists
		const buyerExists = currentValues.rows.some(r => r.enumlabel === "buyer");
		if (buyerExists) {
			console.log("✅ 'buyer' already exists in the enum. No migration needed.");
			return;
		}
		
		// Add 'buyer' to the enum
		await client.query(`ALTER TYPE prospect_type ADD VALUE IF NOT EXISTS 'buyer'`);
		console.log("✅ Successfully added 'buyer' to prospect_type enum");
		
		// Verify the addition
		const updatedValues = await client.query(checkQuery);
		console.log("📋 Updated prospect_type enum values:", updatedValues.rows.map(r => r.enumlabel));
		
		console.log("✅ Migration completed successfully!");
		
	} catch (error: any) {
		console.error("❌ Migration failed:", error.message);
		console.error("Error details:", error);
		process.exit(1);
	} finally {
		client.release();
		await pool.end();
	}
}

runMigration();
