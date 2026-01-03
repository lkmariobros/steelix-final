import { db } from "../src/db/index.js";
import { sql } from "drizzle-orm";

async function diagnoseAuthIssue() {
	try {
		console.log("🔍 Diagnosing authentication inconsistency...");
		
		// Check both accounts in detail
		const users = await db.execute(sql`
			SELECT 
				u.id, 
				u.email, 
				u.name, 
				u.role,
				u.email_verified,
				u.created_at,
				u.updated_at,
				u.agent_tier,
				u.company_commission_split
			FROM "user" u
			WHERE u.email IN ('josephkwantum@gmail.com', 'lktarod@gmail.com')
			ORDER BY u.email
		`);
		
		console.log("\n👥 Account Comparison:");
		users.rows?.forEach((user, index) => {
			console.log(`\n${index + 1}. ${user.email}:`);
			console.log(`   👤 Name: ${user.name}`);
			console.log(`   🔑 Role: ${user.role}`);
			console.log(`   ✅ Email Verified: ${user.email_verified}`);
			console.log(`   🏷️  Agent Tier: ${user.agent_tier}`);
			console.log(`   💰 Commission Split: ${user.company_commission_split}%`);
			console.log(`   📅 Created: ${user.created_at}`);
			console.log(`   🔄 Updated: ${user.updated_at}`);
		});
		
		// Check account records (passwords)
		const accounts = await db.execute(sql`
			SELECT 
				a.user_id,
				a.provider_id,
				a.password IS NOT NULL as has_password,
				LENGTH(a.password) as password_length,
				a.created_at,
				a.updated_at,
				u.email
			FROM "account" a
			JOIN "user" u ON a.user_id = u.id
			WHERE u.email IN ('josephkwantum@gmail.com', 'lktarod@gmail.com')
			ORDER BY u.email
		`);
		
		console.log("\n🔐 Account Records:");
		accounts.rows?.forEach((account, index) => {
			console.log(`\n${index + 1}. ${account.email}:`);
			console.log(`   🔑 Provider: ${account.provider_id}`);
			console.log(`   🔒 Has Password: ${account.has_password}`);
			console.log(`   📏 Password Length: ${account.password_length}`);
			console.log(`   📅 Account Created: ${account.created_at}`);
			console.log(`   🔄 Account Updated: ${account.updated_at}`);
		});
		
		// Check active sessions
		const sessions = await db.execute(sql`
			SELECT 
				s.user_id,
				s.expires_at,
				s.created_at,
				u.email
			FROM "session" s
			JOIN "user" u ON s.user_id = u.id
			WHERE u.email IN ('josephkwantum@gmail.com', 'lktarod@gmail.com')
			AND s.expires_at > NOW()
			ORDER BY u.email, s.created_at DESC
		`);
		
		console.log("\n🎫 Active Sessions:");
		if (sessions.rows?.length === 0) {
			console.log("   No active sessions for these accounts");
		} else {
			sessions.rows?.forEach((session, index) => {
				console.log(`\n${index + 1}. ${session.email}:`);
				console.log(`   📅 Created: ${session.created_at}`);
				console.log(`   ⏰ Expires: ${session.expires_at}`);
			});
		}
		
	} catch (error) {
		console.error("❌ Error diagnosing auth issue:", error);
		throw error;
	}
}

// Run the diagnosis
diagnoseAuthIssue()
	.then(() => {
		console.log("\n✅ Authentication diagnosis completed!");
		process.exit(0);
	})
	.catch((error) => {
		console.error("💥 Authentication diagnosis failed:", error);
		process.exit(1);
	});
