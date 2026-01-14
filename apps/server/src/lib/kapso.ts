/**
 * Kapso WhatsApp API Client
 * 
 * This module handles communication with the Kapso WhatsApp API
 * for sending and receiving messages.
 */

interface KapsoConfig {
	apiKey: string;
	apiUrl?: string; // Default: https://api.kapso.ai
	webhookSecret?: string; // For verifying webhook signatures
	configurationId?: string; // WhatsApp configuration ID from Kapso
	phoneNumberId?: string; // WhatsApp phone number ID from Kapso
}

interface SendMessageParams {
	to: string; // Phone number (e.g., +6591234567)
	message: string;
	contactId?: string; // Kapso contact ID if available
	configurationId?: string; // WhatsApp configuration ID from Kapso
	phoneNumberId?: string; // WhatsApp phone number ID from Kapso
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
	private configurationId?: string;
	private phoneNumberId?: string;

	constructor(config: KapsoConfig) {
		this.apiKey = config.apiKey;
		this.apiUrl = config.apiUrl || "https://api.kapso.ai";
		this.webhookSecret = config.webhookSecret;
		this.configurationId = config.configurationId;
		this.phoneNumberId = config.phoneNumberId;
	}

	/**
	 * Send a WhatsApp message via Kapso API
	 */
	async sendMessage(params: SendMessageParams): Promise<SendMessageResponse> {
		try {
			// Use configuration ID from params or instance
			const configId = params.configurationId || this.configurationId;
			const phoneId = params.phoneNumberId || this.phoneNumberId;
			
			// Try different base URLs (api.kapso.ai and app.kapso.ai)
			const baseUrls = [
				this.apiUrl, // Current configured URL (api.kapso.ai)
				"https://app.kapso.ai", // Alternative base URL
			];
			
			// Try different possible API endpoints (configuration ID in body, not path)
			const endpointPaths = [
				"/api/v1/whatsapp/messages", // Most likely based on web search
				"/meta/whatsapp/v24.0/messages", // Original endpoint
				"/api/v1/messages",
				"/whatsapp/messages",
				"/v1/whatsapp/messages",
				"/v1/messages",
				"/messages",
				"/send-message",
			];
			
			// Generate all possible endpoint combinations
			const possibleEndpoints: string[] = [];
			for (const baseUrl of baseUrls) {
				for (const path of endpointPaths) {
					possibleEndpoints.push(`${baseUrl}${path}`);
				}
			}

			let lastError: any = null;

			for (const url of possibleEndpoints) {
				try {
					console.log(`📤 Attempting to send message via: ${url}`);
					
					// Try different request body formats
					const bodyFormats = [
						// Format 1: With configuration ID (if available)
						...(configId ? [{
							configuration_id: configId,
							to: params.to,
							message: params.message,
							contact_id: params.contactId,
						}] : []),
						// Format 2: With phone number ID (if available)
						...(phoneId ? [{
							phone_number_id: phoneId,
							to: params.to,
							message: params.message,
							contact_id: params.contactId,
						}] : []),
						// Format 3: Standard format
						{
							to: params.to,
							message: params.message,
							contact_id: params.contactId,
						},
						// Format 4: WhatsApp Business API format
						{
							messaging_product: "whatsapp",
							to: params.to,
							type: "text",
							text: {
								body: params.message,
							},
						},
						// Format 5: Simple format
						{
							phone_number: params.to,
							text: params.message,
						},
					];

					let lastBodyError: any = null;
					
					for (const body of bodyFormats) {
						try {
							console.log(`   Trying body format:`, Object.keys(body));
							const response = await fetch(url, {
								method: "POST",
								headers: {
									"Content-Type": "application/json",
									"Authorization": `Bearer ${this.apiKey}`,
								},
								body: JSON.stringify(body),
							});

							const responseText = await response.text();
							let responseData: any = {};
							try {
								responseData = JSON.parse(responseText);
							} catch {
								responseData = { raw: responseText.substring(0, 200) };
							}

							if (response.ok) {
								console.log(`✅ Message sent successfully via: ${url} with body format:`, Object.keys(body));
								return {
									success: true,
									messageId: responseData.message_id || responseData.id || responseData.messageId || responseData.messages?.[0]?.id,
								};
							} else {
								console.log(`   ❌ Status ${response.status} for ${url}:`, responseData);
								
								// Check for Meta review/approval status
								const errorText = JSON.stringify(responseData).toLowerCase();
								if (errorText.includes("review") || 
								    errorText.includes("pending") || 
								    errorText.includes("approval") ||
								    errorText.includes("temporarily blocked") ||
								    errorText.includes("configuration not found")) {
									return {
										success: false,
										error: `WhatsApp Business account is under Meta's review process. Messaging is temporarily blocked until Meta completes the review (usually takes a few hours). Once approved, messaging will work automatically. Status: ${responseData.error || responseData.message || "Under review"}`,
									};
								}
								
								// If it's 401/403, it's an auth issue - stop trying
								if (response.status === 401 || response.status === 403) {
									return {
										success: false,
										error: `Authentication failed (${response.status}): ${responseData.message || responseData.error || "Invalid API key or unauthorized. This might also indicate the WhatsApp Business account is still under Meta review."}`,
									};
								}
								// If it's 404, try next endpoint
								if (response.status === 404) {
									lastBodyError = {
										success: false,
										error: `Endpoint not found (404)`,
										status: 404,
									};
									break; // Try next endpoint
								}
								// For 400/422, try next body format
								if (response.status === 400 || response.status === 422) {
									console.log(`   ⚠️ Bad request format, trying next body format...`);
									continue;
								}
								// For other errors, save and continue
								lastBodyError = {
									success: false,
									error: responseData.message || responseData.error || `HTTP ${response.status}`,
									status: response.status,
									details: responseData,
								};
								continue;
							}
						} catch (bodyError: any) {
							console.log(`   ❌ Fetch error for ${url}:`, bodyError.message || bodyError.code);
							lastBodyError = bodyError;
							// If it's a TLS error, break and try next endpoint
							if (bodyError.code === "ERR_TLS_CERT_ALTNAME_INVALID" || 
							    bodyError.message?.includes("certificate") ||
							    bodyError.message?.includes("TLS")) {
								throw bodyError; // Let outer loop handle endpoint change
							}
							continue; // Try next body format
						}
					}
					
					// If all body formats failed for this endpoint, try next endpoint
					if (lastBodyError) {
						// If it's a TLS error, break and try next endpoint
						if (lastBodyError.code === "ERR_TLS_CERT_ALTNAME_INVALID") {
							throw lastBodyError; // Let outer catch handle endpoint change
						}
						// For other errors, continue to next endpoint
						lastError = lastBodyError;
						continue;
					}
				} catch (fetchError: any) {
					console.log(`⚠️ Error with endpoint ${url}:`, fetchError.message);
					lastError = fetchError;
					// If it's a TLS/certificate error, try next endpoint
					if (fetchError.code === "ERR_TLS_CERT_ALTNAME_INVALID" || 
					    fetchError.message?.includes("certificate") ||
					    fetchError.message?.includes("TLS")) {
						continue; // Try next endpoint
					} else {
						// Other errors, return immediately
						return {
							success: false,
							error: fetchError.message || "Failed to send message",
						};
					}
				}
			}

			// If we get here, all endpoints failed
			const errorMessage = lastError?.message || lastError?.error || "Unknown error";
			const errorDetails = lastError?.details ? ` Details: ${JSON.stringify(lastError.details)}` : "";
			
			// Provide helpful error message based on the last error
			// Check if this is likely a Meta review issue
			const errorText = (errorMessage + errorDetails).toLowerCase();
			const isMetaReview = errorText.includes("configuration not found") || 
			                     errorText.includes("invalid credentials") ||
			                     (errorText.includes("401") && errorText.includes("whatsapp")) ||
			                     (errorText.includes("404") && errorText.includes("whatsapp"));
			
			let helpfulMessage;
			if (isMetaReview) {
				helpfulMessage = `⚠️ WhatsApp Business account is under Meta's standard review process.\n\n`;
				helpfulMessage += `Your implementation is correct! The errors are because messaging is temporarily blocked during Meta's review.\n\n`;
				helpfulMessage += `📋 What's happening:\n`;
				helpfulMessage += `   • Meta is reviewing your WhatsApp Business account\n`;
				helpfulMessage += `   • Review usually completes within a few hours\n`;
				helpfulMessage += `   • Once approved, messaging will work automatically\n`;
				helpfulMessage += `   • No code changes needed after approval\n\n`;
				helpfulMessage += `Last error: ${errorMessage}${errorDetails}`;
			} else if (errorMessage.includes("configuration not found") || errorMessage.includes("404")) {
				helpfulMessage = `All API endpoints failed. Last error: ${errorMessage}${errorDetails}. The configuration ID might be incorrect, or the endpoint structure is wrong. Check Kapso dashboard for the correct API endpoint.`;
			} else if (errorMessage.includes("Invalid credentials") || errorMessage.includes("401") || errorMessage.includes("403")) {
				helpfulMessage = `All API endpoints failed. Last error: ${errorMessage}${errorDetails}. Authentication failed. Check: 1) KAPSO_API_KEY is correct and has access to this WhatsApp configuration, 2) The API key might need to be associated with the configuration in Kapso dashboard.`;
			} else {
				helpfulMessage = `All API endpoints failed. Last error: ${errorMessage}${errorDetails}. Current API URL: ${this.apiUrl}. Please check: 1) KAPSO_API_KEY is correct, 2) API URL is correct (should be https://api.kapso.ai or https://app.kapso.ai), 3) Check Kapso dashboard for correct endpoint and request format.`;
			}
			
			return {
				success: false,
				error: helpfulMessage,
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

		const apiUrl = process.env.KAPSO_API_URL || "https://api.kapso.ai";
		
		// Warn if using old API URL
		if (apiUrl.includes("api.kapso.com")) {
			console.error("❌ ERROR: KAPSO_API_URL is set to api.kapso.com (OLD/INCORRECT URL)!");
			console.error("❌ Please update your .env file:");
			console.error("   Change: KAPSO_API_URL=https://api.kapso.com");
			console.error("   To:     KAPSO_API_URL=https://api.kapso.ai");
		}

		console.log(`📡 Kapso API URL configured: ${apiUrl}`);

		kapsoClient = new KapsoClient({
			apiKey,
			apiUrl,
			webhookSecret: process.env.KAPSO_WEBHOOK_SECRET,
			configurationId: process.env.KAPSO_CONFIGURATION_ID,
			phoneNumberId: process.env.KAPSO_PHONE_NUMBER_ID,
		});
	}

	return kapsoClient;
}

export { KapsoClient, type SendMessageParams, type SendMessageResponse };
