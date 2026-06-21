export type AgentStatus =
	| "active"
	| "inactive"
	| "suspended"
	| "pending_approval"
	| "terminated";

const STATUS_LABELS: Record<AgentStatus, string> = {
	active: "Approved",
	inactive: "Inactive",
	suspended: "Suspended",
	pending_approval: "Pending",
	terminated: "Terminated",
};

const STATUS_BADGE_CLASS: Record<AgentStatus, string> = {
	active: "bg-green-500/15 text-green-700 dark:text-green-400",
	inactive: "bg-muted text-muted-foreground",
	suspended: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
	pending_approval: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
	terminated: "bg-red-500/15 text-red-700 dark:text-red-400",
};

export function formatAgentStatus(
	status: string | null | undefined,
): string {
	if (!status) return "Pending";
	return STATUS_LABELS[status as AgentStatus] ?? status;
}

export function agentStatusBadgeClass(
	status: string | null | undefined,
): string {
	if (!status) return STATUS_BADGE_CLASS.pending_approval;
	return (
		STATUS_BADGE_CLASS[status as AgentStatus] ??
		STATUS_BADGE_CLASS.pending_approval
	);
}

export function isPendingAgentStatus(status: string | null | undefined): boolean {
	return status === "pending_approval" || !status;
}
