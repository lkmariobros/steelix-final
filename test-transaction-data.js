// Test script to check transaction data and create sample data if needed
const { drizzle } = require("drizzle-orm/postgres-js");
const postgres = require("postgres");
require("dotenv").config({ path: "./apps/server/.env" });

async function testTransactionData() {
	console.log("🔍 Testing Transaction Data...\n");

	// Connect to database
	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) {
		console.error("❌ DATABASE_URL not found in environment variables");
		return;
	}

	const sql = postgres(connectionString);
	const db = drizzle(sql);

	try {
		// Check if transactions table exists and has data
		console.log("1. Checking transactions table...");
		const result = await sql`
            SELECT COUNT(*) as count, 
                   MIN(created_at) as oldest_date,
                   MAX(created_at) as newest_date
            FROM transactions;
        `;

		console.log(`   Found ${result[0].count} transactions`);
		if (result[0].count > 0) {
			console.log(
				`   Date range: ${result[0].oldest_date} to ${result[0].newest_date}`,
			);
		}

		// Get sample transaction data
		if (result[0].count > 0) {
			console.log("\n2. Sample transaction data:");
			const sampleData = await sql`
                SELECT id, agent_id, created_at, updated_at, transaction_date, status
                FROM transactions 
                LIMIT 3;
            `;

			sampleData.forEach((transaction, index) => {
				console.log(`   Transaction ${index + 1}:`);
				console.log(`     ID: ${transaction.id}`);
				console.log(`     Agent ID: ${transaction.agent_id}`);
				console.log(
					`     Created At: ${transaction.created_at} (${typeof transaction.created_at})`,
				);
				console.log(
					`     Updated At: ${transaction.updated_at} (${typeof transaction.updated_at})`,
				);
				console.log(
					`     Transaction Date: ${transaction.transaction_date} (${typeof transaction.transaction_date})`,
				);
				console.log(`     Status: ${transaction.status}`);
				console.log("");
			});
		} else {
			console.log("\n2. No transactions found. Creating sample transaction...");

			// Get the current user ID from the session we saw in logs
			const userResult = await sql`
                SELECT id, email FROM users LIMIT 1;
            `;

			if (userResult.length === 0) {
				console.log("   ❌ No users found in database");
				return;
			}

			const userId = userResult[0].id;
			console.log(`   Using user: ${userResult[0].email} (${userId})`);

			// Create a sample transaction
			const sampleTransaction = await sql`
                INSERT INTO transactions (
                    agent_id,
                    market_type,
                    transaction_type,
                    transaction_date,
                    property_data,
                    client_data,
                    commission_amount,
                    commission_type,
                    status
                ) VALUES (
                    ${userId},
                    'residential',
                    'sale',
                    NOW(),
                    '{"address": "123 Sample St, Test City", "propertyType": "Single Family Home", "price": 500000}',
                    '{"name": "John Doe", "type": "buyer", "email": "john@example.com"}',
                    '15000.00',
                    'percentage',
                    'completed'
                ) RETURNING id, created_at, updated_at;
            `;

			console.log(
				`   ✅ Created sample transaction: ${sampleTransaction[0].id}`,
			);
			console.log(
				`   Created At: ${sampleTransaction[0].created_at} (${typeof sampleTransaction[0].created_at})`,
			);
			console.log(
				`   Updated At: ${sampleTransaction[0].updated_at} (${typeof sampleTransaction[0].updated_at})`,
			);
		}
	} catch (error) {
		console.error("❌ Database error:", error);
	} finally {
		await sql.end();
	}

	console.log("\n🎯 Transaction Data Test Complete!");
	console.log(
		"Now try refreshing the transactions page: http://localhost:3002/dashboard/transactions",
	);
}

testTransactionData().catch(console.error);
