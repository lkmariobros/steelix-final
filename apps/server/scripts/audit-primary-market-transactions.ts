import { sql } from "drizzle-orm";
import { db } from "../src/db/index.js";

async function auditPrimaryMarketTransactions() {
	try {
		console.log("🔍 PHASE 4: DATABASE AUDIT - Primary Market Transactions");
		console.log("=".repeat(60));

		// Check for invalid primary market + lease/rental combinations
		console.log("\n1. Checking for invalid combinations...");
		const invalidCombinations = await db.execute(sql`
			SELECT 
				id,
				market_type,
				transaction_type,
				created_at,
				updated_at,
				status,
				agent_id
			FROM transactions 
			WHERE market_type = 'primary' 
			AND transaction_type IN ('lease', 'rental')
			ORDER BY created_at DESC
		`);

		console.log(
			`\n📊 Found ${invalidCombinations.rows?.length || 0} invalid combinations:`,
		);

		if (invalidCombinations.rows && invalidCombinations.rows.length > 0) {
			console.log("\n❌ INVALID TRANSACTIONS FOUND:");
			invalidCombinations.rows.forEach((row, index) => {
				console.log(`\n${index + 1}. Transaction ID: ${row.id}`);
				console.log(
					`   📍 Market: ${row.market_type} | Type: ${row.transaction_type}`,
				);
				console.log(`   📊 Status: ${row.status}`);
				console.log(`   👤 Agent ID: ${row.agent_id}`);
				console.log(`   📅 Created: ${row.created_at}`);
				console.log(`   🔄 Updated: ${row.updated_at}`);
			});

			console.log("\n⚠️  RECOMMENDED ACTIONS:");
			console.log(
				"1. Convert to 'sale' type (recommended for data consistency)",
			);
			console.log(
				"2. Change market type to 'secondary' (if business logic allows)",
			);
			console.log("3. Flag for manual review (safest option)");
			console.log("4. Delete if they are test/invalid data");
		} else {
			console.log("✅ No invalid combinations found! Database is clean.");
		}

		// Get overall transaction statistics
		console.log("\n2. Overall transaction statistics...");
		const stats = await db.execute(sql`
			SELECT 
				market_type,
				transaction_type,
				COUNT(*) as count,
				COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count
			FROM transactions 
			GROUP BY market_type, transaction_type
			ORDER BY market_type, transaction_type
		`);

		console.log("\n📈 TRANSACTION STATISTICS:");
		console.log("Market Type | Transaction Type | Total | Completed");
		console.log("-".repeat(50));

		for (const row of stats.rows ?? []) {
			const market = String(row.market_type).padEnd(11);
			const type = String(row.transaction_type).padEnd(16);
			const total = String(row.count).padEnd(5);
			const completed = String(row.completed_count);
			console.log(`${market} | ${type} | ${total} | ${completed}`);
		}

		// Check for potential business impact
		console.log("\n3. Business impact analysis...");
		const impactAnalysis = await db.execute(sql`
			SELECT 
				COUNT(*) as total_transactions,
				COUNT(CASE WHEN market_type = 'primary' THEN 1 END) as primary_transactions,
				COUNT(CASE WHEN market_type = 'primary' AND transaction_type = 'sale' THEN 1 END) as primary_sales,
				COUNT(CASE WHEN market_type = 'primary' AND transaction_type IN ('lease', 'rental') THEN 1 END) as primary_invalid
			FROM transactions
		`);

		if (impactAnalysis.rows && impactAnalysis.rows.length > 0) {
			const analysis = impactAnalysis.rows[0];
			console.log("\n📊 BUSINESS IMPACT ANALYSIS:");
			console.log(`Total Transactions: ${analysis.total_transactions}`);
			console.log(
				`Primary Market Transactions: ${analysis.primary_transactions}`,
			);
			console.log(`Primary Market Sales (Valid): ${analysis.primary_sales}`);
			console.log(
				`Primary Market Lease/Rental (Invalid): ${analysis.primary_invalid}`,
			);

			if (Number(analysis.primary_invalid) > 0) {
				const invalidPercentage = (
					(Number(analysis.primary_invalid) /
						Number(analysis.total_transactions)) *
					100
				).toFixed(2);
				console.log(
					`\n⚠️  Impact: ${invalidPercentage}% of all transactions need correction`,
				);
			}
		}

		console.log("\n4. Dependent system components check...");
		console.log("📋 COMPONENTS THAT MAY BE AFFECTED:");
		console.log("• Commission calculation logic");
		console.log("• Client type determination");
		console.log("• Co-broking rules");
		console.log("• Dashboard analytics");
		console.log("• Reporting queries");
		console.log("• Business intelligence dashboards");

		console.log("\n✅ Database audit completed!");
		console.log("\n🔧 NEXT STEPS:");
		console.log("1. Review invalid transactions above");
		console.log("2. Choose correction strategy");
		console.log("3. Run migration script (if needed)");
		console.log("4. Test dependent systems");
		console.log("5. Deploy validation rules");
	} catch (error) {
		console.error("❌ Error during database audit:", error);
		throw error;
	}
}

// Run the audit
auditPrimaryMarketTransactions()
	.then(() => {
		console.log("\n🎉 Audit process completed successfully!");
		process.exit(0);
	})
	.catch((error) => {
		console.error("💥 Audit process failed:", error);
		process.exit(1);
	});
