/**
 * Helpers for Next.js API routes that proxy to the backend.
 *
 * Node fetch auto-decompresses gzip/br bodies but keeps Content-Encoding on the
 * Response — forwarding both causes ERR_CONTENT_DECODING_FAILED in the browser.
 */

const STRIP_RESPONSE_HEADERS = new Set([
	"content-encoding",
	"content-length",
	"transfer-encoding",
]);

/** Omit hop-by-hop / encoding headers; optional per-header override. */
export function appendProxyResponseHeaders(
	source: Headers,
	target: Headers,
	options?: {
		onHeader?: (
			key: string,
			value: string,
		) => "skip" | "default" | "append";
	},
) {
	source.forEach((value, key) => {
		const lower = key.toLowerCase();
		if (STRIP_RESPONSE_HEADERS.has(lower)) return;

		const action = options?.onHeader?.(key, value) ?? "default";
		if (action === "skip") return;
		if (action === "append") {
			target.append(key, value);
			return;
		}

		target.set(key, value);
	});
}

/** Read decompressed body and rebuild response without misleading encoding headers. */
export async function toProxyResponse(
	response: Response,
	options?: {
		onHeader?: (
			key: string,
			value: string,
		) => "skip" | "default" | "append";
		extraHeaders?: Record<string, string>;
	},
): Promise<Response> {
	const body = await response.arrayBuffer();
	const headers = new Headers();

	appendProxyResponseHeaders(response.headers, headers, options);

	if (options?.extraHeaders) {
		for (const [key, value] of Object.entries(options.extraHeaders)) {
			headers.set(key, value);
		}
	}

	return new Response(body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

/** Don't ask upstream for compression — we rebuild the response body anyway. */
export function stripAcceptEncoding(headers: Headers) {
	headers.delete("accept-encoding");
}
