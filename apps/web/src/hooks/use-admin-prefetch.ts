"use client";

import { trpc } from "@/utils/trpc";
import { useEffect, useRef } from "react";

/**
 * Prefetch common admin portal data once after auth is confirmed.
 * Tab clicks then read from React Query cache instead of cold-fetching.
 */
export function useAdminPrefetch(enabled: boolean) {
	const utils = trpc.useUtils();
	const prefetched = useRef(false);

	useEffect(() => {
		if (!enabled || prefetched.current) return;
		prefetched.current = true;

		const dateRange = {};

		void utils.admin.getDashboardSummary.prefetch(dateRange);
		void utils.admin.getCommissionApprovalQueue.prefetch({
			limit: 10,
			offset: 0,
			status: "pending",
		});
		void utils.admin.getUrgentTasks.prefetch();
		void utils.admin.getAgentPerformance.prefetch({ dateRange });
		void utils.adminLeads.list.prefetch({ limit: 5000, page: 1 });
		void utils.adminLeads.agentsWithLeads.prefetch();
		void utils.admin.getCommissionApprovalQueue.prefetch({
			limit: 20,
			offset: 0,
		});
		void utils.leadTasks.listToday.prefetch();
	}, [enabled, utils]);
}
