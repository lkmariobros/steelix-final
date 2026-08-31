"use client";

import { trpc } from "@/utils/trpc";
import { useEffect, useRef } from "react";

const PREFETCH_DELAY_MS = 8_000;

/**
 * Lazy prefetch after login settles — never blocks the critical sign-in path.
 * Matches the dashboard's default 90-day window + slim queue.
 */
export function useAdminPrefetch(enabled: boolean) {
	const utils = trpc.useUtils();
	const prefetched = useRef(false);

	useEffect(() => {
		if (!enabled || prefetched.current) return;

		const id = window.setTimeout(() => {
			if (prefetched.current) return;
			prefetched.current = true;

			const end = new Date();
			end.setHours(23, 59, 59, 999);
			const start = new Date();
			start.setDate(start.getDate() - 90);
			start.setHours(0, 0, 0, 0);
			const dateRange = { startDate: start, endDate: end };

			void utils.admin.getDashboardSummary.prefetch(dateRange);
			void utils.admin.getCommissionApprovalQueue.prefetch({
				limit: 20,
				offset: 0,
				status: "pending",
			});
		}, PREFETCH_DELAY_MS);

		return () => window.clearTimeout(id);
	}, [enabled, utils]);
}
