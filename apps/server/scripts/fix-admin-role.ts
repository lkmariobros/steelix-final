import { sql } from "drizzle-orm";
import { db } from "../src/db/index.js";

async function fixAdminRole() {
	try {
		const email = "josephkwantum@gmail.com";

		console.log(`🔄 Updating role to admin for: ${email}`);

		// Update user role to admin
		const result = await db.execute(sql`
			UPDATE "user" 
			SET role = 'admin', updated_at = NOW()
			WHERE email = ${email}
		`);

		console.log(`✅ Role updated to admin for ${email}`);

		// Verify the update
		const user = await db.execute(sql`
			SELECT email, name, role, created_at, updated_at
			FROM "user" 
			WHERE email = ${email}
		`);

		if (user?.rows?.[0]) {
			console.log("🔐 Updated user details:");
			console.log(`   📧 Email: ${user.rows[0].email}`);
			console.log(`   👤 Name: ${user.rows[0].name}`);
			console.log(`   🔑 Role: ${user.rows[0].role}`);
			console.log(`   📅 Created: ${user.rows[0].created_at}`);
			console.log(`   🔄 Updated: ${user.rows[0].updated_at}`);
		}

		console.log("\n🎉 You can now access the admin portal with:");
		console.log(`📧 Email: ${email}`);
		console.log("🔑 Password: password123");
		console.log("🏷️  Role: admin");
	} catch (error) {
		console.error("❌ Error fixing admin role:", error);
		throw error;
	}
}

// Run the fix
fixAdminRole()
	.then(() => {
		console.log("\n✅ Admin role fix completed!");
		process.exit(0);
	})
	.catch((error) => {
		console.error("💥 Admin role fix failed:", error);
		process.exit(1);
	});
