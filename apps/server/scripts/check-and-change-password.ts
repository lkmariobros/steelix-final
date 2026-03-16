import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "../src/db/index.js";

const TARGET_EMAIL = "elson@devots.com.my";
const NEW_PASSWORD = "newpassword123"; // Change this to your desired password

console.log("🔍 USER CHECK AND PASSWORD CHANGE SCRIPT");
console.log("=========================================");
console.log(`Target Email: ${TARGET_EMAIL}`);
console.log(`New Password: ${NEW_PASSWORD}\n`);

async function checkUserExists() {
	console.log("1️⃣ Checking if user exists...");

	try {
		const userResult = await db.execute(sql`
      SELECT 
        id, 
        email, 
        name, 
        role,
        email_verified,
        created_at,
        agent_tier,
        company_commission_split
      FROM "user" 
      WHERE email = ${TARGET_EMAIL}
    `);

		if (!userResult?.rows?.[0]) {
			console.log(`❌ User ${TARGET_EMAIL} does not exist in the database`);
			return null;
		}

		const user = userResult.rows[0];
		console.log("✅ User found!");
		console.log(`   ID: ${user.id}`);
		console.log(`   Name: ${user.name}`);
		console.log(`   Email: ${user.email}`);
		console.log(`   Role: ${user.role}`);
		console.log(`   Email Verified: ${user.email_verified}`);
		console.log(`   Agent Tier: ${user.agent_tier}`);
		console.log(`   Commission Split: ${user.company_commission_split}%`);
		console.log(`   Created: ${user.created_at}`);

		return user;
	} catch (error) {
		console.error("❌ Error checking user:", error);
		throw error;
	}
}

async function checkUserAccount(userId: string) {
	console.log("\n2️⃣ Checking user account details...");

	try {
		const accountResult = await db.execute(sql`
      SELECT 
        id,
        account_id,
        provider_id,
        user_id,
        created_at,
        updated_at,
        CASE 
          WHEN password IS NOT NULL THEN 'HAS_PASSWORD'
          ELSE 'NO_PASSWORD'
        END as password_status
      FROM "account" 
      WHERE user_id = ${userId}
    `);

		if (!accountResult?.rows?.length) {
			console.log(`⚠️  No account records found for user ${userId}`);
			return [];
		}

		console.log(`✅ Found ${accountResult.rows.length} account record(s):`);
		accountResult.rows.forEach((account, index) => {
			console.log(`   Account ${index + 1}:`);
			console.log(`     ID: ${account.id}`);
			console.log(`     Provider: ${account.provider_id}`);
			console.log(`     Password Status: ${account.password_status}`);
			console.log(`     Created: ${account.created_at}`);
		});

		return accountResult.rows;
	} catch (error) {
		console.error("❌ Error checking account:", error);
		throw error;
	}
}

async function changePassword(userId: string) {
	console.log("\n3️⃣ Changing password...");

	try {
		// Hash the new password using bcrypt
		console.log("🔐 Hashing new password...");
		const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);
		console.log("✅ Password hashed successfully");

		// Check if user has a credential account
		const credentialAccount = await db.execute(sql`
      SELECT id FROM "account" 
      WHERE user_id = ${userId} AND provider_id = 'credential'
    `);

		if (!credentialAccount?.rows?.[0]) {
			console.log("⚠️  No credential account found. Creating one...");

			// Create a new credential account
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
          gen_random_uuid()::text,
          ${userId},
          'credential',
          ${userId},
          ${hashedPassword},
          NOW(),
          NOW()
        )
      `);

			console.log("✅ Created new credential account with password");
		} else {
			// Update existing credential account
			await db.execute(sql`
        UPDATE "account" 
        SET 
          password = ${hashedPassword}, 
          updated_at = NOW()
        WHERE user_id = ${userId} AND provider_id = 'credential'
      `);

			console.log("✅ Updated existing credential account password");
		}

		// Ensure email is verified
		await db.execute(sql`
      UPDATE "user" 
      SET 
        email_verified = true, 
        updated_at = NOW()
      WHERE id = ${userId}
    `);

		console.log("✅ Email marked as verified");

		return true;
	} catch (error) {
		console.error("❌ Error changing password:", error);
		throw error;
	}
}

async function main() {
	try {
		// Step 1: Check if user exists
		const user = await checkUserExists();

		if (!user) {
			console.log("\n❌ Cannot proceed - user does not exist");
			console.log("\n💡 To create this user:");
			console.log("1. Go to your frontend application");
			console.log("2. Use the sign-up form");
			console.log(`3. Register with email: ${TARGET_EMAIL}`);
			process.exit(1);
		}

		// Step 2: Check account details
		const accounts = await checkUserAccount(user.id);

		// Step 3: Change password
		console.log("\n🚀 Proceeding with password change...");
		const success = await changePassword(user.id);

		if (success) {
			console.log("\n🎉 PASSWORD CHANGE SUCCESSFUL!");
			console.log("==============================");
			console.log(`✅ Password changed for: ${TARGET_EMAIL}`);
			console.log(`🔑 New password: ${NEW_PASSWORD}`);
			console.log("📧 Email verified: Yes");
			console.log("\n🚀 The user can now log in with:");
			console.log(`   Email: ${TARGET_EMAIL}`);
			console.log(`   Password: ${NEW_PASSWORD}`);
		}
	} catch (error) {
		console.error("\n💥 Script failed:", error);
		process.exit(1);
	}
}

// Run the script
main()
	.then(() => {
		console.log("\n✅ Script completed successfully!");
		process.exit(0);
	})
	.catch((error) => {
		console.error("💥 Script failed:", error);
		process.exit(1);
	});
