/**
 * Auto-Reply Rule Execution Engine
 * 
 * This module processes incoming messages and executes matching auto-reply rules.
 */

import { db } from "../db";
import { autoReplyRules } from "../db/schema/auto-reply";
import { eq, and } from "drizzle-orm";
import { getKapsoClient } from "./kapso";

interface MessageToProcess {
	content: string;
	conversationId: string;
	contactPhone: string;
	agentId?: string; // Agent who owns the conversation
}

interface AutoReplyResult {
	matched: boolean;
	ruleId?: string;
	response?: string;
	error?: string;
}

/**
 * Check if a message matches a trigger rule
 */
function matchesTrigger(
	message: string,
	trigger: { type: string; keywords: string[] },
): boolean {
	const lowerMessage = message.toLowerCase();

	switch (trigger.type) {
		case "contains":
			return trigger.keywords.some((keyword) =>
				lowerMessage.includes(keyword.toLowerCase()),
			);
		case "equals":
			return trigger.keywords.some(
				(keyword) => lowerMessage === keyword.toLowerCase(),
			);
		case "starts_with":
			return trigger.keywords.some((keyword) =>
				lowerMessage.startsWith(keyword.toLowerCase()),
			);
		case "regex":
			// For regex, try to match any of the keywords as regex patterns
			return trigger.keywords.some((pattern) => {
				try {
					const regex = new RegExp(pattern, "i");
					return regex.test(message);
				} catch {
					// Invalid regex, treat as literal string
					return lowerMessage.includes(pattern.toLowerCase());
				}
			});
		default:
			return false;
	}
}

/**
 * Find and execute matching auto-reply rules for a message
 */
export async function processAutoReply(
	message: MessageToProcess,
): Promise<AutoReplyResult> {
	try {
		// Get all active auto-reply rules for the agent (or all rules if no agent)
		const conditions = [];
		if (message.agentId) {
			conditions.push(eq(autoReplyRules.agentId, message.agentId));
		}

		const rules = await db
			.select()
			.from(autoReplyRules)
			.where(conditions.length > 0 ? and(...conditions) : undefined);

		// Find the first matching rule
		for (const rule of rules) {
			const trigger = rule.trigger as {
				type: string;
				keywords: string[];
			};

			if (matchesTrigger(message.content, trigger)) {
				// Found a match! Send the auto-reply
				const kapsoClient = getKapsoClient();
				if (!kapsoClient) {
					return {
						matched: true,
						ruleId: rule.id,
						response: rule.response,
						error: "Kapso client not configured",
					};
				}

				// Send the auto-reply message
				const sendResult = await kapsoClient.sendMessage({
					to: message.contactPhone,
					message: rule.response,
				});

				if (!sendResult.success) {
					return {
						matched: true,
						ruleId: rule.id,
						response: rule.response,
						error: sendResult.error || "Failed to send auto-reply",
					};
				}

				// Update log count
				await db
					.update(autoReplyRules)
					.set({ logCount: rule.logCount + 1 })
					.where(eq(autoReplyRules.id, rule.id));

				return {
					matched: true,
					ruleId: rule.id,
					response: rule.response,
				};
			}
		}

		// No matching rule found
		return { matched: false };
	} catch (error: any) {
		console.error("❌ Auto-reply processing error:", error);
		return {
			matched: false,
			error: error.message || "Failed to process auto-reply",
		};
	}
}
