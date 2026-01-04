"use client";

import { TierConfigurationManager } from "@/components/admin/tier-configuration-manager";
import { AppSidebar } from "@/components/app-sidebar";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/sidebar";
import { AccessDenied } from "@/components/ui/access-denied";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { LoadingScreen } from "@/components/ui/loading-spinner";
import { Separator } from "@/components/ui/separator";
import UserDropdown from "@/components/user-dropdown";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { RiDashboardLine, RiSettings3Line } from "@remixicon/react";
import { useRouter } from "next/navigation";

export default function TierConfigurationPage() {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();

	const { data: roleData, isLoading: isRoleLoading } =
		trpc.admin.checkAdminRole.useQuery(undefined, {
			enabled: !!session,
			retry: false,
		});

	if (isPending || isRoleLoading) {
		return <LoadingScreen text="Checking permissions..." />;
	}

	if (!session) {
		router.push("/login");
		return null;
	}

	if (!roleData || !roleData.hasAdminAccess) {
		return (
			<AccessDenied
				title="Access Denied"
				message="You don't have permission to access tier configuration."
				userRole={roleData?.role || "Unknown"}
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
								<BreadcrumbItem className="hidden md:block">
									<BreadcrumbLink href="/admin/settings">
										Settings
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator className="hidden md:block" />
								<BreadcrumbItem>
									<BreadcrumbPage className="flex items-center gap-2">
										<RiSettings3Line size={20} aria-hidden="true" />
										Tier Configuration
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
					<div className="mx-auto w-full max-w-5xl">
						<div className="mb-6 flex items-center gap-4">
							<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
								<RiSettings3Line className="h-6 w-6 text-primary" />
							</div>
							<div>
								<h1 className="font-bold text-3xl">Tier Configuration</h1>
								<p className="text-muted-foreground">
									Manage commission splits and leadership bonus rates for agent
									tiers
								</p>
							</div>
						</div>
						<TierConfigurationManager />
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
