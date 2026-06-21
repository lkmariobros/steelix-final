"use client";

import { AdminTransactionSegmentPage } from "@/features/admin-transactions/admin-transaction-segment-page";
import { resolveSegmentConfig } from "@/features/admin-transactions/segment-config";
import { LoadingScreen } from "@/components/ui/loading-spinner";
import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminTransactionSegmentRoutePage() {
	const params = useParams<{ segment: string; view: string }>();
	const router = useRouter();
	const segment = params?.segment;
	const view = params?.view;
	const config =
		segment && view ? resolveSegmentConfig(segment, view) : null;

	useEffect(() => {
		if (config?.view === "requests") {
			router.replace(`/admin/approvals/requests?segment=${config.segment}`);
		}
	}, [config, router]);

	if (!segment || !view) {
		return <LoadingScreen text="Loading..." />;
	}

	if (!config) notFound();

	if (config.view === "requests") {
		return <LoadingScreen text="Loading requests..." />;
	}

	return <AdminTransactionSegmentPage config={config} />;
}
