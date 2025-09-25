// import { expo } from "@better-auth/expo"; // Temporarily disabled for production debugging
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import * as schema from "../db/schema/auth";
// import { count, eq } from "drizzle-orm"; // Temporarily disabled with database hooks

console.log("🔐 Initializing Better Auth...");
console.log("🔧 Environment variables check:");
console.log(`   - BETTER_AUTH_URL: ${process.env.BETTER_AUTH_URL}`);
console.log(`   - BETTER_AUTH_SECRET: ${process.env.BETTER_AUTH_SECRET ? 'SET' : 'NOT SET'}`);
console.log(`   - DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
console.log(`   - NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`   - CORS_ORIGIN: ${process.env.CORS_ORIGIN}`);

let auth: ReturnType<typeof betterAuth>;

try {
	console.log("🔧 Creating Better Auth instance...");
	auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: schema,
	}),
	// ✅ CRITICAL FIX: baseURL should be the backend URL, not frontend
	baseURL: process.env.BETTER_AUTH_URL || "http://localhost:8080",
	secret:
		process.env.BETTER_AUTH_SECRET ||
		"fallback-secret-key-change-in-production",
	trustedOrigins: [
		// Frontend URLs that can make requests to this auth server
		...(process.env.CORS_ORIGIN?.split(',') || []),
		"https://steelix-final-web.vercel.app",
		"https://steelix-final-web-git-master-lkmariobros-projects.vercel.app",
		"https://steelix-final-mx4or73lk-lkmariobros-projects.vercel.app",
		"http://localhost:3000",
		"http://localhost:3001",
		"http://localhost:3002",
		"my-better-t-app://",
	],
	emailAndPassword: {
		enabled: true,
	},
	session: {
		expiresIn: 60 * 60 * 24 * 7, // 7 days
		updateAge: 60 * 60 * 24, // 1 day
		cookieCache: {
			enabled: true,
			maxAge: 60 * 60 * 24 * 7, // 7 days
		},
	},
	// ✅ CRITICAL FIX: Proper cross-origin cookie configuration with environment-based security
	advanced: {
		crossSubDomainCookies: {
			enabled: true,
			// Don't set domain for cross-origin (different domains)
			domain: undefined,
		},
		// Environment-dependent secure cookies: true in production, false in development
		useSecureCookies: (process.env.NODE_ENV || 'development') === 'production',
		cookies: {
			session_token: {
				name: "better-auth.session_token",
				attributes: {
					sameSite: (process.env.NODE_ENV || 'development') === 'production' ? "none" : "lax", // Fix for development
					secure: (process.env.NODE_ENV || 'development') === 'production', // Environment-dependent
					httpOnly: true, // Security best practice
					path: "/",
				},
			},
			session_data: {
				name: "better-auth.session_data",
				attributes: {
					sameSite: (process.env.NODE_ENV || 'development') === 'production' ? "none" : "lax", // Fix for development
					secure: (process.env.NODE_ENV || 'development') === 'production', // Environment-dependent
					// ✅ SECURITY IMPROVEMENT: Set httpOnly to true for XSS protection
					// Analysis shows no client-side access required - Better Auth React handles session internally
					httpOnly: true, // Enhanced security - no client-side cookie access needed
					path: "/",
				},
			},
		},
	},
	// ✅ TEMPORARILY DISABLED: Database hooks to debug 500 error
	// databaseHooks: {
	// 	user: {
	// 		create: {
	// 			before: async (userData) => {
	// 				try {
	// 					// Check if any users exist in the database
	// 					const [existingUsersCount] = await db
	// 						.select({ count: count() })
	// 						.from(schema.user);

	// 					const isFirstUser = existingUsersCount.count === 0;

	// 					// Assign role based on whether this is the first user
	// 					const role = isFirstUser ? "admin" : "agent";

	// 					console.log(`🔐 User creation: ${userData.email} - Role: ${role} (First user: ${isFirstUser})`);

	// 					return {
	// 						data: {
	// 							...userData,
	// 							role: role,
	// 						},
	// 					};
	// 				} catch (error) {
	// 					console.error("❌ Error in user creation hook:", error);
	// 					// Fallback to default role if there's an error
	// 					return {
	// 						data: {
	// 							...userData,
	// 							role: "agent",
	// 						},
	// 					};
	// 				}
	// 			},
	// 			after: async (user) => {
	// 				// Log successful user creation
	// 				console.log(`✅ User created successfully: ${user.email}`);

	// 				// Check if this user has admin role by querying the database
	// 				try {
	// 					const createdUser = await db
	// 						.select({ role: schema.user.role })
	// 						.from(schema.user)
	// 						.where(eq(schema.user.id, user.id))
	// 						.limit(1);

	// 					if (createdUser[0]?.role === "admin") {
	// 						console.log("🎉 BOOTSTRAP COMPLETE: First admin user created! Admin dashboard access enabled.");
	// 					}
	// 				} catch (error) {
	// 					console.error("❌ Error checking user role after creation:", error);
	// 				}
	// 			},
	// 		},
	// 	},
	// },
	// Temporarily remove expo plugin for production debugging
	// plugins: [expo()],
});

	console.log("✅ Better Auth initialized successfully");
	console.log("🔧 Auth object type:", typeof auth);
	console.log("🔧 Auth handler type:", typeof auth.handler);
} catch (error) {
	console.error("❌ CRITICAL: Better Auth initialization failed:", error);
	console.error("❌ Error details:", error instanceof Error ? error.message : String(error));
	console.error("❌ Stack trace:", error instanceof Error ? error.stack : 'No stack trace');

	// Create a fallback auth object to prevent server crashes
	auth = {
		handler: async () => {
			return new Response(JSON.stringify({ error: "Auth not initialized" }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		},
		api: {
			getSession: async () => null
		}
	} as any;
}

export { auth };
