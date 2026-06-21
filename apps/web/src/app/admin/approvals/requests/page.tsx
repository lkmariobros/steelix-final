import { Suspense } from "react";
import { LoadingScreen } from "@/components/ui/loading-spinner";
import AdminApprovalRequestsPage from "./requests-page";

export default function AdminApprovalRequestsRoutePage() {
	return (
		<Suspense fallback={<LoadingScreen text="Loading requests..." />}>
			<AdminApprovalRequestsPage />
		</Suspense>
	);
}
