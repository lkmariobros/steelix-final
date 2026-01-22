#!/usr/bin/env bun
/**
 * Migration Script: Update pipeline_stage enum to match client's CRM system
 * 
 * This script updates the pipeline_stage enum to include the client's 10 statuses:
 * - New Lead
 * - Follow Up In Progress
 * - No Pick & Reply
 * - Follow Up For Appointment
 * - Potential Lead
 * - Consider / Seen
 * - Appointment Made
 * - Reject Project
 * - Booking Made
 * - Spam / Fake Lead
 * 
 * Usage:
 *   cd apps/server
 *   bun run scripts/update-pipeline-stage-enum.ts
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

// New enum values (snake_case)
const NEW_ENUM_VALUES = [
	"new_lead",
	"follow_up_in_progress",
	"no_pick_reply",
	"follow_up_for_appointment",
	"potential_lead",
	"consider_seen",
	"appointment_made",
	"reject_project",
	"booking_made",
	"spam_fake_lead",
];

// Mapping from old enum values to new ones
const OLD_TO_NEW_MAPPING: Record<string, string> = {
	"prospect": "new_lead",
	"outreach": "follow_up_in_progress",
	"discovery": "potential_lead",
	"proposal": "follow_up_for_appointment",
	"negotiation": "appointment_made",
	"closed_won": "booking_made",
	"closed_lost": "reject_project",
};

async function runMigration() {
	// Use separate connections to ensure enum additions are fully committed
	const enumClient = await pool.connect();
	const dataClient = await pool.connect();
	let enumClientReleased = false;
	
	try {
		console.log("🔄 Running migration: Update pipeline_stage enum...");
		
		// Check current enum values
		const checkQuery = `
			SELECT enumlabel 
			FROM pg_enum 
			WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pipeline_stage')
			ORDER BY enumsortorder;
		`;
		const currentValues = await enumClient.query(checkQuery);
		const existingValues = currentValues.rows.map(r => r.enumlabel);
		console.log("📋 Current pipeline_stage enum values:", existingValues);
		
		// PHASE 1: Add new enum values using first connection
		// ALTER TYPE auto-commits, but using a separate connection ensures clean state
		console.log("📝 Phase 1: Adding new enum values...");
		let addedCount = 0;
		for (const newValue of NEW_ENUM_VALUES) {
			if (!existingValues.includes(newValue)) {
				try {
					// ALTER TYPE auto-commits immediately
					await enumClient.query(`ALTER TYPE pipeline_stage ADD VALUE IF NOT EXISTS '${newValue}'`);
					console.log(`✅ Added '${newValue}' to pipeline_stage enum`);
					addedCount++;
				} catch (error: any) {
					// IF NOT EXISTS might not work in all PostgreSQL versions, so we catch and continue
					if (error.message.includes("already exists") || error.code === "42710") {
						console.log(`ℹ️  '${newValue}' already exists, skipping`);
					} else {
						throw error;
					}
				}
			} else {
				console.log(`ℹ️  '${newValue}' already exists, skipping`);
			}
		}
		
		if (addedCount > 0) {
			console.log(`✅ Successfully added ${addedCount} new values to pipeline_stage enum`);
		}
		
		// Release enum client - enum values are now committed and available
		// We release it here so it's available for the pool, but we'll track it to avoid double-release
		enumClient.release();
		enumClientReleased = true;
		
		// Small delay to ensure enum values are fully propagated
		await new Promise(resolve => setTimeout(resolve, 200));
		
		// PHASE 2: Migrate existing data using second connection (ensures new enum values are available)
		console.log("📝 Phase 2: Migrating existing prospect records...");
		await dataClient.query("BEGIN");
		
		let migratedCount = 0;
		
		// Get updated enum values after additions
		const updatedValues = await dataClient.query(checkQuery);
		const allExistingValues = updatedValues.rows.map(r => r.enumlabel);
		
		for (const [oldValue, newValue] of Object.entries(OLD_TO_NEW_MAPPING)) {
			if (allExistingValues.includes(oldValue) && allExistingValues.includes(newValue)) {
				const updateQuery = `
					UPDATE prospects 
					SET stage = $1::pipeline_stage 
					WHERE stage = $2::pipeline_stage
				`;
				const result = await dataClient.query(updateQuery, [newValue, oldValue]);
				if (result.rowCount && result.rowCount > 0) {
					console.log(`✅ Migrated ${result.rowCount} records from '${oldValue}' to '${newValue}'`);
					migratedCount += result.rowCount;
				}
			}
		}
		
		// Set default for any records that might still have old values (fallback to new_lead)
		// Only update records that have old enum values that are not in the new list
		const oldValues = Object.keys(OLD_TO_NEW_MAPPING);
		if (oldValues.length > 0) {
			const fallbackQuery = `
				UPDATE prospects 
				SET stage = 'new_lead'::pipeline_stage 
				WHERE stage::text IN (${oldValues.map(v => `'${v}'`).join(", ")})
			`;
			const fallbackResult = await dataClient.query(fallbackQuery);
			if (fallbackResult.rowCount && fallbackResult.rowCount > 0) {
				console.log(`✅ Set ${fallbackResult.rowCount} records with old stages to 'new_lead'`);
				migratedCount += fallbackResult.rowCount;
			}
		}
		
		await dataClient.query("COMMIT");
		
		if (migratedCount > 0) {
			console.log(`✅ Successfully migrated ${migratedCount} prospect records`);
		} else {
			console.log("ℹ️  No records needed migration");
		}
		
		// Verify the final enum values
		const finalValues = await dataClient.query(checkQuery);
		console.log("📋 Final pipeline_stage enum values:", finalValues.rows.map(r => r.enumlabel));
		
		console.log("✅ Migration completed successfully!");
		
	} catch (error: any) {
		try {
			await dataClient.query("ROLLBACK");
		} catch (rollbackError) {
			// Ignore rollback errors
		}
		console.error("❌ Migration failed:", error.message);
		console.error("Error details:", error);
		process.exit(1);
	} finally {
		// Only release clients that haven't been released yet
		try {
			if (!enumClientReleased) {
				enumClient.release();
			}
		} catch (e) {
			// Ignore if already released
		}
		try {
			dataClient.release();
		} catch (e) {
			// Ignore if already released
		}
		await pool.end();
	}
}

runMigration();
