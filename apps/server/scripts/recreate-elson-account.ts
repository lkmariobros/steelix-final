import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "../src/db/index.js";

const TARGET_EMAIL = "elson@devots.com.my";
const NEW_PASSWORD = "DevOts2024!";

interface UserBackupRow {
	id: string;
	name: string;
	email: string;
	role: string;
	agent_tier: string;
	company_commission_split: number;
	agency_id: string | null;
	team_id: string | null;
	permissions: unknown;
}

console.log("🔄 RECREATING ELSON ACCOUNT");
console.log("===========================");
console.log(`Email: ${TARGET_EMAIL}`);
console.log(`Password: ${NEW_PASSWORD}\n`);

async function backupCurrentAccount() {
	console.log("1️⃣ Backing up current account data...");

	try {
		const result = await db.execute(sql`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.agent_tier,
        u.company_commission_split,
        u.agency_id,
        u.team_id,
        u.permissions
      FROM "user" u
      WHERE u.email = ${TARGET_EMAIL}
    `);

		if (!result?.rows?.[0]) {
			console.log("❌ User not found");
			return null;
		}

		const userData = result.rows[0];
		console.log("✅ Current user data backed up:");
		console.log(`   Name: ${userData.name}`);
		console.log(`   Role: ${userData.role}`);
		console.log(`   Agent Tier: ${userData.agent_tier}`);
		console.log(`   Commission Split: ${userData.company_commission_split}%`);

		return userData;
	} catch (error) {
		console.error("❌ Error backing up account:", error);
		return null;
	}
}

async function cleanupOldAccount(userId: string) {
	console.log("\n2️⃣ Cleaning up old account...");

	try {
		// Delete in correct order to respect foreign key constraints

		// 1. Delete sessions
		await db.execute(sql`DELETE FROM "session" WHERE user_id = ${userId}`);
		console.log("   ✅ Deleted sessions");

		// 2. Delete accounts
		await db.execute(sql`DELETE FROM "account" WHERE user_id = ${userId}`);
		console.log("   ✅ Deleted accounts");

		// 3. Delete verification records
		await db.execute(
			sql`DELETE FROM "verification" WHERE identifier = ${TARGET_EMAIL}`,
		);
		console.log("   ✅ Deleted verification records");

		// 4. Delete user record
		await db.execute(sql`DELETE FROM "user" WHERE id = ${userId}`);
		console.log("   ✅ Deleted user record");

		return true;
	} catch (error) {
		console.error("❌ Error cleaning up account:", error);
		return false;
	}
}

async function createFreshAccount(userData: UserBackupRow) {
	console.log("\n3️⃣ Creating fresh account...");

	try {
		// Generate new IDs
		const newUserId = crypto.randomUUID().replace(/-/g, "");
		const newAccountId = crypto.randomUUID().replace(/-/g, "");

		console.log(`   New User ID: ${newUserId}`);

		// Hash the password
		const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);
		console.log("   ✅ Password hashed");

		// Create user record
		await db.execute(sql`
      INSERT INTO "user" (
        id,
        name,
        email,
        email_verified,
        role,
        agent_tier,
        company_commission_split,
        agency_id,
        team_id,
        permissions,
        created_at,
        updated_at
      ) VALUES (
        ${newUserId},
        ${userData.name},
        ${userData.email},
        true,
        ${userData.role},
        ${userData.agent_tier},
        ${userData.company_commission_split},
        ${userData.agency_id},
        ${userData.team_id},
        ${userData.permissions},
        NOW(),
        NOW()
      )
    `);
		console.log("   ✅ Created user record");

		// Create account record
		await db.execute(sql`
      INSERT INTO "account" (
        id,
        account_id,
        provider_id,
        user_id,
        password,
        created_at,
        updated_at
      ) VALUES (
        ${newAccountId},
        ${newUserId},
        'credential',
        ${newUserId},
        ${hashedPassword},
        NOW(),
        NOW()
      )
    `);
		console.log("   ✅ Created account record");

		return { userId: newUserId, accountId: newAccountId };
	} catch (error) {
		console.error("❌ Error creating fresh account:", error);
		return null;
	}
}

async function testNewAccount() {
	console.log("\n4️⃣ Testing new account...");

	try {
		// Test database query
		const result = await db.execute(sql`
      SELECT 
        u.email,
        u.name,
        u.email_verified,
        u.role,
        a.provider_id,
        CASE 
          WHEN a.password IS NOT NULL THEN 'HAS_PASSWORD'
          ELSE 'NO_PASSWORD'
        END as password_status
      FROM "user" u
      JOIN "account" a ON u.id = a.user_id
      WHERE u.email = ${TARGET_EMAIL}
    `);

		if (!result?.rows?.[0]) {
			console.log("❌ New account not found in database");
			return false;
		}

		const account = result.rows[0];
		console.log("✅ Database verification:");
		console.log(`   Email: ${account.email}`);
		console.log(`   Name: ${account.name}`);
		console.log(`   Email Verified: ${account.email_verified}`);
		console.log(`   Role: ${account.role}`);
		console.log(`   Provider: ${account.provider_id}`);
		console.log(`   Password: ${account.password_status}`);

		// Test password hash
		const passwordResult = await db.execute(sql`
      SELECT password FROM "account" a
      JOIN "user" u ON a.user_id = u.id
      WHERE u.email = ${TARGET_EMAIL} AND a.provider_id = 'credential'
    `);

		if (passwordResult?.rows?.[0]?.password) {
			const isValid = await bcrypt.compare(
				NEW_PASSWORD,
				passwordResult.rows[0].password as string,
			);
			console.log(`   Password validation: ${isValid ? "✅" : "❌"}`);

			if (!isValid) {
				console.log("❌ Password hash verification failed");
				return false;
			}
		}

		// Test authentication endpoint
		console.log("\n   Testing authentication endpoint...");
		const response = await fetch(
			"https://steelix-final-production.up.railway.app/api/auth/sign-in/email",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Origin:
						"https://steelix-final-web-git-feature-sideb-6d33df-lkmariobros-projects.vercel.app",
				},
				body: JSON.stringify({
					email: TARGET_EMAIL,
					password: NEW_PASSWORD,
				}),
			},
		);

		console.log(`   Auth response: ${response.status} ${response.statusText}`);

		if (response.ok) {
			console.log("   ✅ Authentication successful!");
			return true;
		}
		const responseText = await response.text();
		console.log(`   ❌ Authentication failed: ${responseText}`);
		return false;
	} catch (error) {
		console.error("❌ Error testing new account:", error);
		return false;
	}
}

async function main() {
	try {
		console.log("⚠️  WARNING: This will completely recreate the user account!");
		console.log("All existing sessions will be invalidated.\n");

		// Step 1: Backup current data
		const userData = await backupCurrentAccount();
		if (!userData) {
			console.log("❌ Cannot proceed without user data");
			return;
		}

		// Step 2: Clean up old account
		const cleanupSuccess = await cleanupOldAccount(userData.id as string);
		if (!cleanupSuccess) {
			console.log("❌ Cleanup failed, aborting");
			return;
		}

		// Step 3: Create fresh account
		const newAccount = await createFreshAccount(
			userData as unknown as unknown as UserBackupRow,
		);
		if (!newAccount) {
			console.log("❌ Account creation failed");
			return;
		}

		// Step 4: Test new account
		const testSuccess = await testNewAccount();

		console.log("\n📊 FINAL RESULTS:");
		console.log("=================");
		console.log(`Account recreated: ${newAccount ? "✅" : "❌"}`);
		console.log(`Authentication working: ${testSuccess ? "✅" : "❌"}`);

		if (testSuccess) {
			console.log("\n🎉 SUCCESS!");
			console.log(
				"Elson's account has been completely recreated and should work now.",
			);
			console.log("\n🔑 Login credentials:");
			console.log(`   Email: ${TARGET_EMAIL}`);
			console.log(`   Password: ${NEW_PASSWORD}`);
			console.log("\nTry logging in from the frontend!");
		} else {
			console.log("\n❌ STILL FAILING");
			console.log(
				"The issue appears to be with Better Auth itself, not the user account.",
			);
			console.log(
				"Consider checking Railway logs for more detailed error information.",
			);
		}
	} catch (error) {
		console.error("💥 Account recreation failed:", error);
	}
}

main();
