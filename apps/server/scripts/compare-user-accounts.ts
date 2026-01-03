import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "../src/db/index.js";

const WORKING_USER = "josephkwantum@gmail.com";
const FAILING_USER = "elson@devots.com.my";

console.log("🔍 USER ACCOUNT COMPARISON");
console.log("==========================");
console.log(`Working User: ${WORKING_USER}`);
console.log(`Failing User: ${FAILING_USER}\n`);

async function compareUserAccounts() {
	console.log("1️⃣ Comparing user records...");

	try {
		const result = await db.execute(sql`
      SELECT 
        u.id,
        u.email,
        u.name,
        u.email_verified,
        u.role,
        u.agent_tier,
        u.company_commission_split,
        u.created_at,
        u.updated_at,
        -- Account information
        a.id as account_id,
        a.account_id as account_account_id,
        a.provider_id,
        a.created_at as account_created,
        a.updated_at as account_updated,
        -- Password info (without revealing actual password)
        CASE 
          WHEN a.password IS NOT NULL THEN 'HAS_PASSWORD'
          ELSE 'NO_PASSWORD'
        END as password_status,
        LENGTH(a.password) as password_length,
        SUBSTRING(a.password, 1, 10) as password_prefix
      FROM "user" u
      LEFT JOIN "account" a ON u.id = a.user_id AND a.provider_id = 'credential'
      WHERE u.email IN (${WORKING_USER}, ${FAILING_USER})
      ORDER BY u.email
    `);

		if (!result?.rows?.length) {
			console.log("❌ No users found");
			return;
		}

		console.log("✅ User comparison:");
		result.rows.forEach((user, index) => {
			const status = user.email === WORKING_USER ? "✅ WORKING" : "❌ FAILING";
			console.log(`\n${status} - ${user.email}:`);
			console.log(`   User ID: ${user.id}`);
			console.log(`   Name: ${user.name}`);
			console.log(`   Email Verified: ${user.email_verified}`);
			console.log(`   Role: ${user.role}`);
			console.log(`   Agent Tier: ${user.agent_tier}`);
			console.log(`   Commission Split: ${user.company_commission_split}%`);
			console.log(`   User Created: ${user.created_at}`);
			console.log(`   User Updated: ${user.updated_at}`);

			if (user.account_id) {
				console.log(`   Account ID: ${user.account_id}`);
				console.log(`   Account Account ID: ${user.account_account_id}`);
				console.log(`   Provider: ${user.provider_id}`);
				console.log(`   Password Status: ${user.password_status}`);
				console.log(`   Password Length: ${user.password_length}`);
				console.log(`   Password Prefix: ${user.password_prefix}...`);
				console.log(`   Account Created: ${user.account_created}`);
				console.log(`   Account Updated: ${user.account_updated}`);
			} else {
				console.log(`   ❌ NO ACCOUNT RECORD FOUND`);
			}
		});

		return result.rows;
	} catch (error) {
		console.error("❌ Error comparing users:", error);
		return null;
	}
}

async function testPasswordHashes(users: any[]) {
	console.log("\n2️⃣ Testing password hashes...");

	const passwords = {
		[WORKING_USER]: "akukuat123456",
		[FAILING_USER]: "DevOts2024!",
	};

	for (const user of users) {
		const testPassword = passwords[user.email];
		console.log(`\n🔐 Testing ${user.email} with password "${testPassword}"`);

		if (!user.password_status || user.password_status === "NO_PASSWORD") {
			console.log("❌ No password hash found");
			continue;
		}

		try {
			// Get the actual password hash
			const passwordResult = await db.execute(sql`
        SELECT password FROM "account" 
        WHERE user_id = ${user.id} AND provider_id = 'credential'
      `);

			if (!passwordResult?.rows?.[0]?.password) {
				console.log("❌ Could not retrieve password hash");
				continue;
			}

			const storedHash = passwordResult.rows[0].password;
			const isValid = await bcrypt.compare(testPassword, storedHash);

			console.log(`   Hash validation: ${isValid ? "✅ VALID" : "❌ INVALID"}`);
			console.log(
				`   Hash format: ${storedHash.startsWith("$2b$") ? "✅ bcrypt" : "❌ unknown"}`,
			);
			console.log(`   Hash length: ${storedHash.length} characters`);

			if (!isValid) {
				console.log("   🔍 Testing other possible passwords...");
				const otherPasswords = [
					"newpassword123",
					"password123",
					"DevOts2024!",
					"akukuat123456",
				];

				for (const testPwd of otherPasswords) {
					if (testPwd !== testPassword) {
						const testResult = await bcrypt.compare(testPwd, storedHash);
						if (testResult) {
							console.log(`   ✅ Password "${testPwd}" works!`);
							break;
						}
					}
				}
			}
		} catch (error) {
			console.error(`   ❌ Error testing password: ${error.message}`);
		}
	}
}

async function checkAccountConsistency(users: any[]) {
	console.log("\n3️⃣ Checking account consistency...");

	for (const user of users) {
		console.log(`\n🔍 Checking ${user.email}:`);

		try {
			// Check for multiple accounts
			const accountsResult = await db.execute(sql`
        SELECT 
          id,
          account_id,
          provider_id,
          created_at,
          updated_at
        FROM "account" 
        WHERE user_id = ${user.id}
        ORDER BY created_at
      `);

			console.log(`   Total accounts: ${accountsResult.rows.length}`);

			accountsResult.rows.forEach((account, index) => {
				console.log(`   Account ${index + 1}:`);
				console.log(`     ID: ${account.id}`);
				console.log(`     Account ID: ${account.account_id}`);
				console.log(`     Provider: ${account.provider_id}`);
				console.log(`     Created: ${account.created_at}`);
				console.log(`     Updated: ${account.updated_at}`);
			});

			// Check for orphaned sessions
			const sessionsResult = await db.execute(sql`
        SELECT COUNT(*) as session_count
        FROM "session" 
        WHERE user_id = ${user.id}
      `);

			console.log(
				`   Active sessions: ${sessionsResult.rows[0]?.session_count || 0}`,
			);
		} catch (error) {
			console.error(`   ❌ Error checking consistency: ${error.message}`);
		}
	}
}

async function main() {
	try {
		const users = await compareUserAccounts();

		if (!users || users.length === 0) {
			console.log("\n❌ No users found to compare");
			return;
		}

		await testPasswordHashes(users);
		await checkAccountConsistency(users);

		console.log("\n📊 ANALYSIS SUMMARY:");
		console.log("===================");

		const workingUser = users.find((u) => u.email === WORKING_USER);
		const failingUser = users.find((u) => u.email === FAILING_USER);

		if (workingUser && failingUser) {
			console.log("\n🔍 KEY DIFFERENCES:");

			// Compare key fields
			const differences = [];

			if (workingUser.email_verified !== failingUser.email_verified) {
				differences.push(
					`Email verified: ${workingUser.email_verified} vs ${failingUser.email_verified}`,
				);
			}

			if (workingUser.role !== failingUser.role) {
				differences.push(`Role: ${workingUser.role} vs ${failingUser.role}`);
			}

			if (workingUser.password_length !== failingUser.password_length) {
				differences.push(
					`Password length: ${workingUser.password_length} vs ${failingUser.password_length}`,
				);
			}

			if (differences.length > 0) {
				differences.forEach((diff) => console.log(`   - ${diff}`));
			} else {
				console.log("   No obvious structural differences found");
				console.log("   Issue might be with password hash or account linking");
			}
		}

		console.log("\n💡 RECOMMENDATIONS:");
		if (failingUser && failingUser.password_status === "NO_PASSWORD") {
			console.log(
				"1. ❌ Failing user has no password - create credential account",
			);
		} else if (failingUser) {
			console.log(
				"1. 🔄 Reset password for failing user with known working hash",
			);
			console.log("2. 🧹 Clear any orphaned sessions");
			console.log("3. 🔍 Check for account ID mismatches");
		}
	} catch (error) {
		console.error("💥 Analysis failed:", error);
	}
}

main();
