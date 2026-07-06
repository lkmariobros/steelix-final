/**
 * Frontend origins allowed for CORS and Better Auth trustedOrigins.
 * Also set CORS_ORIGIN on Railway (comma-separated) for extra domains without redeploying.
 */
const DEFAULT_ALLOWED_ORIGINS = [
	"http://localhost:3000",
	"http://localhost:3001",
	"http://localhost:3002",
	"https://portal.devots.com.my",
	"https://steelix-final-web.vercel.app",
	"https://steelix-final-web-git-master-lkmariobros-projects.vercel.app",
	"https://steelix-final-mx4or73lk-lkmariobros-projects.vercel.app",
	"my-better-t-app://",
] as const;

export function getAllowedOrigins(): string[] {
	const fromEnv =
		process.env.CORS_ORIGIN?.split(",")
			.map((o) => o.trim())
			.filter(Boolean) ?? [];

	return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...fromEnv])];
}
