import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "../src/db/index.js";

async function testLogin() {
	try {
		const email = "josephkwantum@gmail.com";
		const password = "password123";

		console.log("🔍 Testing login for:", email);

		// 1. Get user
		const userResult = await db.execute(sql`
      SELECT id, name, email, email_verified, role 
      FROM "user" 
      WHERE email = ${email}
    `);

		if (userResult.rows.length === 0) {
			console.log("❌ User not found!");
			return;
		}

		const user = userResult.rows[0];
		console.log("✅ User found:", user);

		// 2. Get account with password
		const accountResult = await db.execute(sql`
      SELECT id, user_id, provider_id, password 
      FROM "account" 
      WHERE user_id = ${user.id} AND provider_id = 'credential'
    `);

		if (accountResult.rows.length === 0) {
			console.log("❌ No credential account found!");
			return;
		}

		const account = accountResult.rows[0];
		console.log("✅ Account found:", {
			id: account.id,
			user_id: account.user_id,
			provider_id: account.provider_id,
			hasPassword: !!account.password,
			passwordLength: account.password?.length,
		});

		// 3. Test password comparison
		const storedPassword = account.password as string;
		console.log("\n🔐 Testing password comparison...");
		console.log("   Stored hash:", storedPassword.substring(0, 20) + "...");
		console.log(
			"   Hash type:",
			storedPassword.startsWith("$2a")
				? "bcrypt $2a"
				: storedPassword.startsWith("$2b")
					? "bcrypt $2b"
					: "unknown",
		);

		const isMatch = await bcrypt.compare(password, storedPassword);
		console.log("   Password match:", isMatch ? "✅ YES" : "❌ NO");

		if (!isMatch) {
			console.log("\n⚠️ Password doesn't match! Re-hashing...");
			const newHash = await bcrypt.hash(password, 10);
			console.log("   New hash:", newHash.substring(0, 20) + "...");

			// Update password
			await db.execute(sql`
        UPDATE "account" 
        SET password = ${newHash}, updated_at = NOW()
        WHERE id = ${account.id}
      `);
			console.log("   ✅ Password updated!");

			// Verify
			const verifyMatch = await bcrypt.compare(password, newHash);
			console.log("   Verification:", verifyMatch ? "✅ YES" : "❌ NO");
		}

		console.log("\n🎉 Login test completed!");
	} catch (error) {
		console.error("❌ Error:", error);
	}
}

testLogin()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
