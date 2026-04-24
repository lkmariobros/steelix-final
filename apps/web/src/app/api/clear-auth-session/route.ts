import { NextResponse } from "next/server";

/**
 * Clears Better Auth cookies on this origin (Vercel / local).
 *
 * HTTP 431 on sign-in is usually oversized `Cookie` headers — often a stale
 * `better-auth.session_data` from when session cookie cache embedded a large
 * `user.image`. This route issues Max-Age=0 Set-Cookie headers so the next
 * request fits within platform limits (not a CORS issue).
 */
const BASE_COOKIE_NAMES = [
	"better-auth.session_token",
	"__Secure-better-auth.session_token",
	"better-auth.session_data",
	"__Secure-better-auth.session_data",
] as const;

function buildCookieNameCandidates() {
	const names = new Set<string>(BASE_COOKIE_NAMES);
	// Better Auth / proxy can leave chunked cookies when session_data gets large.
	// We clear common chunk suffix patterns as best effort.
	for (const base of BASE_COOKIE_NAMES) {
		for (let i = 0; i < 40; i += 1) {
			names.add(`${base}.${i}`);
		}
	}
	return [...names];
}

export async function GET(request: Request) {
	const url = new URL(request.url);
	const isHttps = url.protocol === "https:";
	const login = new URL("/login", url.origin);
	login.searchParams.set("cleared", "1");
	const res = NextResponse.redirect(login);

	const names = buildCookieNameCandidates();
	for (const name of names) {
		const secureRequired = name.startsWith("__Secure-");
		// Send multiple variants to maximize deletion across older cookie attributes.
		const variants = isHttps
			? [
					{ secure: true, sameSite: "none" as const },
					{ secure: true, sameSite: "lax" as const },
				]
			: [{ secure: false, sameSite: "lax" as const }];
		for (const variant of variants) {
			if (secureRequired && !variant.secure) continue;
			res.cookies.set(name, "", {
				path: "/",
				maxAge: 0,
				httpOnly: true,
				secure: variant.secure,
				sameSite: variant.sameSite,
			});
		}
	}

	return res;
}
