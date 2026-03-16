import { scryptAsync } from "@noble/hashes/scrypt";
import { sql } from "drizzle-orm";
/**
 * Fix password format for Better Auth
 * Better Auth uses scrypt (salt:hexKey format), NOT bcrypt
 */
import { db } from "../src/db/index.js";

// Better Auth password hashing config
const config = {
	N: 16384,
	r: 16,
	p: 1,
	dkLen: 64,
};

function getRandomValues(array: Uint8Array): Uint8Array {
	for (let i = 0; i < array.length; i++) {
		array[i] = Math.floor(Math.random() * 256);
	}
	return array;
}

function hexEncode(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

async function hashPasswordBetterAuth(password: string): Promise<string> {
	const salt = hexEncode(getRandomValues(new Uint8Array(16)));
	const key = await scryptAsync(password.normalize("NFKC"), salt, {
		N: config.N,
		p: config.p,
		r: config.r,
		dkLen: config.dkLen,
		maxmem: 128 * config.N * config.r * 2,
	});
	return `${salt}:${hexEncode(key)}`;
}

async function fixPasswords() {
	// Change these to fix a specific user's password
	const email = process.argv[2] || "elson@devots.com.my";
	const password = process.argv[3] || "DevOts2024!";

	console.log("🔧 Fixing password format for Better Auth");
	console.log("📧 Email:", email);
	console.log("🔑 Password:", password);
	console.log("");

	// Get user
	const userResult = await db.execute(sql`
    SELECT id FROM "user" WHERE email = ${email}
  `);

	if (userResult.rows.length === 0) {
		console.log("❌ User not found!");
		return;
	}

	const userId = userResult.rows[0].id as string;
	console.log("✅ User found:", userId);

	// Get current password
	const accountResult = await db.execute(sql`
    SELECT id, password FROM "account" 
    WHERE user_id = ${userId} AND provider_id = 'credential'
  `);

	if (accountResult.rows.length === 0) {
		console.log("❌ No credential account found!");
		return;
	}

	const account = accountResult.rows[0];
	const currentPassword = account.password as string;
	console.log(
		"📋 Current password format:",
		`${currentPassword.substring(0, 30)}...`,
	);
	console.log("📏 Current length:", currentPassword.length);

	// Check if it's already in Better Auth format (contains single colon)
	if (currentPassword.includes(":") && !currentPassword.startsWith("$2")) {
		console.log("✅ Password already in Better Auth format!");
		return;
	}

	// Hash with Better Auth format
	console.log("\n🔐 Hashing password with Better Auth (scrypt) format...");
	const newHash = await hashPasswordBetterAuth(password);
	console.log("✅ New hash:", `${newHash.substring(0, 40)}...`);
	console.log("📏 New length:", newHash.length);

	// Update in database
	console.log("\n💾 Updating database...");
	await db.execute(sql`
    UPDATE "account" 
    SET password = ${newHash}, updated_at = NOW()
    WHERE id = ${account.id}
  `);

	console.log("✅ Password updated successfully!");
	console.log("\n🎉 You can now log in with:");
	console.log("   Email:", email);
	console.log("   Password:", password);
}

fixPasswords()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error("❌ Error:", e);
		process.exit(1);
	});
