import { config } from "dotenv";
import { eq } from "drizzle-orm";
// Script to update user role to admin for testing
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Load environment variables
config({ path: "./apps/server/.env" });

async function updateUserRole() {
	console.log("🔧 Updating user role to admin...\n");

	// Connect to database
	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) {
		console.error("❌ DATABASE_URL not found in environment variables");
		return;
	}

	const sql = postgres(connectionString);
	const db = drizzle(sql);

	try {
		// Import schema
		const { user } = await import("./apps/server/src/db/schema/auth.js");

		// Find the current user (Leow Kwan)
		console.log("1. Finding current user...");
		const users = await db
			.select()
			.from(user)
			.where(eq(user.email, "josephkwantum@gmail.com"))
			.limit(1);

		if (users.length === 0) {
			console.log("❌ User not found with email: josephkwantum@gmail.com");
			return;
		}

		const currentUser = users[0];
		console.log(`   Found user: ${currentUser.name} (${currentUser.email})`);
		console.log(`   Current role: ${currentUser.role || "null"}`);

		// Update user role to admin
		console.log("\n2. Updating user role to admin...");
		const updatedUsers = await db
			.update(user)
			.set({
				role: "admin",
				updatedAt: new Date(),
			})
			.where(eq(user.id, currentUser.id))
			.returning();

		if (updatedUsers.length > 0) {
			console.log(
				`   ✅ Successfully updated user role to: ${updatedUsers[0].role}`,
			);
			console.log(
				`   User: ${updatedUsers[0].name} (${updatedUsers[0].email})`,
			);
		} else {
			console.log("   ❌ Failed to update user role");
		}
	} catch (error) {
		console.error("❌ Database error:", error);
	} finally {
		await sql.end();
	}

	console.log("\n🎯 User Role Update Complete!");
	console.log(
		"The user should now have admin access to all admin portal features.",
	);
}

updateUserRole().catch(console.error);
