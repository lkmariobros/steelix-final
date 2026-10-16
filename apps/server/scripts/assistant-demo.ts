/**
 * Demo data for the Devots Assistant.
 *
 *   bun run assistant:demo create-agent <email>   → create an active "Demo Agent" login (same rows as sign-up + approval) and print its password
 *   bun run assistant:demo seed <agent-email>     → (re)create [DEMO] leads, tasks and calendar events for that agent
 *   bun run assistant:demo check <agent-email>    → print what the assistant answers for each quick button (read-only)
 *   bun run assistant:demo cleanup <agent-email>  → delete everything the seed created
 *   bun run assistant:demo retire-agent <email>   → cleanup, then deactivate the demo login
 *
 * Safety: only runs for an agent whose name contains "Demo", and only touches rows labelled "[DEMO]".
 * Calendar events are assigned to the demo agent only, so real agents never see them.
 * The demo agent gets no agent code, so the real agent-code sequence is untouched.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { and, eq, like, sql } from "drizzle-orm";
import { account, user } from "../src/models/auth";
import { calendarEvents } from "../src/models/calendar";
import { prospects } from "../src/models/crm";
import { buildAssistantAnswer } from "../src/services/assistant";
import { db, pool } from "../src/utils/db";
import { startOfMalaysiaDay } from "../src/utils/malaysia-time";
import { hashPassword } from "../src/utils/password";

const LABEL = "[DEMO]";
const HOUR_MS = 60 * 60 * 1000;

/** Malaysia-time instant: `dayOffset` days from today at `hour`:`minute`. */
function myTime(dayOffset: number, hour: number, minute = 0): Date {
	return new Date(
		startOfMalaysiaDay(new Date(), dayOffset).getTime() +
			hour * HOUR_MS +
			minute * 60 * 1000,
	);
}

async function findDemoAgent(email: string) {
	const rows = await db
		.select({ id: user.id, name: user.name, email: user.email })
		.from(user)
		.where(eq(user.email, email.trim().toLowerCase()));
	if (rows.length === 0) throw new Error(`No user with email ${email}`);
	if (rows.length > 1) throw new Error(`More than one account uses ${email}; use a unique demo email`);
	const agent = rows[0];
	if (!agent || !/demo/i.test(agent.name)) {
		throw new Error(
			`Refusing: "${agent?.name}" does not look like a demo account (name must contain "Demo")`,
		);
	}
	return agent;
}

async function createAgent(email: string) {
	const normalized = email.trim().toLowerCase();
	const [existing] = await db
		.select({ id: user.id })
		.from(user)
		.where(sql`lower(${user.email}) = ${normalized}`)
		.limit(1);
	if (existing) throw new Error(`An account with ${normalized} already exists`);

	const password = `Demo-${randomBytes(6).toString("base64url")}`;
	const now = new Date();
	const userId = crypto.randomUUID();
	await db.insert(user).values({
		id: userId,
		name: "Demo Agent",
		email: normalized,
		emailVerified: false,
		image: null,
		isActive: true,
		role: "agent",
		agentStatus: "active",
		createdAt: now,
		updatedAt: now,
	});
	await db.insert(account).values({
		id: crypto.randomUUID(),
		accountId: normalized,
		providerId: "credential",
		userId,
		password: await hashPassword(password),
		createdAt: now,
		updatedAt: now,
	});
	console.log(`✅ Created "Demo Agent" <${normalized}>`);
	console.log(`🔑 Password (shown once, save it now): ${password}`);
}

async function retireAgent(agentId: string) {
	await cleanup(agentId);
	await db
		.update(user)
		.set({ isActive: false, agentStatus: "inactive", deactivatedAt: new Date(), updatedAt: new Date() })
		.where(eq(user.id, agentId));
	console.log("🔒 Demo login deactivated");
}

async function cleanup(agentId: string) {
	const demoLeads = await db
		.select({ id: prospects.id })
		.from(prospects)
		.where(and(eq(prospects.agentId, agentId), like(prospects.name, `${LABEL}%`)));
	const leadIds = demoLeads.map((l) => l.id);
	let tasks = 0;
	if (leadIds.length > 0) {
		const res = await pool.query(
			"DELETE FROM public.lead_tasks WHERE prospect_id = ANY($1::uuid[])",
			[leadIds],
		);
		tasks = res.rowCount ?? 0;
		await db
			.delete(prospects)
			.where(and(eq(prospects.agentId, agentId), like(prospects.name, `${LABEL}%`)));
	}
	const events = await db
		.delete(calendarEvents)
		.where(and(eq(calendarEvents.createdBy, agentId), like(calendarEvents.title, `${LABEL}%`)))
		.returning({ id: calendarEvents.id });
	console.log(`🧹 Removed ${leadIds.length} demo leads, ${tasks} tasks, ${events.length} calendar events`);
}

async function seed(agentId: string) {
	await cleanup(agentId);

	const leadDefs = [
		{ key: "buyer", name: `${LABEL} Sample buyer`, type: "buyer" as const, stage: "first_follow_up" as const },
		{ key: "client", name: `${LABEL} Sample client`, type: "buyer" as const, stage: "potential_lead" as const },
		{ key: "tenant", name: `${LABEL} Sample tenant`, type: "tenant" as const, stage: "appointment_made" as const },
	];
	const leadIds: Record<string, string> = {};
	for (const def of leadDefs) {
		const [row] = await db
			.insert(prospects)
			.values({
				name: def.name,
				phone: "",
				whatsappUsername: `demo_${def.key}`,
				source: "Demo",
				type: def.type,
				property: "Sample project",
				status: "active",
				stage: def.stage,
				leadType: "personal",
				notes: "Demo data for the assistant. Safe to delete.",
				agentId,
			})
			.returning({ id: prospects.id });
		if (!row) throw new Error(`Failed to create ${def.name}`);
		leadIds[def.key] = row.id;
	}

	const taskDefs = [
		{ lead: "buyer", title: "Follow up — Sample buyer", type: "follow_up", priority: "high", due: myTime(-1, 16) },
		{ lead: "client", title: "Send latest project updates", type: "email", priority: "normal", due: myTime(0, 15) },
		{ lead: "tenant", title: "Call back about viewing time", type: "call", priority: "urgent", due: myTime(0, 18) },
		{ lead: "buyer", title: "Prepare comparison of 3 units", type: "other", priority: "normal", due: myTime(1, 11) },
		{ lead: "client", title: "Confirm booking documents", type: "follow_up", priority: "high", due: myTime(2, 10) },
		{ lead: "tenant", title: "Monthly check-in", type: "call", priority: "low", due: myTime(5, 10) },
	];
	for (const t of taskDefs) {
		await pool.query(
			`INSERT INTO public.lead_tasks
        (prospect_id, title, task_type, priority, due_date, assigned_to, created_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $6, $7)`,
			[leadIds[t.lead], t.title, t.type, t.priority, t.due, agentId, "Demo data"],
		);
	}

	await db.insert(calendarEvents).values([
		{
			title: `${LABEL} Team meeting`,
			description: "Weekly team sync (demo)",
			eventType: "meeting",
			startDate: myTime(0, 17),
			endDate: myTime(0, 18),
			location: "Office",
			createdBy: agentId,
			assignedToAgentId: agentId,
		},
		{
			title: `${LABEL} Property viewing — Sample project`,
			description: "Viewing with Sample buyer (demo)",
			eventType: "other",
			startDate: myTime(1, 15),
			endDate: myTime(1, 16),
			location: "Sample project, Unit A-12",
			createdBy: agentId,
			assignedToAgentId: agentId,
		},
	]);

	console.log(
		`🌱 Created ${leadDefs.length} demo leads, ${taskDefs.length} tasks (1 overdue, 2 today, 1 tomorrow, 1 in 2 days, 1 in 5 days) and 2 calendar events`,
	);
}

async function check(agentId: string) {
	for (const intent of ["today", "upcoming", "overdue", "urgent"] as const) {
		const answer = await buildAssistantAnswer(agentId, { intent, source: "button" });
		console.log(`\n▶ ${intent}: ${answer.summary}`);
		for (const group of answer.groups) {
			console.log(`  ${group.label} (${group.items.length})`);
			for (const item of group.items) {
				console.log(
					`    - [${item.kind}] ${item.title} · ${item.timeLabel}${item.priority ? ` · ${item.priority}` : ""}`,
				);
			}
		}
	}
}

const COMMANDS = ["create-agent", "seed", "check", "cleanup", "retire-agent"];
const [command, email] = process.argv.slice(2);
if (!command || !email || !COMMANDS.includes(command)) {
	console.log(`Usage: bun run assistant:demo <${COMMANDS.join("|")}> <demo-agent-email>`);
	process.exit(1);
}

try {
	if (command === "create-agent") {
		await createAgent(email);
	} else {
		const agent = await findDemoAgent(email);
		console.log(`👤 ${agent.name} <${agent.email}>`);
		if (command === "seed") await seed(agent.id);
		if (command === "cleanup") await cleanup(agent.id);
		if (command === "retire-agent") await retireAgent(agent.id);
		if (command === "check" || command === "seed") await check(agent.id);
	}
} catch (error) {
	console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
} finally {
	await pool.end();
}
