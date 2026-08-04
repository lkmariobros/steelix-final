/** Shared co-broke helpers — supports multiple agents with per-agent splits. */

export type CoBrokeAgentEntry = {
	/** Stable client key for list rendering */
	id: string;
	internalAgentId?: string;
	agentName?: string;
	agencyName?: string;
	/** This co-broker's share of total commission (0–100) */
	commissionSplit?: number;
	contactInfo?: string;
	agentEmail?: string;
	agentPhone?: string;
};

export type CoBrokingDataShape = {
	agents?: CoBrokeAgentEntry[];
	/** Legacy single-agent fields (mirrored from agents[0] on save) */
	internalAgentId?: string;
	agentName?: string;
	agencyName?: string;
	commissionSplit?: number;
	contactInfo?: string;
	agentEmail?: string;
	agentPhone?: string;
};

export function createEmptyCoBrokeAgent(
	commissionSplit = 50,
): CoBrokeAgentEntry {
	return {
		id:
			typeof crypto !== "undefined" && "randomUUID" in crypto
				? crypto.randomUUID()
				: `co-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		commissionSplit,
		agentName: "",
		agencyName: "",
		agentPhone: "",
		agentEmail: "",
	};
}

/** Read agents array, or lift legacy single-agent fields into one entry. */
export function normalizeCoBrokingAgents(
	data?: CoBrokingDataShape | null,
): CoBrokeAgentEntry[] {
	if (!data) return [createEmptyCoBrokeAgent(50)];

	if (Array.isArray(data.agents) && data.agents.length > 0) {
		return data.agents.map((a) => ({
			...createEmptyCoBrokeAgent(a.commissionSplit ?? 50),
			...a,
			id: a.id || createEmptyCoBrokeAgent().id,
			commissionSplit: a.commissionSplit ?? 50,
		}));
	}

	const hasLegacy =
		Boolean(data.internalAgentId?.trim()) ||
		Boolean(data.agentName?.trim()) ||
		Boolean(data.agencyName?.trim());

	if (!hasLegacy && data.commissionSplit == null) {
		return [createEmptyCoBrokeAgent(50)];
	}

	return [
		{
			id: createEmptyCoBrokeAgent().id,
			internalAgentId: data.internalAgentId,
			agentName: data.agentName ?? "",
			agencyName: data.agencyName ?? "",
			commissionSplit: data.commissionSplit ?? 50,
			contactInfo: data.contactInfo,
			agentEmail: data.agentEmail ?? "",
			agentPhone: data.agentPhone ?? "",
		},
	];
}

/** Persist agents + mirror first entry onto legacy fields for older readers. */
export function buildCoBrokingDataFromAgents(
	agents: CoBrokeAgentEntry[],
): CoBrokingDataShape {
	const list =
		agents.length > 0 ? agents : [createEmptyCoBrokeAgent(50)];
	const first = list[0];
	return {
		agents: list,
		internalAgentId: first.internalAgentId,
		agentName: first.agentName,
		agencyName: first.agencyName,
		commissionSplit: totalCoBrokerSplit(list),
		contactInfo: first.contactInfo,
		agentEmail: first.agentEmail,
		agentPhone: first.agentPhone,
	};
}

export function totalCoBrokerSplit(agents: CoBrokeAgentEntry[]): number {
	return agents.reduce((sum, a) => sum + (Number(a.commissionSplit) || 0), 0);
}

export function yourShareFromCoBrokeAgents(
	agents: CoBrokeAgentEntry[],
): number {
	return Math.max(0, 100 - totalCoBrokerSplit(agents));
}

export function isCoBrokeAgentComplete(
	agent: CoBrokeAgentEntry,
	marketType?: string,
): boolean {
	if (agent.internalAgentId?.trim()) return true;
	if (
		marketType === "secondary" &&
		agent.agencyName?.trim() &&
		agent.agentName?.trim()
	) {
		return true;
	}
	return Boolean(agent.agentName?.trim() && agent.agentPhone?.trim());
}
