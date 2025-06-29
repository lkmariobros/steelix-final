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
	baseURL:
		process.env.BETTER_AUTH_URL ||
		process.env.CORS_ORIGIN?.split(',')[0] ||
		"http://localhost:3000",
	secret:
		process.env.BETTER_AUTH_SECRET ||
		"fallback-secret-key-change-in-production",
	trustedOrigins: [
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
		cookieCache: {
			enabled: true,
			maxAge: 60 * 60 * 24 * 7, // 7 days
		},
		cookieOptions: {
			sameSite: "none", // Allow cross-origin cookies
			secure: true, // Required for SameSite=None
			httpOnly: false, // Allow JavaScript access for cross-origin setup
			domain: undefined, // Don't set domain to allow cross-origin
		},
	},
	plugins: [expo()],
});
