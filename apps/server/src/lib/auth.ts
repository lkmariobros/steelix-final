import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import * as schema from "../db/schema/auth";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: schema,
	}),
	// ✅ CRITICAL FIX: baseURL should be the backend URL, not frontend
	baseURL:
		process.env.BETTER_AUTH_URL ||
		"https://steelix-final-production.up.railway.app",
	secret:
		process.env.BETTER_AUTH_SECRET ||
		"fallback-secret-key-change-in-production",
	trustedOrigins: [
		// Frontend URLs that can make requests to this auth server
		...(process.env.CORS_ORIGIN?.split(',') || []),
		"https://steelix-final-web.vercel.app",
		"https://steelix-final-web-git-master-lkmariobros-projects.vercel.app",
		"https://steelix-final-mx4or73lk-lkmariobros-projects.vercel.app",
		"http://localhost:3001",
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
	// ✅ CRITICAL FIX: Proper cross-origin cookie configuration
	advanced: {
		crossSubDomainCookies: {
			enabled: true,
			// Don't set domain for cross-origin (different domains)
			domain: undefined,
		},
		useSecureCookies: true, // Always use secure cookies in production
		cookies: {
			session_token: {
				name: "better-auth.session_token",
				attributes: {
					sameSite: "none", // Required for cross-origin
					secure: true, // Required for sameSite=none
					httpOnly: true, // Security best practice
					path: "/",
				},
			},
			session_data: {
				name: "better-auth.session_data",
				attributes: {
					sameSite: "none",
					secure: true,
					httpOnly: false, // Allow client-side access for session data
					path: "/",
				},
			},
		},
	},
	plugins: [expo()],
});
