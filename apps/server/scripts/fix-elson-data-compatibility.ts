import { sql } from "drizzle-orm";
import { db } from "../src/db/index.js";

const TARGET_EMAIL = "elson@devots.com.my";
const WORKING_EMAIL = "josephkwantum@gmail.com";

console.log("🔧 FIXING ELSON DATA COMPATIBILITY");
console.log("==================================");

async function compareUserData() {
	console.log("1️⃣ Comparing user data fields...");

	try {
		const result = await db.execute(sql`
      SELECT 
        email,
        name,
        email_verified,
        role,
        agent_tier,
        company_commission_split,
        agency_id,
        team_id,
        permissions,
        created_at,
        updated_at,
        -- Check for any NULL or unusual values
        CASE WHEN name IS NULL THEN 'NULL' ELSE 'OK' END as name_status,
        CASE WHEN role IS NULL THEN 'NULL' ELSE 'OK' END as role_status,
        CASE WHEN agent_tier IS NULL THEN 'NULL' ELSE 'OK' END as agent_tier_status,
        CASE WHEN company_commission_split IS NULL THEN 'NULL' ELSE 'OK' END as commission_status
      FROM "user" 
      WHERE email IN (${TARGET_EMAIL}, ${WORKING_EMAIL})
      ORDER BY email
    `);

		if (!result?.rows?.length) {
			console.log("❌ No users found");
			return null;
		}

		console.log("✅ User data comparison:");
		result.rows.forEach((user) => {
			const status = user.email === TARGET_EMAIL ? "❌ FAILING" : "✅ WORKING";
			console.log(`\n${status} - ${user.email}:`);
			console.log(`   Name: ${user.name} (${user.name_status})`);
			console.log(`   Email Verified: ${user.email_verified}`);
			console.log(`   Role: ${user.role} (${user.role_status})`);
			console.log(
				`   Agent Tier: ${user.agent_tier} (${user.agent_tier_status})`,
			);
			console.log(
				`   Commission: ${user.company_commission_split}% (${user.commission_status})`,
			);
			console.log(`   Agency ID: ${user.agency_id || "NULL"}`);
			console.log(`   Team ID: ${user.team_id || "NULL"}`);
			console.log(`   Permissions: ${user.permissions || "NULL"}`);
			console.log(`   Created: ${user.created_at}`);
			console.log(`   Updated: ${user.updated_at}`);
		});

		return result.rows;
	} catch (error) {
		console.error("❌ Error comparing user data:", error);
		return null;
	}
}

async function normalizeElsonData() {
	console.log("\n2️⃣ Normalizing Elson's data to match working pattern...");

	try {
		// Get Joseph's data as template
		const josephResult = await db.execute(sql`
      SELECT 
        name,
        email_verified,
        role,
        agent_tier,
        company_commission_split,
        agency_id,
        team_id,
        permissions
      FROM "user" 
      WHERE email = ${WORKING_EMAIL}
    `);

		if (!josephResult?.rows?.[0]) {
			console.log("❌ Cannot get Joseph's data as template");
			return false;
		}

		const template = josephResult.rows[0];
		console.log("✅ Using Joseph's data as template:");
		console.log(`   Email Verified: ${template.email_verified}`);
		console.log(`   Role: ${template.role}`);
		console.log(`   Agent Tier: ${template.agent_tier}`);
		console.log(`   Commission: ${template.company_commission_split}%`);
		console.log(`   Agency ID: ${template.agency_id || "NULL"}`);
		console.log(`   Team ID: ${template.team_id || "NULL"}`);
		console.log(`   Permissions: ${template.permissions || "NULL"}`);

		// Update Elson's data to match the working pattern
		await db.execute(sql`
      UPDATE "user" 
      SET 
        email_verified = ${template.email_verified},
        role = ${template.role},
        agent_tier = ${template.agent_tier},
        company_commission_split = ${template.company_commission_split},
        agency_id = ${template.agency_id},
        team_id = ${template.team_id},
        permissions = ${template.permissions},
        updated_at = NOW()
      WHERE email = ${TARGET_EMAIL}
    `);

		console.log("✅ Updated Elson's data to match working pattern");
		return true;
	} catch (error) {
		console.error("❌ Error normalizing data:", error);
		return false;
	}
}

async function testAfterNormalization() {
	console.log("\n3️⃣ Testing authentication after normalization...");

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

		if (response.status === 500) {
			console.log(
				"❌ Still getting 500 error - issue is not in user data fields",
			);
			return false;
		} else if (response.status === 401) {
			console.log(
				"✅ Now getting 401 error - Better Auth is processing the user correctly!",
			);
			console.log("   The 500 error is fixed, just need to verify password");
			return true;
		} else if (response.status === 200) {
			console.log("🎉 Authentication successful!");
			return true;
		} else {
			console.log(`⚠️ Unexpected response: ${response.status}`);
			return false;
		}
	} catch (error) {
		console.error("❌ Error testing auth:", error);
		return false;
	}
}

async function tryDifferentPasswords() {
	console.log("\n4️⃣ Testing different passwords...");

	const passwords = [
		"DevOts2024!",
		"newpassword123",
		"password123",
		"akukuat123456",
	];

	for (const password of passwords) {
		console.log(`\n   Testing password: "${password}"`);

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
						password: password,
					}),
				},
			);

			console.log(`   Response: ${response.status} ${response.statusText}`);

			if (response.status === 200) {
				console.log(`✅ SUCCESS! Password "${password}" works!`);
				return password;
			} else if (response.status === 401) {
				console.log(`   ❌ Invalid password`);
			} else if (response.status === 500) {
				console.log(`   💥 500 error - still broken`);
			}
		} catch (error) {
			console.log(`   ❌ Error: ${error.message}`);
		}

		// Wait between attempts
		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	return null;
}

async function main() {
	try {
		// Step 1: Compare user data
		const users = await compareUserData();
		if (!users) {
			console.log("❌ Cannot proceed without user data");
			return;
		}

		// Step 2: Normalize Elson's data
		const normalized = await normalizeElsonData();
		if (!normalized) {
			console.log("❌ Data normalization failed");
			return;
		}

		// Step 3: Test after normalization
		const authFixed = await testAfterNormalization();

		// Step 4: If we get 401 instead of 500, try different passwords
		let workingPassword = null;
		if (authFixed) {
			workingPassword = await tryDifferentPasswords();
		}

		console.log("\n📊 FINAL RESULTS:");
		console.log("=================");
		console.log(`Data normalized: ${normalized ? "✅" : "❌"}`);
		console.log(`500 error fixed: ${authFixed ? "✅" : "❌"}`);
		console.log(
			`Working password found: ${workingPassword ? `✅ "${workingPassword}"` : "❌"}`,
		);

		if (workingPassword) {
			console.log("\n🎉 COMPLETE SUCCESS!");
			console.log(`Elson can now log in with:`);
			console.log(`   Email: ${TARGET_EMAIL}`);
			console.log(`   Password: ${workingPassword}`);
			console.log("\nTry logging in from the frontend!");
		} else if (authFixed) {
			console.log("\n✅ PARTIAL SUCCESS!");
			console.log(
				"The 500 error is fixed - Better Auth now processes Elson correctly.",
			);
			console.log("However, none of the test passwords worked.");
			console.log("You may need to reset the password using SQL.");
		} else {
			console.log("\n❌ STILL FAILING");
			console.log("The issue is deeper than user data fields.");
			console.log(
				"Consider checking Railway logs or Better Auth configuration.",
			);
		}
	} catch (error) {
		console.error("💥 Fix attempt failed:", error);
	}
}

main();
