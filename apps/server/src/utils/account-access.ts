import type { InferSelectModel } from "drizzle-orm";
import type { user } from "../models/auth";

type AccountUser = Pick<
	InferSelectModel<typeof user>,
	"role" | "agentStatus" | "isActive"
>;

export const PENDING_APPROVAL_MESSAGE =
	"Your account is pending admin approval. You will be able to sign in after an administrator approves your registration.";

export const ACCOUNT_DEACTIVATED_MESSAGE =
	"Your account has been deactivated. Please contact an administrator.";

export function evaluateAccountSignInAccess(
	account: AccountUser | null | undefined,
): { allowed: true } | { allowed: false; message: string } {
	if (!account) {
		return {
			allowed: false,
			message: "Account not found. Please contact support.",
		};
	}

	if (isBootstrapOrStaffRole(account.role) && account.isActive !== false) {
		return { allowed: true };
	}

	if (account.isActive === false) {
		const status = account.agentStatus ?? "pending_approval";
		if (status === "pending_approval") {
			return { allowed: false, message: PENDING_APPROVAL_MESSAGE };
		}
		return { allowed: false, message: ACCOUNT_DEACTIVATED_MESSAGE };
	}

	const status = account.agentStatus ?? "pending_approval";
	switch (status) {
		case "active":
			return { allowed: true };
		case "pending_approval":
			return { allowed: false, message: PENDING_APPROVAL_MESSAGE };
		case "suspended":
			return {
				allowed: false,
				message:
					"Your account has been suspended. Please contact an administrator.",
			};
		case "terminated":
			return {
				allowed: false,
				message: "This account has been terminated.",
			};
		case "inactive":
			return { allowed: false, message: ACCOUNT_DEACTIVATED_MESSAGE };
		default:
			return { allowed: false, message: PENDING_APPROVAL_MESSAGE };
	}
}

/** Admin-created and bootstrap accounts can sign in immediately. */
export function isBootstrapOrStaffRole(role: string | null | undefined): boolean {
	return role === "super_admin" || role === "admin" || role === "team_lead";
}
