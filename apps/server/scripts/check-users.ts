import { db } from "../src/db/index.js";
import { sql } from "drizzle-orm";

async function checkUsers() {
	try {
		console.log("🔍 Checking existing users...");
		
		// Get user information (without passwords for security)
		const users = await db.execute(sql`
			SELECT 
				id, 
				email, 
				name, 
				role,
				email_verified,
				created_at,
				agent_tier,
				company_commission_split
			FROM "user" 
			ORDER BY created_at
		`);
		
		console.log("👥 Found users:");
		users.rows?.forEach((user, index) => {
			console.log(`\n${index + 1}. User Details:`);
			console.log(`   📧 Email: ${user.email}`);
			console.log(`   👤 Name: ${user.name}`);
			console.log(`   🔑 Role: ${user.role}`);
			console.log(`   ✅ Email Verified: ${user.email_verified}`);
			console.log(`   🏷️  Agent Tier: ${user.agent_tier}`);
			console.log(`   💰 Commission Split: ${user.company_commission_split}%`);
			console.log(`   📅 Created: ${user.created_at}`);
		});
		
		// Check account table structure first
		const accountColumns = await db.execute(sql`
			SELECT column_name, data_type
			FROM information_schema.columns
			WHERE table_name = 'account'
			AND table_schema = 'public'
			ORDER BY column_name
		`);

		console.log(`\n🔐 Account table columns:`);
		accountColumns.rows?.forEach(c => console.log(`   ${c.column_name} (${c.data_type})`));

		// Check if there are any account records
		const accounts = await db.execute(sql`SELECT COUNT(*) as count FROM "account"`);
		console.log(`\n🔐 Found ${accounts.rows?.[0]?.count || 0} account records`);
		
		// Check sessions
		const sessions = await db.execute(sql`
			SELECT 
				user_id,
				expires_at,
				created_at
			FROM "session"
			WHERE expires_at > NOW()
		`);
		
		console.log(`\n🎫 Found ${sessions.rows?.length || 0} active sessions`);
		
	} catch (error) {
		console.error("❌ Error checking users:", error);
		throw error;
	}
}

// Run the check
checkUsers()
	.then(() => {
		console.log("\n✅ User check completed!");
		process.exit(0);
	})
	.catch((error) => {
		console.error("💥 User check failed:", error);
		process.exit(1);
	});
