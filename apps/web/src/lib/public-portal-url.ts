/** Canonical public portal origin for shareable links (eRecruitment join URLs, etc.). */
export const DEFAULT_PORTAL_ORIGIN = "https://portal.devots.com.my";

/**
 * Origin used in links sent to external users (recruits, etc.).
 * Prefer NEXT_PUBLIC_PORTAL_URL; never share localhost/127.0.0.1.
 */
export function getPublicPortalOrigin(): string {
	const fromEnv = (
		process.env.NEXT_PUBLIC_PORTAL_URL ||
		process.env.NEXT_PUBLIC_APP_URL ||
		""
	).trim();
	if (fromEnv) {
		return fromEnv.replace(/\/$/, "");
	}

	if (typeof window !== "undefined") {
		const { origin } = window.location;
		if (/^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
			return DEFAULT_PORTAL_ORIGIN;
		}
		return origin.replace(/\/$/, "");
	}

	return DEFAULT_PORTAL_ORIGIN;
}

export function buildJoinUrl(token: string): string {
	return `${getPublicPortalOrigin()}/join/${token}`;
}
