import { db } from "../src/db/index.js";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function resetPassword() {
	try {
		const email = "josephkwantum@gmail.com";
		const newPassword = "password123";
		
		console.log(`🔄 Resetting password for: ${email}`);
		
		// Hash the new password
		const hashedPassword = await bcrypt.hash(newPassword, 10);
		console.log("🔐 Password hashed successfully");
		
		// Update the password in the account table
		const result = await db.execute(sql`
			UPDATE "account" 
			SET password = ${hashedPassword}, updated_at = NOW()
			WHERE user_id = (
				SELECT id FROM "user" WHERE email = ${email}
			)
			AND provider_id = 'credential'
		`);
		
		console.log(`✅ Password updated for ${email}`);
		console.log(`🔑 New password: ${newPassword}`);
		
		// Also ensure email is verified
		await db.execute(sql`
			UPDATE "user" 
			SET email_verified = true, updated_at = NOW()
			WHERE email = ${email}
		`);
		
		console.log("✅ Email marked as verified");
		
		console.log("\n🎉 You can now login with:");
		console.log(`📧 Email: ${email}`);
		console.log(`🔑 Password: ${newPassword}`);
		
	} catch (error) {
		console.error("❌ Error resetting password:", error);
		throw error;
	}
}

// Run the password reset
resetPassword()
	.then(() => {
		console.log("\n✅ Password reset completed!");
		process.exit(0);
	})
	.catch((error) => {
		console.error("💥 Password reset failed:", error);
		process.exit(1);
	});
