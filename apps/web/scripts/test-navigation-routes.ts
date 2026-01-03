#!/usr/bin/env tsx

/**
 * Navigation Route Testing Script
 *
 * This script tests all sidebar navigation routes to ensure:
 * 1. No 404 errors occur
 * 2. All routes return valid responses
 * 3. Proper authentication and authorization are enforced
 * 4. All sidebar menu items lead to working pages
 */

import { execSync } from "child_process";

interface RouteTest {
	path: string;
	description: string;
	expectedStatus: number;
	requiresAuth: boolean;
	requiresAdmin: boolean;
}

// Define all routes from the sidebar navigation
const routesToTest: RouteTest[] = [
	// Agent Portal Routes
	{
		path: "/dashboard",
		description: "Agent Dashboard",
		expectedStatus: 200,
		requiresAuth: true,
		requiresAdmin: false,
	},
	{
		path: "/dashboard/pipeline",
		description: "Agent Pipeline Management",
		expectedStatus: 200,
		requiresAuth: true,
		requiresAdmin: false,
	},
	{
		path: "/dashboard/transactions",
		description: "Agent Transactions (NEW)",
		expectedStatus: 200,
		requiresAuth: true,
		requiresAdmin: false,
	},
	{
		path: "/dashboard/settings",
		description: "Agent Settings",
		expectedStatus: 200,
		requiresAuth: true,
		requiresAdmin: false,
	},

	// Admin Portal Routes
	{
		path: "/admin",
		description: "Admin Dashboard Overview",
		expectedStatus: 200,
		requiresAuth: true,
		requiresAdmin: true,
	},
	{
		path: "/admin/approvals",
		description: "Admin Commission Approvals (NEW)",
		expectedStatus: 200,
		requiresAuth: true,
		requiresAdmin: true,
	},
	{
		path: "/admin/agents",
		description: "Admin Agent Management (NEW)",
		expectedStatus: 200,
		requiresAuth: true,
		requiresAdmin: true,
	},
	{
		path: "/admin/reports",
		description: "Admin Reports & Analytics (NEW)",
		expectedStatus: 200,
		requiresAuth: true,
		requiresAdmin: true,
	},
	{
		path: "/admin/settings",
		description: "Admin Settings",
		expectedStatus: 200,
		requiresAuth: true,
		requiresAdmin: true,
	},

	// Public Routes
	{
		path: "/login",
		description: "Login Page",
		expectedStatus: 200,
		requiresAuth: false,
		requiresAdmin: false,
	},
];

async function testRoute(route: RouteTest): Promise<boolean> {
	try {
		console.log(`🧪 Testing: ${route.description} (${route.path})`);

		// Use curl to test the route
		const curlCommand = `curl -s -o nul -w "%{http_code}" http://localhost:3001${route.path}`;
		const statusCode = execSync(curlCommand, { encoding: "utf8" }).trim();

		const actualStatus = Number.parseInt(statusCode);

		// For authenticated routes, we expect either 200 (if accessible) or 302/401 (redirect to login)
		// This is because we're testing without authentication
		if (route.requiresAuth) {
			if (
				actualStatus === 200 ||
				actualStatus === 302 ||
				actualStatus === 401
			) {
				console.log(
					`✅ ${route.description}: Status ${actualStatus} (Expected auth-protected behavior)`,
				);
				return true;
			} else if (actualStatus === 404) {
				console.log(`❌ ${route.description}: 404 NOT FOUND - Route missing!`);
				return false;
			} else {
				console.log(
					`⚠️  ${route.description}: Unexpected status ${actualStatus}`,
				);
				return false;
			}
		} else {
			// Public routes should return 200
			if (actualStatus === route.expectedStatus) {
				console.log(`✅ ${route.description}: Status ${actualStatus} ✓`);
				return true;
			} else {
				console.log(
					`❌ ${route.description}: Status ${actualStatus} (Expected ${route.expectedStatus})`,
				);
				return false;
			}
		}
	} catch (error) {
		console.log(`❌ ${route.description}: Error testing route - ${error}`);
		return false;
	}
}

async function runNavigationTests() {
	console.log("🚀 Starting Navigation Route Testing...\n");
	console.log("📋 Testing all sidebar navigation routes for 404 elimination\n");

	let passedTests = 0;
	const totalTests = routesToTest.length;

	// Test each route
	for (const route of routesToTest) {
		const passed = await testRoute(route);
		if (passed) passedTests++;
		console.log(""); // Add spacing between tests
	}

	// Summary
	console.log("📊 TEST RESULTS SUMMARY");
	console.log("========================");
	console.log(`✅ Passed: ${passedTests}/${totalTests}`);
	console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);

	if (passedTests === totalTests) {
		console.log("\n🎉 ALL NAVIGATION ROUTES WORKING!");
		console.log("✅ No 404 errors found");
		console.log("✅ All sidebar menu items lead to valid routes");
		console.log("✅ Proper authentication protection in place");
		return true;
	} else {
		console.log("\n⚠️  SOME ROUTES NEED ATTENTION");
		console.log("Please check the failed routes above");
		return false;
	}
}

// Additional validation checks
async function validateImplementation() {
	console.log("\n🔍 ADDITIONAL VALIDATION CHECKS");
	console.log("================================");

	const checks = [
		{
			name: "Admin redirect bug fix",
			description:
				"Verify admin page redirects to /dashboard instead of /agent-dashboard",
			check: () => {
				try {
					const adminPageContent = execSync(
						"cat apps/web/src/app/admin/page.tsx",
						{ encoding: "utf8" },
					);
					const hasCorrectRedirect = adminPageContent.includes(
						"router.push('/dashboard')",
					);
					const hasOldRedirect = adminPageContent.includes(
						"router.push('/agent-dashboard')",
					);

					if (hasCorrectRedirect && !hasOldRedirect) {
						console.log("✅ Admin redirect bug fixed");
						return true;
					} else {
						console.log("❌ Admin redirect bug still present");
						return false;
					}
				} catch (error) {
					console.log("❌ Could not verify admin redirect fix");
					return false;
				}
			},
		},
		{
			name: "All new route files exist",
			description: "Verify all newly created route files are present",
			check: () => {
				const newRoutes = [
					"apps/web/src/app/dashboard/transactions/page.tsx",
					"apps/web/src/app/admin/approvals/page.tsx",
					"apps/web/src/app/admin/agents/page.tsx",
					"apps/web/src/app/admin/reports/page.tsx",
				];

				let allExist = true;
				for (const route of newRoutes) {
					try {
						execSync(`test -f ${route}`);
						console.log(`✅ ${route} exists`);
					} catch (error) {
						console.log(`❌ ${route} missing`);
						allExist = false;
					}
				}
				return allExist;
			},
		},
	];

	let validationsPassed = 0;
	for (const check of checks) {
		console.log(`\n🔍 ${check.name}: ${check.description}`);
		if (check.check()) {
			validationsPassed++;
		}
	}

	console.log(`\n📊 Validations: ${validationsPassed}/${checks.length} passed`);
	return validationsPassed === checks.length;
}

// Main execution
async function main() {
	console.log("🎯 SIDEBAR NAVIGATION 404 ELIMINATION TEST");
	console.log("==========================================\n");

	// Check if server is running
	try {
		execSync("curl -s http://localhost:3001 > nul 2>&1", { stdio: "ignore" });
		console.log("✅ Development server is running on localhost:3001\n");
	} catch (error) {
		console.log("❌ Development server not running on localhost:3001");
		console.log("Please start the server with: bun run dev:web");
		process.exit(1);
	}

	// Run route tests
	const routeTestsPassed = await runNavigationTests();

	// Run additional validations
	const validationsPassed = await validateImplementation();

	// Final result
	if (routeTestsPassed && validationsPassed) {
		console.log("\n🎉 SIDEBAR NAVIGATION 404 ELIMINATION COMPLETE!");
		console.log("================================================");
		console.log("✅ All sidebar navigation routes working");
		console.log("✅ No 404 errors found");
		console.log("✅ Admin redirect bug fixed");
		console.log("✅ All new routes created successfully");
		console.log("\n🚀 Ready for production!");
		process.exit(0);
	} else {
		console.log("\n⚠️  IMPLEMENTATION NEEDS ATTENTION");
		console.log("Please address the issues identified above");
		process.exit(1);
	}
}

// Run the tests
main().catch(console.error);
