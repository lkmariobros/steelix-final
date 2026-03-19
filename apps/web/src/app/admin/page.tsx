"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { HeaderActions } from "@/components/header-actions";
import { Separator } from "@/components/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/sidebar";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { LoadingScreen } from "@/components/ui/loading-spinner";
import { AdminDashboard } from "@/dashboards/admin";
import { authClient } from "@/lib/auth-client";
import { RiDashboardLine, RiShieldUserLine } from "@remixicon/react";
import { useRouter } from "next/navigation";

export default function AdminDashboardPage() {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();

	// Show loading while checking authentication
	if (isPending) {
		return <LoadingScreen text="Loading..." />;
	}

	// Redirect to login if not authenticated
	if (!session) {
		router.push("/login");
		return null;
	}

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset className="overflow-hidden px-4 md:px-6 lg:px-8">
				<header className="flex h-16 shrink-0 items-center gap-2 border-b">
					<div className="flex flex-1 items-center gap-2 px-3">
						<SidebarTrigger className="-ms-4" />
						<Separator
							orientation="vertical"
							className="mr-2 data-[orientation=vertical]:h-4"
						/>
						<Breadcrumb>
							<BreadcrumbList>
								<BreadcrumbItem className="hidden md:block">
									<BreadcrumbLink href="/dashboard">
										<RiDashboardLine size={22} aria-hidden="true" />
										<span className="sr-only">Dashboard</span>
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator className="hidden md:block" />
								<BreadcrumbItem>
									<BreadcrumbPage className="flex items-center gap-2">
										<RiShieldUserLine size={20} aria-hidden="true" />
										Admin Dashboard
									</BreadcrumbPage>
								</BreadcrumbItem>
							</BreadcrumbList>
						</Breadcrumb>
					</div>
					<div className="ml-auto flex gap-3">
						<HeaderActions />
					</div>
				</header>
				<div className="flex flex-1 flex-col gap-4 py-4 lg:gap-6 lg:py-6">
					<AdminDashboard />
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
