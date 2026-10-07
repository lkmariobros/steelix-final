const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "Devots Portal <onboarding@resend.dev>";

export type SendEmailInput = {
	to: string;
	subject: string;
	html: string;
	text: string;
};

export type SendEmailResult =
	| { sent: true; id?: string }
	| { sent: false; reason: string };

export function isEmailConfigured(): boolean {
	return Boolean(process.env.RESEND_API_KEY?.trim());
}

/**
 * Sends via Resend's HTTPS API. Railway blocks outbound SMTP on Free/Hobby plans,
 * so an HTTPS email API is required for the hosted backend.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
	const apiKey = process.env.RESEND_API_KEY?.trim();
	if (!apiKey) {
		return { sent: false, reason: "RESEND_API_KEY is not set" };
	}

	const from = process.env.EMAIL_FROM?.trim() || DEFAULT_FROM;

	try {
		const response = await fetch(RESEND_API_URL, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				from,
				to: [input.to],
				subject: input.subject,
				html: input.html,
				text: input.text,
			}),
			signal: AbortSignal.timeout(15_000),
		});

		const data = (await response.json().catch(() => null)) as {
			id?: string;
			message?: string;
			name?: string;
		} | null;

		if (!response.ok) {
			return {
				sent: false,
				reason: `Resend ${response.status}: ${data?.message ?? data?.name ?? "unknown error"}`,
			};
		}
		return { sent: true, id: data?.id };
	} catch (error) {
		return {
			sent: false,
			reason: error instanceof Error ? error.message : String(error),
		};
	}
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export function passwordResetEmail(params: {
	name: string | null;
	resetUrl: string;
	expiresInMinutes: number;
}): Omit<SendEmailInput, "to"> {
	const greeting = params.name?.trim() ? `Hi ${params.name.trim()},` : "Hi,";
	const url = escapeHtml(params.resetUrl);

	const text = [
		greeting,
		"",
		"We received a request to reset your Devots Portal password.",
		`Open this link to set a new password (valid for ${params.expiresInMinutes} minutes):`,
		params.resetUrl,
		"",
		"If you did not request this, you can ignore this email. Your password will not change.",
		"",
		"Devots Portal",
	].join("\n");

	const html = `<!doctype html>
<html>
<body style="margin:0;padding:24px;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
	<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
		<tr><td>
			<h2 style="margin:0 0 16px;font-size:20px;">Reset your password</h2>
			<p style="margin:0 0 12px;font-size:14px;line-height:1.6;">${escapeHtml(greeting)}</p>
			<p style="margin:0 0 20px;font-size:14px;line-height:1.6;">We received a request to reset your Devots Portal password. Click the button below to set a new password. This link is valid for ${params.expiresInMinutes} minutes.</p>
			<p style="margin:0 0 24px;">
				<a href="${url}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:bold;">Reset password</a>
			</p>
			<p style="margin:0 0 8px;font-size:12px;color:#6b7280;line-height:1.6;">If the button does not work, copy this link into your browser:</p>
			<p style="margin:0 0 20px;font-size:12px;word-break:break-all;"><a href="${url}" style="color:#0f766e;">${url}</a></p>
			<p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6;">If you did not request this, you can ignore this email. Your password will not change.</p>
		</td></tr>
	</table>
</body>
</html>`;

	return { subject: "Reset your Devots Portal password", html, text };
}
