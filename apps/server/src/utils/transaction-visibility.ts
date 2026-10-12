import { sql } from "drizzle-orm";
import { transactions } from "../models/transactions";

type CoBrokingData = {
	internalAgentId?: string | null;
	commissionSplit?: number | null;
	agents?: Array<{
		internalAgentId?: string | null;
		commissionSplit?: number | null;
	}> | null;
} | null;

type CommissionBreakdown = {
	agentNetCommission?: number | null;
	coBrokerShare?: number | null;
} | null;

/** SQL: case owner or internal co-broker can see the row. */
export function agentVisibleTransactionsSql(userId: string) {
	return sql`(
		${transactions.agentId} = ${userId}
		OR COALESCE(${transactions.coBrokingData}->>'internalAgentId', '') = ${userId}
		OR EXISTS (
			SELECT 1
			FROM jsonb_array_elements(
				CASE
					WHEN jsonb_typeof(${transactions.coBrokingData}->'agents') = 'array'
					THEN ${transactions.coBrokingData}->'agents'
					ELSE '[]'::jsonb
				END
			) AS cobroke_agent
			WHERE COALESCE(cobroke_agent->>'internalAgentId', '') = ${userId}
		)
	)`;
}

export function isInternalCoBroker(
	coBrokingData: unknown,
	userId: string,
): boolean {
	const co = coBrokingData as CoBrokingData;
	if (!co) return false;
	if (co.internalAgentId === userId) return true;
	return (co.agents ?? []).some((a) => a.internalAgentId === userId);
}

function coBrokerPercentForUser(
	co: CoBrokingData,
	userId: string,
): number | null {
	if (!co) return null;
	const fromAgents = (co.agents ?? []).find((a) => a.internalAgentId === userId);
	if (fromAgents?.commissionSplit != null) {
		return Number(fromAgents.commissionSplit) || 0;
	}
	if (co.internalAgentId === userId && co.commissionSplit != null) {
		return Number(co.commissionSplit) || 0;
	}
	return null;
}

function totalCoBrokerPercent(co: CoBrokingData): number {
	if (!co) return 0;
	if (co.agents && co.agents.length > 0) {
		return co.agents.reduce(
			(sum, a) => sum + (Number(a.commissionSplit) || 0),
			0,
		);
	}
	return Number(co.commissionSplit) || 0;
}

/**
 * Commission this viewer should see: owner net / share, or co-broker share only.
 */
export function resolveViewerCommission(input: {
	viewerId: string;
	agentId: string;
	commissionAmount: string | number | null | undefined;
	coBrokingData?: unknown;
	commissionBreakdown?: unknown;
}): {
	viewerRole: "owner" | "co_broker";
	myCommissionAmount: number;
} {
	const gross = Number(input.commissionAmount) || 0;
	const breakdown = input.commissionBreakdown as CommissionBreakdown;
	const co = input.coBrokingData as CoBrokingData;

	if (input.agentId === input.viewerId) {
		if (breakdown?.agentNetCommission != null) {
			return {
				viewerRole: "owner",
				myCommissionAmount: Number(breakdown.agentNetCommission) || 0,
			};
		}
		const coPct = totalCoBrokerPercent(co);
		if (coPct > 0) {
			return {
				viewerRole: "owner",
				myCommissionAmount: Math.round(gross * ((100 - coPct) / 100) * 100) / 100,
			};
		}
		return { viewerRole: "owner", myCommissionAmount: gross };
	}

	const myPct = coBrokerPercentForUser(co, input.viewerId);
	if (myPct == null) {
		return { viewerRole: "co_broker", myCommissionAmount: 0 };
	}

	const agents = co?.agents ?? [];
	if (
		breakdown?.coBrokerShare != null &&
		(agents.length <= 1 ||
			(agents.length === 1 && agents[0]?.internalAgentId === input.viewerId))
	) {
		return {
			viewerRole: "co_broker",
			myCommissionAmount: Number(breakdown.coBrokerShare) || 0,
		};
	}

	return {
		viewerRole: "co_broker",
		myCommissionAmount: Math.round(gross * (myPct / 100) * 100) / 100,
	};
}
