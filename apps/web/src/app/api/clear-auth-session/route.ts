import { NextResponse } from "next/server";

/**
 * Clears Better Auth cookies on this origin (Vercel / local).
 *
 * HTTP 431 on sign-in is usually oversized `Cookie` headers — often a stale
 * `better-auth.session_data` from when session cookie cache embedded a large
 * `user.image`. This route issues Max-Age=0 Set-Cookie headers so the next
 * request fits within platform limits (not a CORS issue).
 */
const HTTPS_COOKIE_NAMES = [
	"better-auth.session_token",
	"__Secure-better-auth.session_token",
	"better-auth.session_data",
	"__Secure-better-auth.session_data",
] as const;

const HTTP_COOKIE_NAMES = [
	"better-auth.session_token",
	"better-auth.session_data",
] as const;

export async function GET(request: Request) {
	const url = new URL(request.url);
	const isHttps = url.protocol === "https:";
	const login = new URL("/login", url.origin);
	login.searchParams.set("cleared", "1");
	const res = NextResponse.redirect(login);

	const names = isHttps ? HTTPS_COOKIE_NAMES : HTTP_COOKIE_NAMES;
	for (const name of names) {
		res.cookies.set(name, "", {
			path: "/",
			maxAge: 0,
			httpOnly: true,
			secure: name.startsWith("__Secure-") || isHttps,
			sameSite: isHttps ? "none" : "lax",
		});
	}

	return res;
}
