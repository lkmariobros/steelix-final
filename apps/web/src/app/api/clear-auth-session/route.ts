import { NextResponse } from "next/server";

const BASE_COOKIE_NAMES = [
	"steelix.session_token",
	"__Secure-steelix.session_token",
] as const;

export async function GET(request: Request) {
	const url = new URL(request.url);
	const isHttps = url.protocol === "https:";
	const login = new URL("/login", url.origin);
	login.searchParams.set("cleared", "1");
	const res = NextResponse.redirect(login);

	for (const name of BASE_COOKIE_NAMES) {
		res.cookies.set(name, "", {
			path: "/",
			maxAge: 0,
			httpOnly: true,
			secure: isHttps,
			sameSite: "lax",
		});
	}

	return res;
}
