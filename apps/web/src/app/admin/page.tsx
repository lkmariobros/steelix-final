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
import { AdminDashboard } from "@/dashboards/admin";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { RiDashboardLine, RiShieldUserLine } from "@remixicon/react";
import { useRouter } from "next/navigation";

export default function AdminDashboardPage() {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();

	// ✅ CORRECT tRPC query pattern with proper role checking
	const { data: roleData, isLoading: isRoleLoading } =
		trpc.admin.checkAdminRole.useQuery(undefined, {
			enabled: !!session, // Only check role if user is authenticated
			retry: false,
		}) as {
			data: { hasAdminAccess: boolean; role: string } | undefined;
			isLoading: boolean;
		};

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

	// ✅ SECURITY FIX: Proper admin access control
	if (!roleData || !roleData.hasAdminAccess) {
		return (
			<div className="flex h-screen items-center justify-center">
				<div className="text-center">
					<RiShieldUserLine
						size={48}
						className="mx-auto mb-4 text-muted-foreground"
					/>
					<h1 className="mb-2 font-semibold text-2xl">Access Denied</h1>
					<p className="mb-4 text-muted-foreground">
						You don&apos;t have permission to access the admin portal.
					</p>
					<p className="mb-4 text-muted-foreground text-sm">
						Current role: {roleData?.role || "Unknown"}
					</p>
					<button
						type="button"
						onClick={() => router.push("/dashboard")}
						className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
					>
						Go to Agent Dashboard
					</button>
				</div>
			</div>
		);
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
