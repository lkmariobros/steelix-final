"use client";

import { AppSidebar } from "@/components/app-sidebar";
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
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import UserDropdown from "@/components/user-dropdown";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { LoadingScreen } from "@/components/ui/loading-spinner";
import { AccessDenied } from "@/components/ui/access-denied";
import {
	RiDashboardLine,
	RiSettings3Line,
} from "@remixicon/react";
import { useRouter } from "next/navigation";

export default function AdminSettingsPage() {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();

	// Admin role checking
	const { data: roleData, isLoading: isRoleLoading } = trpc.admin.checkAdminRole.useQuery(
		undefined,
		{
			enabled: !!session,
			retry: false
		}
	);

	// Show loading while checking authentication and role
	if (isPending || isRoleLoading) {
		return <LoadingScreen text="Checking permissions..." />;
	}

	// Redirect if not authenticated
	if (!session) {
		router.push("/login");
		return null;
	}

	// Access denied if not admin
	if (!roleData || !roleData.hasAdminAccess) {
		return (
			<AccessDenied
				title="Access Denied"
				message="You don't have permission to access admin settings."
				userRole={roleData?.role || 'Unknown'}
				redirectPath="/dashboard"
				redirectLabel="Go to Agent Dashboard"
			/>
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
									<BreadcrumbLink href="/admin">
										<RiDashboardLine size={22} aria-hidden="true" />
										<span className="sr-only">Admin Dashboard</span>
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator className="hidden md:block" />
								<BreadcrumbItem>
									<BreadcrumbPage className="flex items-center gap-2">
										<RiSettings3Line size={20} aria-hidden="true" />
										Admin Settings
									</BreadcrumbPage>
								</BreadcrumbItem>
							</BreadcrumbList>
						</Breadcrumb>
					</div>
					<div className="ml-auto flex gap-3">
						<UserDropdown />
					</div>
				</header>
				<div className="flex flex-1 flex-col gap-4 py-4 lg:gap-6 lg:py-6">
					<div className="mx-auto w-full max-w-3xl">
						<div className="mb-6 flex items-center gap-4">
							<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
								<RiSettings3Line className="h-6 w-6 text-primary" />
							</div>
							<div>
								<h1 className="font-bold text-3xl">Admin Settings</h1>
								<p className="text-muted-foreground">
									View your admin account information and system status
								</p>
							</div>
						</div>

						{/* Admin Account Information */}
						<Card>
							<CardHeader>
								<CardTitle>Account Information</CardTitle>
								<CardDescription>
									Your admin account details and current session status
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-2 gap-4 text-sm">
									<div className="rounded-lg border bg-muted/50 p-3">
										<p className="text-muted-foreground">Admin User</p>
										<p className="mt-1 font-medium">{session?.user?.name || "Unknown"}</p>
									</div>
									<div className="rounded-lg border bg-muted/50 p-3">
										<p className="text-muted-foreground">Role</p>
										<p className="mt-1 font-medium capitalize">{roleData?.role || "Admin"}</p>
									</div>
									<div className="rounded-lg border bg-muted/50 p-3">
										<p className="text-muted-foreground">Email</p>
										<p className="mt-1 font-medium">{session?.user?.email || "Unknown"}</p>
									</div>
									<div className="rounded-lg border bg-muted/50 p-3">
										<p className="text-muted-foreground">Session Status</p>
										<p className="mt-1 font-medium text-green-600">Active</p>
									</div>
								</div>
								<p className="mt-4 text-muted-foreground text-xs">
									For advanced system configuration (database settings, security policies, etc.),
									please contact your system administrator or modify environment variables directly.
								</p>
							</CardContent>
						</Card>
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
