/**
 * Kapso WhatsApp API Client
 * 
 * This module handles communication with the Kapso WhatsApp API
 * for sending and receiving messages.
 */

interface KapsoConfig {
	apiKey: string;
	apiUrl?: string; // Default: https://api.kapso.com
	webhookSecret?: string; // For verifying webhook signatures
}

interface SendMessageParams {
	to: string; // Phone number (e.g., +6591234567)
	message: string;
	contactId?: string; // Kapso contact ID if available
}

interface SendMessageResponse {
	success: boolean;
	messageId?: string;
	error?: string;
}

class KapsoClient {
	private apiKey: string;
	private apiUrl: string;
	private webhookSecret?: string;

	constructor(config: KapsoConfig) {
		this.apiKey = config.apiKey;
		this.apiUrl = config.apiUrl || "https://api.kapso.com";
		this.webhookSecret = config.webhookSecret;
	}

	/**
	 * Send a WhatsApp message via Kapso API
	 */
	async sendMessage(params: SendMessageParams): Promise<SendMessageResponse> {
		try {
			const url = `${this.apiUrl}/v1/messages`;
			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${this.apiKey}`,
				},
				body: JSON.stringify({
					to: params.to,
					message: params.message,
					contact_id: params.contactId,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return {
					success: false,
					error: errorData.message || `HTTP ${response.status}`,
				};
			}

			const data = await response.json();
			return {
				success: true,
				messageId: data.message_id || data.id,
			};
		} catch (error: any) {
			console.error("❌ Kapso sendMessage error:", error);
			return {
				success: false,
				error: error.message || "Failed to send message",
			};
		}
	}

	/**
	 * Verify webhook signature (if webhook secret is configured)
	 */
	verifyWebhookSignature(payload: string, signature: string): boolean {
		if (!this.webhookSecret) {
			// If no secret configured, skip verification (not recommended for production)
			return true;
		}

		// TODO: Implement signature verification based on Kapso's webhook security
		// This typically involves HMAC-SHA256 or similar
		// For now, we'll skip verification if secret is not set
		return true;
	}
}

// Create singleton instance
let kapsoClient: KapsoClient | null = null;

export function getKapsoClient(): KapsoClient | null {
	if (!kapsoClient) {
		const apiKey = process.env.KAPSO_API_KEY;
		if (!apiKey) {
			console.warn("⚠️ KAPSO_API_KEY not set. WhatsApp messaging will not work.");
			return null;
		}

		kapsoClient = new KapsoClient({
			apiKey,
			apiUrl: process.env.KAPSO_API_URL,
			webhookSecret: process.env.KAPSO_WEBHOOK_SECRET,
		});
	}

	return kapsoClient;
}

export { KapsoClient, type SendMessageParams, type SendMessageResponse };
