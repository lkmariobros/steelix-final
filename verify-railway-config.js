#!/usr/bin/env node

/**
 * Railway Configuration Verification Script
 *
 * This script verifies that your Railway backend is properly configured
 * to work with your Vercel frontend deployment.
 */

// URLs from your screenshots
const RAILWAY_BACKEND = "https://steelix-final-production.up.railway.app";
const VERCEL_FRONTEND_FEATURE =
	"https://steelix-final-web-git-feature-sideb-6d33df-lkmariobros-projects.vercel.app";
const VERCEL_FRONTEND_MAIN = "https://steelix-final-web.vercel.app";

console.log("🔍 RAILWAY CONFIGURATION VERIFICATION\n");
console.log(`Backend (Railway): ${RAILWAY_BACKEND}`);
console.log(`Frontend (Feature): ${VERCEL_FRONTEND_FEATURE}`);
console.log(`Frontend (Main): ${VERCEL_FRONTEND_MAIN}\n`);

async function verifyConfiguration() {
	const results = {
		backendHealth: false,
		authConfigCorrect: false,
		corsConfigCorrect: false,
		authEndpointsWorking: false,
		crossOriginWorking: false,
	};

	// Test 1: Backend Health
	console.log("1️⃣ Testing Railway Backend Health...");
	try {
		const response = await fetch(`${RAILWAY_BACKEND}/ping`);
		if (response.ok) {
			results.backendHealth = true;
			console.log("   ✅ Railway backend is healthy");
		} else {
			console.log(`   ❌ Backend responded with: ${response.status}`);
		}
	} catch (error) {
		console.log(`   ❌ Backend unreachable: ${error.message}`);
	}

	// Test 2: Auth Configuration Check
	console.log("\n2️⃣ Checking Auth Configuration...");
	try {
		const response = await fetch(`${RAILWAY_BACKEND}/debug/auth-config`);
		const config = await response.json();

		console.log(`   🔐 BETTER_AUTH_URL: ${config.betterAuthUrl}`);
		console.log(`   🌐 CORS Origins: ${JSON.stringify(config.corsOrigins)}`);
		console.log(`   🔑 Has Secret: ${config.hasSecret}`);
		console.log(`   🗄️ Has Database: ${config.hasDatabaseUrl}`);
		console.log(`   🌍 Environment: ${config.nodeEnv}`);

		// Verify BETTER_AUTH_URL is correct
		if (config.betterAuthUrl === RAILWAY_BACKEND) {
			console.log("   ✅ BETTER_AUTH_URL is correctly set to backend URL");
			results.authConfigCorrect = true;
		} else {
			console.log(
				`   ❌ BETTER_AUTH_URL should be ${RAILWAY_BACKEND}, but is ${config.betterAuthUrl}`,
			);
		}

		// Verify CORS origins include frontend URLs
		const corsOrigins = config.corsOrigins || [];
		const hasFeatureBranch = corsOrigins.some((origin) =>
			origin.includes("feature-sideb-6d33df"),
		);
		const hasMainDomain = corsOrigins.some((origin) =>
			origin.includes("steelix-final-web.vercel.app"),
		);

		if (hasFeatureBranch && hasMainDomain) {
			console.log(
				"   ✅ CORS origins include both feature branch and main domain",
			);
			results.corsConfigCorrect = true;
		} else {
			console.log("   ❌ CORS origins missing required frontend URLs:");
			console.log(`      Feature branch included: ${hasFeatureBranch}`);
			console.log(`      Main domain included: ${hasMainDomain}`);
		}
	} catch (error) {
		console.log(`   ❌ Auth config check failed: ${error.message}`);
	}

	// Test 3: Auth Endpoints from Feature Branch
	console.log("\n3️⃣ Testing Auth Endpoints from Feature Branch...");
	try {
		const response = await fetch(`${RAILWAY_BACKEND}/api/auth/get-session`, {
			method: "GET",
			headers: {
				Origin: VERCEL_FRONTEND_FEATURE,
				"Content-Type": "application/json",
			},
			credentials: "include",
		});

		console.log(`   Status: ${response.status} ${response.statusText}`);

		if (response.ok) {
			results.authEndpointsWorking = true;
			console.log("   ✅ Auth endpoints accessible from feature branch");
		} else {
			console.log("   ❌ Auth endpoints not accessible");
		}
	} catch (error) {
		console.log(`   ❌ Auth endpoint test failed: ${error.message}`);
	}

	// Test 4: CORS Preflight from Feature Branch
	console.log("\n4️⃣ Testing CORS from Feature Branch...");
	try {
		const response = await fetch(`${RAILWAY_BACKEND}/api/auth/sign-in/email`, {
			method: "OPTIONS",
			headers: {
				Origin: VERCEL_FRONTEND_FEATURE,
				"Access-Control-Request-Method": "POST",
				"Access-Control-Request-Headers": "Content-Type",
			},
		});

		console.log(`   Status: ${response.status} ${response.statusText}`);

		const corsHeaders = {
			"Access-Control-Allow-Origin": response.headers.get(
				"Access-Control-Allow-Origin",
			),
			"Access-Control-Allow-Credentials": response.headers.get(
				"Access-Control-Allow-Credentials",
			),
		};

		console.log(`   CORS Headers:`, corsHeaders);

		if (response.status === 204 && corsHeaders["Access-Control-Allow-Origin"]) {
			results.crossOriginWorking = true;
			console.log("   ✅ CORS working correctly from feature branch");
		} else {
			console.log("   ❌ CORS not working properly");
		}
	} catch (error) {
		console.log(`   ❌ CORS test failed: ${error.message}`);
	}

	// Summary
	console.log("\n📊 VERIFICATION RESULTS:");
	console.log("=".repeat(50));
	Object.entries(results).forEach(([key, value]) => {
		const status = value ? "✅" : "❌";
		console.log(`${status} ${key}: ${value}`);
	});

	// Recommendations
	console.log("\n🎯 RECOMMENDATIONS:");
	if (!results.authConfigCorrect) {
		console.log("❌ Fix BETTER_AUTH_URL in Railway:");
		console.log(`   Set to: ${RAILWAY_BACKEND}`);
	}

	if (!results.corsConfigCorrect) {
		console.log("❌ Fix CORS_ORIGIN in Railway:");
		console.log(
			`   Set to: ${VERCEL_FRONTEND_FEATURE},${VERCEL_FRONTEND_MAIN}`,
		);
	}

	if (results.authConfigCorrect && results.corsConfigCorrect) {
		console.log(
			"✅ Configuration looks good! Try signing in from your frontend.",
		);
	}

	const overallHealth = Object.values(results).filter(Boolean).length;
	console.log(`\n🏁 Overall Health: ${overallHealth}/5 checks passed`);

	return results;
}

// Run verification
verifyConfiguration()
	.then((results) => {
		const allPassed = Object.values(results).every(Boolean);
		process.exit(allPassed ? 0 : 1);
	})
	.catch((error) => {
		console.error("\n💥 Verification failed:", error);
		process.exit(1);
	});
