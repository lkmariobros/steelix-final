/**
 * Kapso WhatsApp API Client
 *
 * Matches Kapso docs:
 * baseUrl: https://api.kapso.ai/meta/whatsapp
 * Send: POST /v24.0/{phoneNumberId}/messages
 */

interface KapsoConfig {
	apiKey: string;
	apiUrl?: string; // Default: https://api.kapso.ai
	webhookSecret?: string;
	phoneNumberId?: string; // REQUIRED: Meta phone number ID (as shown in Kapso)
  }
  
  interface SendMessageParams {
	to: string; // E.164 format, e.g. +380972717597
	message: string;
	phoneNumberId?: string;
  }
  
  interface SendMessageResponse {
	success: boolean;
	messageId?: string;
	error?: string;
	raw?: any;
  }

  function toPreviewString(value: unknown, max = 50): string {
	if (value == null) return "";
	if (typeof value === "string") return value.slice(0, max);
	if (typeof value === "number" || typeof value === "boolean") return String(value).slice(0, max);
  
	// Common WhatsApp formats: { body: "..." } or { text: { body: "..." } }
	if (typeof value === "object") {
	  try {
		const v = value as any;
		const maybeBody = v?.body ?? v?.text?.body ?? v?.text ?? v?.message ?? v?.content;
		if (typeof maybeBody === "string") return maybeBody.slice(0, max);
		return JSON.stringify(value).slice(0, max);
	  } catch {
		return "[unserializable]";
	  }
	}
  
	return String(value).slice(0, max);
  }
  
  
  class KapsoClient {
	private apiKey: string;
	private apiUrl: string;
	private webhookSecret?: string;
	private phoneNumberId?: string;
  
	constructor(config: KapsoConfig) {
	  this.apiKey = config.apiKey;
	  this.apiUrl = (config.apiUrl || "https://api.kapso.ai").replace(/\/$/, "");
	  this.webhookSecret = config.webhookSecret;
	  this.phoneNumberId = config.phoneNumberId;
	}
  
	/**
	 * Send a WhatsApp text message via Kapso (Meta proxy)
	 * Docs imply:
	 * POST {apiUrl}/meta/whatsapp/v24.0/{phoneNumberId}/messages
	 */
	async sendMessage(params: SendMessageParams): Promise<SendMessageResponse> {
	  const phoneId = params.phoneNumberId || this.phoneNumberId;
  
	  if (!phoneId) {
		return {
		  success: false,
		  error:
			"phoneNumberId is required. Set KAPSO_PHONE_NUMBER_ID in .env (Meta phone number ID shown in Kapso).",
		};
	  }
  
	  // Kapso docs baseUrl ends with /meta/whatsapp
	  const baseMetaUrl = `${this.apiUrl}/meta/whatsapp`;
	  const url = `${baseMetaUrl}/v24.0/${encodeURIComponent(phoneId)}/messages`;
  
	  const body = {
		messaging_product: "whatsapp",
		to: params.to, // MUST be E.164 (+countrycode...)
		type: "text",
		text: { body: params.message },
	  };
  
	  console.log("📤 Kapso sendMessage:", {
		url,
		phoneId: phoneId.substring(0, 10) + "...",
		to: params.to,
		messageLength: params.message.length,
	  });
  
	  // Kapso typically uses X-API-Key (most consistent with “kapsoApiKey” in docs),
	  // but we can fall back to Authorization if needed.
	  const tryRequest = async (headers: Record<string, string>) => {
		const res = await fetch(url, {
		  method: "POST",
		  headers: {
			"Content-Type": "application/json",
			...headers,
		  },
		  body: JSON.stringify(body),
		});
  
		const text = await res.text();
		let data: any = {};
		try {
		  data = JSON.parse(text);
		} catch {
		  data = { raw: text };
		}
  
		return { res, data };
	  };
  
	  // 1) Try X-API-Key first (recommended)
	  let { res, data } = await tryRequest({ "X-API-Key": this.apiKey });
  
	  // 2) If auth style differs, try Bearer as fallback
	  if (res.status === 401 || res.status === 403) {
		({ res, data } = await tryRequest({ Authorization: `Bearer ${this.apiKey}` }));
	  }
  
	  if (!res.ok) {
		const msg =
		  data?.error?.message ||
		  data?.message ||
		  data?.error ||
		  `HTTP ${res.status}`;

		console.error("❌ Kapso API error response:", {
		  status: res.status,
		  statusText: res.statusText,
		  error: msg,
		  data: data,
		  url: url.substring(0, 100) + "...",
		});

		return {
		  success: false,
		  error: `Failed to send WhatsApp message: ${msg}`,
		  raw: data,
		};
	  }

	  // Check if response contains error indicators even if HTTP status is OK
	  if (data?.error || data?.errorMessage) {
		const errorMsg = data?.error?.message || data?.errorMessage || data?.error;
		console.error("❌ Kapso API returned error in response body:", {
		  error: errorMsg,
		  fullResponse: data,
		});
		return {
		  success: false,
		  error: `Kapso API error: ${errorMsg}`,
		  raw: data,
		};
	  }

	  // Meta-style response: { messages: [{ id: "..." }] }
	  const messageId =
		data?.messages?.[0]?.id ||
		data?.message_id ||
		data?.id ||
		data?.messageId;

	  console.log("✅ Kapso API success response:", {
		messageId: messageId || "none",
		hasMessagesArray: !!data?.messages,
		responseKeys: Object.keys(data || {}),
		status: res.status,
	  });

	  // Warn if no messageId is returned (might indicate issue)
	  if (!messageId) {
		console.warn("⚠️ Kapso API returned success but no messageId. Response:", data);
	  }

	  return {
		success: true,
		messageId,
		raw: data,
	  };
	}
  
	verifyWebhookSignature(_payload: string, _signature: string): boolean {
	  // Keep your existing behavior for now
	  // (Implement HMAC when you’re ready)
	  return true;
	}
  }
  
  // Singleton
  let kapsoClient: KapsoClient | null = null;
  
  export function getKapsoClient(): KapsoClient | null {
	if (!kapsoClient) {
	  const apiKey = process.env.KAPSO_API_KEY;
	  if (!apiKey) {
		console.warn("⚠️ KAPSO_API_KEY not set. WhatsApp messaging will not work.");
		return null;
	  }
  
	  const apiUrl = process.env.KAPSO_API_URL || "https://api.kapso.ai";
	  const phoneId = process.env.KAPSO_PHONE_NUMBER_ID;
  
	  console.log("📡 Kapso config:", {
		apiUrl,
		apiKeySet: true,
		apiKeyLength: apiKey.length,
		phoneNumberIdSet: !!phoneId,
		phoneNumberIdPreview: phoneId ? `${phoneId.substring(0, 8)}...` : "not set",
	  });
  
	  kapsoClient = new KapsoClient({
		apiKey,
		apiUrl,
		webhookSecret: process.env.KAPSO_WEBHOOK_SECRET,
		phoneNumberId: phoneId,
	  });
	}
  
	return kapsoClient;
  }
  
  export { KapsoClient, type SendMessageParams, type SendMessageResponse };
  