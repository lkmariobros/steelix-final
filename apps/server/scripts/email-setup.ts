/**
 * Resend email setup helper.
 *
 *   bun run email:setup                 → add the domain (if missing) and print the DNS records + status
 *   bun run email:setup verify          → ask Resend to re-check the DNS records
 *   bun run email:setup test <email>    → send a real password-reset style test email
 *
 * Needs RESEND_API_KEY in apps/server/.env (a "Full access" key is required for the domain commands).
 */
import "dotenv/config";
import { passwordResetEmail, sendEmail } from "../src/services/mailer";

const API = "https://api.resend.com";
const REGION = "ap-northeast-1";

type DnsRecord = {
	record: string;
	name: string;
	type: string;
	value: string;
	priority?: number;
	ttl?: string;
	status: string;
};

type Domain = {
	id: string;
	name: string;
	status: string;
	region: string;
	records?: DnsRecord[];
};

const apiKey = process.env.RESEND_API_KEY?.trim();
const emailFrom = process.env.EMAIL_FROM?.trim() ?? "";
const domainName =
	process.env.EMAIL_DOMAIN?.trim() ||
	emailFrom.match(/@([^>\s]+)>?\s*$/)?.[1] ||
	"devots.com.my";

function fail(message: string): never {
	console.error(`\n✗ ${message}\n`);
	process.exit(1);
}

async function resend<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${API}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
			...(init?.headers ?? {}),
		},
	});
	const data = (await res.json().catch(() => null)) as T & { message?: string };
	if (!res.ok) {
		const hint =
			res.status === 401 || res.status === 403
				? " (domain commands need a Full access API key)"
				: "";
		fail(`Resend ${res.status}: ${data?.message ?? "request failed"}${hint}`);
	}
	return data;
}

async function findOrCreateDomain(): Promise<Domain> {
	const list = await resend<{ data: Domain[] }>("/domains");
	const existing = list.data.find((d) => d.name === domainName);
	if (existing) return resend<Domain>(`/domains/${existing.id}`);

	console.log(`Adding ${domainName} to Resend (region ${REGION})...`);
	return resend<Domain>("/domains", {
		method: "POST",
		body: JSON.stringify({ name: domainName, region: REGION }),
	});
}

function printDomain(domain: Domain) {
	const icon = domain.status === "verified" ? "✓" : "…";
	console.log(`\n${icon} Domain: ${domain.name}   Status: ${domain.status.toUpperCase()}   Region: ${domain.region}\n`);
	console.log("DNS records to add at the devots.com.my domain provider:\n");
	for (const [i, r] of (domain.records ?? []).entries()) {
		console.log(`${i + 1}. Type: ${r.type}`);
		console.log(`   Name/Host: ${r.name}`);
		console.log(`   Value:     ${r.value}`);
		if (r.priority != null) console.log(`   Priority:  ${r.priority}`);
		console.log(`   TTL:       ${r.ttl ?? "Auto"}   (current status: ${r.status})\n`);
	}
	if (domain.status !== "verified") {
		console.log("Recommended extra record (DMARC, improves inbox delivery):");
		console.log("   Type: TXT   Name/Host: _dmarc   Value: v=DMARC1; p=none;");
		console.log("   (skip if devots.com.my already has a _dmarc record)\n");
		console.log("After the records are added, run:  bun run email:setup verify\n");
	}
}

async function main() {
	const [command, arg] = process.argv.slice(2);
	if (!apiKey) fail("RESEND_API_KEY is not set in apps/server/.env");

	if (command === "test") {
		if (!arg?.includes("@")) fail("Usage: bun run email:setup test you@example.com");
		console.log(`Sending test email from "${emailFrom || "(default sender)"}" to ${arg}...`);
		const result = await sendEmail({
			to: arg,
			...passwordResetEmail({
				name: "Test",
				resetUrl: `${(process.env.PORTAL_URL || "https://portal.devots.com.my").replace(/\/$/, "")}/reset-password?token=test-only`,
				expiresInMinutes: 60,
			}),
		});
		if (!result.sent) fail(`Not sent: ${result.reason}`);
		console.log(`\n✓ Sent (id ${result.id}). Check the inbox and spam folder of ${arg}.\n`);
		return;
	}

	const domain = await findOrCreateDomain();

	if (command === "verify") {
		await resend(`/domains/${domain.id}/verify`, { method: "POST" });
		console.log("Verification requested. Checking status...");
		await new Promise((r) => setTimeout(r, 5000));
		printDomain(await resend<Domain>(`/domains/${domain.id}`));
		return;
	}

	printDomain(domain);
}

await main();
