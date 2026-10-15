import { Hono } from "hono";
import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { and, count, desc, eq, gt, sql } from "drizzle-orm";
import {
	account,
	session as sessionTable,
	user,
	verification,
} from "../models/auth";
import { passwordResetEmail, sendEmail } from "../services/mailer";
import { evaluateAccountSignInAccess } from "../utils/account-access";
import { getAllowedOrigins } from "../utils/allowed-origins";
import { db } from "../utils/db";
import { hashPassword, verifyPassword } from "../utils/password";
import { isAppRole } from "../utils/rbac";
import {
	createSession,
	destroySession,
	findCredentialAccount,
	getSession,
	readSessionToken,
	SESSION_COOKIE,
	sessionCookieOptions,
} from "../utils/session";
import { hasAdminAccess, hasSuperAdminAccess } from "../utils/user-roles";

export const authRoutes = new Hono();

function publicUser(record: {
	id: string;
	email: string;
	name: string;
	image: string | null;
	emailVerified: boolean;
	createdAt: Date;
	updatedAt: Date;
	role: string | null;
}) {
	return {
		id: record.id,
		email: record.email,
		name: record.name,
		image: record.image,
		emailVerified: record.emailVerified,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
		role: record.role,
	};
}

authRoutes.get("/api/auth/me-role", async (c) => {
	try {
		const session = await getSession(c.req.raw.headers);
		if (!session?.user?.id) {
			return c.json({ hasAdminAccess: false, role: null }, 401);
		}

		const role = isAppRole(session.user.role) ? session.user.role : "agent";
		return c.json({
			role,
			hasAdminAccess: hasAdminAccess({ role }),
			hasSuperAdminAccess: hasSuperAdminAccess({ role }),
		});
	} catch (error) {
		console.error("❌ me-role error:", error);
		return c.json({ hasAdminAccess: false, role: null }, 500);
	}
});

async function signInEmail(c: Context) {
	const bodyText = await c.req.text();
	let parsedBody: Record<string, unknown> | null = null;
	if (bodyText) {
		try {
			const json: unknown = JSON.parse(bodyText);
			if (json && typeof json === "object" && !Array.isArray(json)) {
				parsedBody = json as Record<string, unknown>;
			}
		} catch {
			parsedBody = null;
		}
	}

	const email =
		parsedBody && "email" in parsedBody
			? String(parsedBody.email ?? "").toLowerCase().trim()
			: "";
	const password =
		parsedBody && "password" in parsedBody
			? String(parsedBody.password ?? "")
			: "";
	const rememberMe = parsedBody?.rememberMe !== false;

	console.log(
		`🔐 sign-in/email: bodyLength=${bodyText.length} hasEmail=${Boolean(email)} origin=${c.req.header("origin") ?? "none"}`,
	);

	if (!email || !password) {
		return c.json(
			{
				code: "INVALID_EMAIL_OR_PASSWORD",
				message: "Invalid email or password",
			},
			401,
		);
	}

	// The "email" field also accepts an Agent ID, since one email may own several accounts.
	const signInByEmail = email.includes("@");
	const candidates = await db
		.select()
		.from(user)
		.where(
			signInByEmail
				? sql`lower(${user.email}) = ${email}`
				: sql`upper(trim(${user.agentCode})) = ${email.toUpperCase()}`,
		)
		.orderBy(desc(user.createdAt));

	console.log(
		`🔐 sign-in/email: by=${signInByEmail ? "email" : "agentId"} accounts=${candidates.length} roles=${candidates.map((r) => r.role ?? "n/a").join(",") || "n/a"}`,
	);

	const allowedCandidates = candidates.filter(
		(candidate) => evaluateAccountSignInAccess(candidate).allowed,
	);
	if (allowedCandidates.length === 0) {
		const access = evaluateAccountSignInAccess(candidates[0]);
		return c.json(
			{
				code: "FORBIDDEN",
				message: access.allowed
					? "Account not found. Please contact support."
					: access.message,
			},
			403,
		);
	}

	const passwordMatches: typeof allowedCandidates = [];
	for (const candidate of allowedCandidates) {
		const credential = await findCredentialAccount(candidate.id);
		if (!credential?.password) {
			console.warn(
				`🔐 sign-in/email: credential account missing for user ${candidate.id}`,
			);
			continue;
		}
		if (await verifyPassword({ hash: credential.password, password })) {
			passwordMatches.push(candidate);
		}
	}
	console.log(`🔐 sign-in/email: passwordMatches=${passwordMatches.length}`);

	if (passwordMatches.length > 1) {
		return c.json(
			{
				code: "MULTIPLE_ACCOUNTS",
				message:
					"This email is linked to more than one account. Please sign in with your Agent ID instead of your email.",
			},
			409,
		);
	}

	const [record] = passwordMatches;
	if (!record) {
		return c.json(
			{
				code: "INVALID_EMAIL_OR_PASSWORD",
				message: signInByEmail
					? "Invalid email or password"
					: "Invalid Agent ID or password",
			},
			401,
		);
	}

	const created = await createSession({
		userId: record.id,
		rememberMe,
		userAgent: c.req.header("user-agent") ?? null,
	});

	setCookie(c, SESSION_COOKIE, created.token, sessionCookieOptions(rememberMe));
	console.log(`🔐 sign-in/email: session created for ${record.email}`);
	return c.json({
		redirect: false,
		token: created.token,
		user: publicUser(record),
	});
}

authRoutes.post("/api/auth/sign-in/email", (c) => signInEmail(c));
authRoutes.post("/api/auth/signin/email", (c) => signInEmail(c));

authRoutes.post("/api/auth/sign-up/email", async (c) => {
	try {
		const body = await c.req.json<{
			email?: string;
			password?: string;
			name?: string;
		}>();
		const email = String(body.email ?? "").toLowerCase().trim();
		const password = String(body.password ?? "");
		const name = String(body.name ?? "").trim() || email.split("@")[0] || "User";

		if (!email || password.length < 8) {
			return c.json(
				{ message: "Valid email and password (min 8 characters) are required" },
				400,
			);
		}

		const [existing] = await db
			.select({ id: user.id })
			.from(user)
			.where(sql`lower(${user.email}) = ${email}`)
			.limit(1);
		if (existing) {
			return c.json({ message: "User already exists" }, 422);
		}

		const [existingUsersCount] = await db.select({ count: count() }).from(user);
		const isFirstUser = existingUsersCount.count === 0;
		const role = isFirstUser ? "super_admin" : "agent";
		const agentStatus = isFirstUser ? "active" : "pending_approval";
		const isActive = isFirstUser;
		const now = new Date();
		const userId = crypto.randomUUID();
		const passwordHash = await hashPassword(password);

		await db.insert(user).values({
			id: userId,
			name,
			email,
			emailVerified: false,
			image: null,
			isActive,
			role,
			agentStatus,
			createdAt: now,
			updatedAt: now,
		});

		await db.insert(account).values({
			id: crypto.randomUUID(),
			accountId: email,
			providerId: "credential",
			userId,
			password: passwordHash,
			createdAt: now,
			updatedAt: now,
		});

		if (!isFirstUser) {
			return c.json(
				{
					code: "FORBIDDEN",
					message:
						"Your account is pending admin approval. You will be able to sign in after an administrator approves your registration.",
				},
				403,
			);
		}

		const created = await createSession({
			userId,
			rememberMe: true,
			userAgent: c.req.header("user-agent") ?? null,
		});
		setCookie(c, SESSION_COOKIE, created.token, sessionCookieOptions(true));
		return c.json({
			token: created.token,
			user: publicUser({
				id: userId,
				email,
				name,
				image: null,
				emailVerified: false,
				createdAt: now,
				updatedAt: now,
				role,
			}),
		});
	} catch (error) {
		console.error("❌ sign-up error:", error);
		return c.json({ message: "Registration failed" }, 500);
	}
});

async function sessionPayload(c: Context) {
	const session = await getSession(c.req.raw.headers);
	if (!session) {
		return c.json({ user: null, session: null });
	}
	return {
		user: publicUser(session.user),
		session: session.session,
	};
}

authRoutes.get("/api/auth/get-session", async (c) => {
	return c.json(await sessionPayload(c));
});
authRoutes.get("/api/auth/session", async (c) => {
	return c.json(await sessionPayload(c));
});

authRoutes.post("/api/auth/sign-out", async (c) => {
	await destroySession(readSessionToken(c.req.raw.headers));
	deleteCookie(c, SESSION_COOKIE, { path: "/" });
	return c.json({ success: true });
});

const RESET_TOKEN_TTL_MINUTES = 60;
const RESET_RESEND_COOLDOWN_MS = 60 * 1000;
const DEFAULT_PORTAL_URL = "https://portal.devots.com.my";

/** Only build reset links for known portal origins (never trust arbitrary Origin headers). */
function resolvePortalBaseUrl(originHeader: string | undefined): string {
	const origin = originHeader?.trim().replace(/\/$/, "");
	if (origin && /^https?:\/\//.test(origin) && getAllowedOrigins().includes(origin)) {
		return origin;
	}
	return (process.env.PORTAL_URL?.trim() || DEFAULT_PORTAL_URL).replace(/\/$/, "");
}

authRoutes.post("/api/auth/forget-password", async (c) => {
	try {
		const body = await c.req.json<{ email?: string }>().catch(() => ({} as { email?: string }));
		const identifierInput = String(body.email ?? "").toLowerCase().trim();
		if (!identifierInput) return c.json({ status: true });

		// Accepts email or Agent ID; a shared email gets one reset link per account.
		const records = await db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				agentCode: user.agentCode,
			})
			.from(user)
			.where(
				identifierInput.includes("@")
					? sql`lower(${user.email}) = ${identifierInput}`
					: sql`upper(trim(${user.agentCode})) = ${identifierInput.toUpperCase()}`,
			)
			.orderBy(desc(user.createdAt));

		// Same response whether or not the account exists, so emails cannot be probed.
		if (records.length === 0) {
			console.log("🔐 forget-password: no account for requested email/Agent ID");
			return c.json({ status: true });
		}

		const now = new Date();
		const baseUrl = resolvePortalBaseUrl(c.req.header("origin"));
		const showAgentId = records.length > 1;

		for (const record of records) {
			const identifier = `reset:user:${record.id}`;
			const [recent] = await db
				.select({ id: verification.id })
				.from(verification)
				.where(
					and(
						eq(verification.identifier, identifier),
						gt(verification.createdAt, new Date(now.getTime() - RESET_RESEND_COOLDOWN_MS)),
					),
				)
				.limit(1);
			if (recent) {
				console.log(`🔐 forget-password: cooldown active for user ${record.id}`);
				continue;
			}

			const tokenBytes = new Uint8Array(32);
			crypto.getRandomValues(tokenBytes);
			const token = [...tokenBytes]
				.map((b) => b.toString(16).padStart(2, "0"))
				.join("");

			await db.delete(verification).where(eq(verification.identifier, identifier));
			await db.insert(verification).values({
				id: crypto.randomUUID(),
				identifier,
				value: token,
				expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
				createdAt: now,
				updatedAt: now,
			});

			const result = await sendEmail({
				to: record.email,
				...passwordResetEmail({
					name: record.name,
					resetUrl: `${baseUrl}/reset-password?token=${token}`,
					expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
					agentCode: showAgentId || !identifierInput.includes("@")
						? record.agentCode
						: null,
				}),
			});

			if (result.sent) {
				console.log(`🔐 forget-password: reset email sent for user ${record.id} (id=${result.id ?? "n/a"})`);
			} else {
				console.error(`❌ forget-password: reset email NOT sent for user ${record.id}: ${result.reason}`);
			}
		}
		return c.json({ status: true });
	} catch (error) {
		console.error("❌ forget-password error:", error);
		return c.json({ status: true });
	}
});

authRoutes.post("/api/auth/reset-password", async (c) => {
	try {
		const body = await c.req.json<{
			token?: string;
			newPassword?: string;
		}>();
		const token = String(body.token ?? "");
		const newPassword = String(body.newPassword ?? "");
		if (!token || newPassword.length < 8) {
			return c.json({ message: "Invalid reset request" }, 400);
		}

		const [row] = await db
			.select()
			.from(verification)
			.where(
				and(
					eq(verification.value, token),
					gt(verification.expiresAt, new Date()),
				),
			)
			.limit(1);

		if (!row?.identifier.startsWith("reset:")) {
			return c.json({ message: "Invalid or expired token" }, 400);
		}

		const target = row.identifier.slice("reset:".length);
		// Links issued before shared emails used "reset:<email>"; only honour them when unambiguous.
		const matches = target.startsWith("user:")
			? await db
					.select({ id: user.id, email: user.email })
					.from(user)
					.where(eq(user.id, target.slice("user:".length)))
					.limit(1)
			: await db
					.select({ id: user.id, email: user.email })
					.from(user)
					.where(sql`lower(${user.email}) = ${target}`)
					.limit(2);
		const [record] = matches;
		if (!record || matches.length > 1) {
			return c.json({ message: "Invalid or expired token" }, 400);
		}
		const email = record.email.toLowerCase();

		const passwordHash = await hashPassword(newPassword);
		const now = new Date();
		const updated = await db
			.update(account)
			.set({ password: passwordHash, updatedAt: now })
			.where(
				and(eq(account.userId, record.id), eq(account.providerId, "credential")),
			)
			.returning({ id: account.id });
		if (updated.length === 0) {
			await db.insert(account).values({
				id: crypto.randomUUID(),
				accountId: email,
				providerId: "credential",
				userId: record.id,
				password: passwordHash,
				createdAt: now,
				updatedAt: now,
			});
		}
		await db.delete(verification).where(eq(verification.identifier, row.identifier));
		// Sign out every device so an old session cannot outlive the password change.
		await db.delete(sessionTable).where(eq(sessionTable.userId, record.id));
		console.log(`🔐 reset-password: password updated for ${email}`);
		return c.json({ status: true });
	} catch (error) {
		console.error("❌ reset-password error:", error);
		return c.json({ message: "Failed to reset password" }, 500);
	}
});
