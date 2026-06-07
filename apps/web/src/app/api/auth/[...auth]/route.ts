/**
 * Auth Proxy Route
 *
 * Proxies Better Auth requests to the backend as same-origin requests so
 * session cookies work on mobile and production (Vercel → Railway).
 */

export const runtime = "nodejs";

import {
	stripAcceptEncoding,
	toProxyResponse,
} from "@/lib/proxy-response";

const getBackendUrl = () => {
	if (process.env.NEXT_PUBLIC_SERVER_URL) {
		return process.env.NEXT_PUBLIC_SERVER_URL;
	}
	if (process.env.NODE_ENV === "production") {
		return "https://steelix-final-production.up.railway.app";
	}
	return "http://127.0.0.1:8080";
};

const BACKEND_URL = getBackendUrl();

function sanitizeCookieHeader(rawCookie: string | null) {
	if (!rawCookie) return null;
	const parts = rawCookie
		.split(";")
		.map((part) => part.trim())
		.filter(Boolean);
	const filtered = parts.filter((part) => {
		const [name] = part.split("=", 1);
		if (
			name === "better-auth.session_data" ||
			name === "__Secure-better-auth.session_data" ||
			name.startsWith("better-auth.session_data.") ||
			name.startsWith("__Secure-better-auth.session_data.")
		) {
			return false;
		}
		return true;
	});
	return filtered.length > 0 ? filtered.join("; ") : null;
}

function modifySetCookie(raw: string): string {
	return raw
		.replace(/;\s*SameSite=None/gi, "; SameSite=Lax")
		.replace(/;\s*Domain=[^;]+/gi, "");
}

function getSetCookies(response: Response): string[] {
	if (typeof response.headers.getSetCookie === "function") {
		return response.headers.getSetCookie();
	}
	const single = response.headers.get("set-cookie");
	return single ? [single] : [];
}

async function handler(request: Request) {
	const url = new URL(request.url);
	const authPath = url.pathname.replace("/api/auth/", "");
	const targetUrl = `${BACKEND_URL}/api/auth/${authPath}${url.search}`;
	const authPathLower = authPath.toLowerCase();
	const isFreshAuthAction =
		authPathLower.includes("sign-in") ||
		authPathLower.includes("signup") ||
		authPathLower.includes("sign-up") ||
		authPathLower.includes("register") ||
		authPathLower.includes("forget-password") ||
		authPathLower.includes("forgot-password") ||
		authPathLower.includes("reset-password");

	const headers = new Headers();
	request.headers.forEach((value, key) => {
		if (key.toLowerCase() !== "host") {
			headers.set(key, value);
		}
	});

	const cookies = sanitizeCookieHeader(request.headers.get("cookie"));
	if (cookies && !isFreshAuthAction) {
		headers.set("cookie", cookies);
	} else if (request.headers.get("cookie") && isFreshAuthAction) {
		headers.delete("cookie");
	}

	stripAcceptEncoding(headers);

	try {
		const response = await fetch(targetUrl, {
			method: request.method,
			headers,
			body:
				request.method !== "GET" && request.method !== "HEAD"
					? await request.text()
					: undefined,
			redirect: "manual",
		});

		const proxyResponse = await toProxyResponse(response, {
			onHeader: (key) =>
				key.toLowerCase() === "set-cookie" ? "skip" : "default",
			extraHeaders: {
				"Access-Control-Allow-Credentials": "true",
			},
		});

		const outHeaders = new Headers(proxyResponse.headers);
		for (const cookie of getSetCookies(response)) {
			outHeaders.append("Set-Cookie", modifySetCookie(cookie));
		}

		return new Response(proxyResponse.body, {
			status: proxyResponse.status,
			statusText: proxyResponse.statusText,
			headers: outHeaders,
		});
	} catch (error) {
		console.error("Auth proxy error:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		const errorDetails =
			error instanceof Error && "cause" in error ? String(error.cause) : "";

		if (
			errorMessage.includes("fetch failed") ||
			errorMessage.includes("EACCES") ||
			errorMessage.includes("ECONNREFUSED")
		) {
			return new Response(
				JSON.stringify({
					error: "Backend server not reachable",
					details: `Cannot connect to ${BACKEND_URL}. Please ensure the backend server is running.`,
				}),
				{ status: 502, headers: { "Content-Type": "application/json" } },
			);
		}

		return new Response(
			JSON.stringify({
				error: "Proxy error",
				details: errorMessage,
				cause: errorDetails,
			}),
			{ status: 502, headers: { "Content-Type": "application/json" } },
		);
	}
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;

export async function OPTIONS(request: Request) {
	return new Response(null, {
		status: 204,
		headers: {
			"Access-Control-Allow-Origin": request.headers.get("origin") || "*",
			"Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie",
			"Access-Control-Allow-Credentials": "true",
			"Access-Control-Max-Age": "86400",
		},
	});
}
