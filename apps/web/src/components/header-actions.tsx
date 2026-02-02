"use client";

import { usePathname } from "next/navigation";
import { FeedbackButton } from "@/components/feedback-button";
import UserDropdown from "@/components/user-dropdown";

export function HeaderActions() {
	const pathname = usePathname();
	const isAdminPage = pathname.startsWith("/admin");

	return (
		<div className="ml-auto flex items-center gap-2">
			{!isAdminPage && <FeedbackButton />}
			<UserDropdown />
		</div>
	);
}
