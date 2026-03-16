import { sql } from "drizzle-orm";
import { db } from "../src/db/index.js";

const TARGET_EMAIL = "elson@devots.com.my";

console.log("🔧 FIXING ELSON ACCOUNT");
console.log("=======================");
console.log(`Target: ${TARGET_EMAIL}\n`);

async function getUserInfo() {
	console.log("1️⃣ Getting user information...");

	try {
		const result = await db.execute(sql`
      SELECT id, email, name FROM "user" WHERE email = ${TARGET_EMAIL}
    `);

		if (!result?.rows?.[0]) {
			console.log("❌ User not found");
			return null;
		}

		const user = result.rows[0];
		console.log(`✅ Found user: ${user.name} (${user.email})`);
		console.log(`   User ID: ${user.id}`);

		return user;
	} catch (error) {
		console.error("❌ Error getting user info:", error);
		return null;
	}
}

async function clearOldSessions(userId: string) {
	console.log("\n2️⃣ Clearing old sessions...");

	try {
		// First, check how many sessions exist
		const sessionCountResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM "session" WHERE user_id = ${userId}
    `);

		const sessionCount = sessionCountResult.rows[0]?.count || 0;
		console.log(`   Found ${sessionCount} existing sessions`);

		if (sessionCount > 0) {
			// Delete all sessions for this user
			const deleteResult = await db.execute(sql`
        DELETE FROM "session" WHERE user_id = ${userId}
      `);

			console.log("✅ Cleared all sessions for user");
			console.log("   This will force a fresh login");
		} else {
			console.log("   No sessions to clear");
		}

		return true;
	} catch (error) {
		console.error("❌ Error clearing sessions:", error);
		return false;
	}
}

async function verifyAccountIntegrity(userId: string) {
	console.log("\n3️⃣ Verifying account integrity...");

	try {
		const result = await db.execute(sql`
      SELECT 
        a.id,
        a.account_id,
        a.provider_id,
        CASE 
          WHEN a.password IS NOT NULL THEN 'HAS_PASSWORD'
          ELSE 'NO_PASSWORD'
        END as password_status,
        LENGTH(a.password) as password_length
      FROM "account" a
      WHERE a.user_id = ${userId}
    `);

		if (!result?.rows?.length) {
			console.log("❌ No account records found");
			return false;
		}

		console.log("✅ Account integrity check:");
		result.rows.forEach((account, index) => {
			console.log(`   Account ${index + 1}:`);
			console.log(`     Provider: ${account.provider_id}`);
			console.log(`     Password: ${account.password_status}`);
			console.log(`     Password Length: ${account.password_length}`);
			console.log(
				`     Account ID matches User ID: ${account.account_id === userId ? "✅" : "❌"}`,
			);
		});

		return true;
	} catch (error) {
		console.error("❌ Error verifying account:", error);
		return false;
	}
}

async function testDirectAuth() {
	console.log("\n4️⃣ Testing direct authentication...");

	try {
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
					password: "DevOts2024!",
				}),
			},
		);

		console.log(`   Response: ${response.status} ${response.statusText}`);

		if (response.ok) {
			console.log("✅ Authentication successful!");

			// Check if we got a session cookie
			const setCookieHeader = response.headers.get("set-cookie");
			if (setCookieHeader) {
				console.log("✅ Session cookie received");
			} else {
				console.log("⚠️ No session cookie in response");
			}

			return true;
		}
		const responseText = await response.text();
		console.log(`❌ Authentication failed: ${responseText}`);
		return false;
	} catch (error) {
		console.error("❌ Error testing auth:", error);
		return false;
	}
}

async function main() {
	try {
		// Step 1: Get user info
		const user = await getUserInfo();
		if (!user) {
			console.log("\n❌ Cannot proceed without user");
			return;
		}

		// Step 2: Clear old sessions
		const sessionsCleaned = await clearOldSessions(user.id);

		// Step 3: Verify account integrity
		const accountOk = await verifyAccountIntegrity(user.id);

		// Step 4: Test authentication
		const authWorks = await testDirectAuth();

		console.log("\n📊 RESULTS:");
		console.log("===========");
		console.log("User found: ✅");
		console.log(`Sessions cleared: ${sessionsCleaned ? "✅" : "❌"}`);
		console.log(`Account integrity: ${accountOk ? "✅" : "❌"}`);
		console.log(`Authentication: ${authWorks ? "✅" : "❌"}`);

		if (authWorks) {
			console.log("\n🎉 SUCCESS!");
			console.log("The Elson account should now work properly.");
			console.log("Try logging in from the frontend.");
		} else {
			console.log("\n🔍 STILL FAILING");
			console.log(
				"The issue might be deeper in the Better Auth configuration.",
			);
			console.log("Consider checking:");
			console.log("1. Better Auth version compatibility");
			console.log("2. Database schema mismatches");
			console.log("3. Railway deployment logs for detailed errors");
		}
	} catch (error) {
		console.error("💥 Fix attempt failed:", error);
	}
}

main();
