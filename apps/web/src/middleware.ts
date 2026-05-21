import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const ADMIN_PATH_PREFIX = "/admin";

function getBackendBaseUrl(): string {
	if (process.env.NEXT_PUBLIC_SERVER_URL) {
		return process.env.NEXT_PUBLIC_SERVER_URL.replace(/\/$/, "");
	}
	if (process.env.NODE_ENV === "production") {
		return "https://steelix-final-production.up.railway.app";
	}
	return "http://127.0.0.1:8080";
}

type SessionPayload = {
	user?: { role?: string | null };
	session?: { user?: { role?: string | null } };
};

type MeRolePayload = {
	role?: string | null;
	hasAdminAccess?: boolean;
};

async function resolveAdminAccess(
	cookie: string,
): Promise<boolean> {
	const base = getBackendBaseUrl();

	const sessionRes = await fetch(`${base}/api/auth/get-session`, {
		headers: { cookie },
		cache: "no-store",
	});

	if (!sessionRes.ok) return false;

	const sessionData = (await sessionRes.json()) as SessionPayload | null;
	const sessionRole =
		sessionData?.user?.role ?? sessionData?.session?.user?.role;
	if (sessionRole === "admin") return true;
	if (sessionRole && sessionRole !== "admin") return false;

	const roleRes = await fetch(`${base}/api/auth/me-role`, {
		headers: { cookie },
		cache: "no-store",
	});

	if (!roleRes.ok) return false;

	const roleData = (await roleRes.json()) as MeRolePayload;
	return roleData.hasAdminAccess === true || roleData.role === "admin";
}

/**
 * Server-side guard for /admin/* — blocks agents before the page shell renders.
 */
export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;
	if (!pathname.startsWith(ADMIN_PATH_PREFIX)) {
		return NextResponse.next();
	}

	const cookie = request.headers.get("cookie");
	if (!cookie) {
		return NextResponse.redirect(new URL("/login", request.url));
	}

	try {
		const isAdmin = await resolveAdminAccess(cookie);
		if (!isAdmin) {
			return NextResponse.redirect(new URL("/dashboard", request.url));
		}
	} catch {
		return NextResponse.redirect(new URL("/login", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/admin/:path*"],
};
