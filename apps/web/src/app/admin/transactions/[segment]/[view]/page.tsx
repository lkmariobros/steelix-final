"use client";

import { AdminTransactionSegmentPage } from "@/features/admin-transactions/admin-transaction-segment-page";
import { resolveSegmentConfig } from "@/features/admin-transactions/segment-config";
import { LoadingScreen } from "@/components/ui/loading-spinner";
import { notFound } from "next/navigation";
import { useParams } from "next/navigation";

export default function AdminTransactionSegmentRoutePage() {
	const params = useParams<{ segment: string; view: string }>();
	const segment = params?.segment;
	const view = params?.view;

	if (!segment || !view) {
		return <LoadingScreen text="Loading..." />;
	}

	const config = resolveSegmentConfig(segment, view);
	if (!config) notFound();

	return <AdminTransactionSegmentPage config={config} />;
}
