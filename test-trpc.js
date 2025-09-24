// Simple test script to verify tRPC endpoints
const fetch = require("node-fetch");

async function testTRPCEndpoints() {
	const baseUrl = "http://localhost:8080/trpc";

	console.log("🧪 Testing tRPC Integration...\n");

	// Test 1: Check if tRPC server is responding
	try {
		console.log("1. Testing server health...");
		const healthResponse = await fetch(`${baseUrl}/health`);
		console.log(`   Status: ${healthResponse.status}`);

		if (healthResponse.status === 404) {
			console.log("   ✅ tRPC server is running (404 expected for /health)");
		}
	} catch (error) {
		console.log(`   ❌ Server connection failed: ${error.message}`);
		return;
	}

	// Test 2: Test transactions.list endpoint (should require auth)
	try {
		console.log("\n2. Testing transactions.list endpoint...");
		const transactionsResponse = await fetch(`${baseUrl}/transactions.list`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				0: {
					json: {
						limit: 10,
						offset: 0,
					},
				},
			}),
		});

		console.log(`   Status: ${transactionsResponse.status}`);
		const data = await transactionsResponse.text();
		console.log(`   Response: ${data.substring(0, 200)}...`);

		if (transactionsResponse.status === 401) {
			console.log("   ✅ Authentication required (expected)");
		} else if (transactionsResponse.status === 200) {
			console.log("   ✅ Endpoint responding correctly");
		}
	} catch (error) {
		console.log(`   ❌ Transactions test failed: ${error.message}`);
	}

	// Test 3: Test approvals.list endpoint (should require admin auth)
	try {
		console.log("\n3. Testing approvals.list endpoint...");
		const approvalsResponse = await fetch(`${baseUrl}/approvals.list`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				0: {
					json: {
						limit: 10,
						offset: 0,
					},
				},
			}),
		});

		console.log(`   Status: ${approvalsResponse.status}`);
		const data = await approvalsResponse.text();
		console.log(`   Response: ${data.substring(0, 200)}...`);

		if (approvalsResponse.status === 401) {
			console.log("   ✅ Authentication required (expected)");
		} else if (approvalsResponse.status === 200) {
			console.log("   ✅ Endpoint responding correctly");
		}
	} catch (error) {
		console.log(`   ❌ Approvals test failed: ${error.message}`);
	}

	console.log("\n🎯 tRPC Integration Test Complete!");
	console.log("\nNext steps:");
	console.log("1. Open http://localhost:3002 in your browser");
	console.log("2. Try to log in and navigate to /dashboard/transactions");
	console.log("3. Check browser console for any JavaScript errors");
	console.log("4. Verify that data loads correctly after authentication");
}

testTRPCEndpoints().catch(console.error);
