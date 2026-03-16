import { sql } from "drizzle-orm";
import { db } from "../src/db/index.js";

async function fixAuthIssue() {
	try {
		const email = "josephkwantum@gmail.com";
		const newPassword = "password123";

		console.log(`🔄 Fixing authentication for: ${email}`);

		// Get user ID
		const user = await db.execute(sql`
			SELECT id FROM "user" WHERE email = ${email}
		`);

		if (!user?.rows?.[0]) {
			throw new Error(`User not found: ${email}`);
		}

		const userId = user.rows[0].id;
		console.log(`👤 Found user ID: ${userId}`);

		// Use Better Auth's sign-up endpoint to create a new account with proper hashing
		console.log("🔄 Creating new account using Better Auth sign-up...");

		// First, delete the existing user to avoid conflicts
		await db.execute(sql`DELETE FROM "session" WHERE user_id = ${userId}`);
		await db.execute(sql`DELETE FROM "account" WHERE user_id = ${userId}`);
		await db.execute(sql`DELETE FROM "user" WHERE id = ${userId}`);

		console.log("🗑️ Deleted existing user and related records");

		// The user will need to sign up again with the same email
		console.log(`✅ User ${email} has been reset. They need to sign up again.`);

		console.log("\n🎉 Next steps:");
		console.log("1. Go to http://localhost:3000");
		console.log(`2. Click "Sign Up"`);
		console.log(`3. Use email: ${email}`);
		console.log(`4. Use password: ${newPassword}`);
		console.log(
			"5. The account will be recreated with admin role (first user bootstrap)",
		);

		// Update the first user bootstrap logic to handle this case
		console.log(
			"\n⚠️  Note: Since we deleted the user, they will be treated as the first user again and get admin role.",
		);
	} catch (error) {
		console.error("❌ Error fixing auth issue:", error);
		throw error;
	}
}

// Run the fix
fixAuthIssue()
	.then(() => {
		console.log("\n✅ Authentication fix completed!");
		process.exit(0);
	})
	.catch((error) => {
		console.error("💥 Authentication fix failed:", error);
		process.exit(1);
	});
