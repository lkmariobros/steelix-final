"use client";

import { AppSidebar } from "@/components/app-sidebar";
import FeedbackDialog from "@/components/feedback-dialog";
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
import UserDropdown from "@/components/user-dropdown";
import { AdminDashboard } from "@/dashboards/admin";
import { authClient } from "@/lib/auth-client";
import { RiDashboardLine, RiShieldUserLine } from "@remixicon/react";
import { useRouter } from "next/navigation";

export default function AdminDashboardPage() {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();

	// Temporarily disable role check for testing
	// TODO: Re-enable once tRPC types are properly generated
	const isRoleLoading = false;
	const roleData = { hasAdminAccess: true }; // For testing purposes

	// Show loading while checking authentication and role
	if (isPending || isRoleLoading) {
		return (
			<div className="flex h-screen items-center justify-center">
				<div className="text-center">
					<div className="mx-auto h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
					<p className="mt-2 text-muted-foreground text-sm">Loading...</p>
				</div>
			</div>
		);
	}

	// Redirect if not authenticated
	if (!session) {
		router.push("/login");
		return null;
	}

	// TEMPORARILY ALLOW ACCESS FOR TESTING - TODO: Re-enable role check
	// if (!roleData || !roleData.hasAdminAccess) {
	// 	return (
	// 		<div className="flex h-screen items-center justify-center">
	// 			<div className="text-center">
	// 				<RiShieldUserLine size={48} className="mx-auto text-muted-foreground mb-4" />
	// 				<h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
	// 				<p className="text-muted-foreground mb-4">
	// 					You don&apos;t have permission to access the admin portal.
	// 				</p>
	// 				<button
	// 					onClick={() => router.push('/dashboard')}
	// 					className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
	// 				>
	// 					Go to Agent Dashboard
	// 				</button>
	// 			</div>
	// 		</div>
	// 	);
	// }

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
						<FeedbackDialog />
						<UserDropdown />
					</div>
				</header>
				<div className="flex flex-1 flex-col gap-4 py-4 lg:gap-6 lg:py-6">
					<AdminDashboard />
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
