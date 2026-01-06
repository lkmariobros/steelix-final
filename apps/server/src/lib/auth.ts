import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import * as schema from "../db/schema/auth";
import { count, eq } from "drizzle-orm";

const isProduction = process.env.NODE_ENV === "production";
const isDevelopment = process.env.NODE_ENV !== "production";

// ✅ SECURITY: Only log non-sensitive info, and only in development
if (isDevelopment) {
	console.log("🔐 Initializing Better Auth...");
	console.log("🔧 Environment variables check:");
	console.log(`   - BETTER_AUTH_URL: ${process.env.BETTER_AUTH_URL || "[NOT SET]"}`);
	console.log(`   - BETTER_AUTH_SECRET: ${process.env.BETTER_AUTH_SECRET ? "[SET]" : "[NOT SET]"}`);
	console.log(`   - DATABASE_URL: ${process.env.DATABASE_URL ? "[SET]" : "[NOT SET]"}`);
	console.log(`   - NODE_ENV: ${process.env.NODE_ENV || "development"}`);
}

// ✅ SECURITY: Fail fast in production if auth secret is not configured
if (isProduction && !process.env.BETTER_AUTH_SECRET) {
	throw new Error("CRITICAL: BETTER_AUTH_SECRET environment variable is required in production!");
}

let auth: ReturnType<typeof betterAuth>;

try {
	if (isDevelopment) {
		console.log("🔧 Creating Better Auth instance...");
	}
	auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: schema,
	}),
	// ✅ CRITICAL FIX: baseURL should be the backend URL, not frontend
	baseURL: process.env.BETTER_AUTH_URL || "http://localhost:8080",
	// ✅ SECURITY: Use env secret in production, allow fallback only in development for local testing
	secret: process.env.BETTER_AUTH_SECRET || (isDevelopment ? "dev-secret-not-for-production" : ""),
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
	// ✅ BOOTSTRAP SOLUTION: Automatic admin role assignment for first user
	databaseHooks: {
		user: {
			create: {
				before: async (userData) => {
					try {
						// Check if any users exist in the database
						const [existingUsersCount] = await db
							.select({ count: count() })
							.from(schema.user);

						const isFirstUser = existingUsersCount.count === 0;

						// Assign role based on whether this is the first user
						const role = isFirstUser ? "admin" : "agent";

						// ✅ SECURITY: Only log in development, and redact PII
						if (isDevelopment) {
							console.log(`🔐 User creation: [REDACTED] - Role: ${role} (First user: ${isFirstUser})`);
						}

						return {
							data: {
								...userData,
								role: role,
							},
						};
					} catch (error) {
						console.error("❌ Error in user creation hook:", error instanceof Error ? error.message : "Unknown error");
						// Fallback to default role if there's an error
						return {
							data: {
								...userData,
								role: "agent",
							},
						};
					}
				},
				after: async (user) => {
					// Check if this user has admin role by querying the database
					try {
						const createdUser = await db
							.select({ role: schema.user.role })
							.from(schema.user)
							.where(eq(schema.user.id, user.id))
							.limit(1);

						// ✅ SECURITY: Only log in development, and redact PII
						if (isDevelopment) {
							console.log(`✅ User created successfully`);
							if (createdUser[0]?.role === "admin") {
								console.log("🎉 BOOTSTRAP COMPLETE: First admin user created!");
							}
						}
					} catch (error) {
						console.error("❌ Error checking user role after creation:", error instanceof Error ? error.message : "Unknown error");
					}
				},
			},
		},
	},
	// Temporarily remove expo plugin for production debugging
	// plugins: [expo()],
});

	if (isDevelopment) {
		console.log("✅ Better Auth initialized successfully");
	}
} catch (error) {
	// ✅ SECURITY: Error logging is acceptable for troubleshooting, but avoid exposing secrets
	console.error("❌ CRITICAL: Better Auth initialization failed");
	console.error("❌ Error:", error instanceof Error ? error.message : "Unknown error");

	// Only log detailed stack traces in development
	if (isDevelopment) {
		console.error("❌ Stack trace:", error instanceof Error ? error.stack : "No stack trace");
		console.error("❌ Environment debug:");
		console.error("   - NODE_ENV:", process.env.NODE_ENV);
		console.error("   - BETTER_AUTH_SECRET: [REDACTED]");
		console.error("   - DATABASE_URL: [REDACTED]");
		console.error("   - BETTER_AUTH_URL:", process.env.BETTER_AUTH_URL);
	}

	// ✅ SECURITY: In production, fail completely rather than running with a broken auth
	if (isProduction) {
		throw new Error("Auth initialization failed in production. Check server logs.");
	}

	// Create a fallback auth object to prevent server crashes (development only)
	auth = {
		handler: async () => {
			return new Response(JSON.stringify({
				error: "Auth not initialized",
				// ✅ SECURITY: Don't expose error details in response
				message: "Authentication service unavailable",
			}), {
				status: 500,
				headers: { "Content-Type": "application/json" }
			});
		},
		api: {
			getSession: async () => null
		}
	} as any;
}

export { auth };
