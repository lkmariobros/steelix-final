"use client";

import { trpc } from "@/utils/trpc";
import { useEffect, useRef } from "react";

const PREFETCH_DELAY_MS = 4_000;

/**
 * Lazy prefetch after login settles — never blocks the critical sign-in path.
 * Only warms dashboard widgets, not leads or other heavy tabs.
 */
export function useAdminPrefetch(enabled: boolean) {
	const utils = trpc.useUtils();
	const prefetched = useRef(false);

	useEffect(() => {
		if (!enabled || prefetched.current) return;

		const id = window.setTimeout(() => {
			if (prefetched.current) return;
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
		}, PREFETCH_DELAY_MS);

		return () => window.clearTimeout(id);
	}, [enabled, utils]);
}
