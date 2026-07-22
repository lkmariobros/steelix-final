"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { HeaderActions } from "@/components/header-actions";
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
import { Separator } from "@/components/ui/separator";
import { GenerateRecruitmentLinkCard } from "@/features/erecruitment/generate-recruitment-link-card";
import { useRedirectUnauthenticated } from "@/hooks/use-redirect-unauthenticated";
import { authClient } from "@/lib/auth-client";
import { RiDashboardLine, RiUserAddLine } from "@remixicon/react";

export default function AgentERecruitmentPage() {
	const { data: session, isPending } = authClient.useSession();
	useRedirectUnauthenticated(session?.user?.id, isPending);

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset className="overflow-hidden px-4 md:px-6 lg:px-8">
				<header className="flex h-16 shrink-0 items-center gap-2 border-b">
					<div className="flex flex-1 items-center gap-2">
						<SidebarTrigger className="-ms-1" />
						<Separator orientation="vertical" className="mr-2 h-4" />
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
										<RiUserAddLine size={18} />
										eRecruitment
									</BreadcrumbPage>
								</BreadcrumbItem>
							</BreadcrumbList>
						</Breadcrumb>
					</div>
					<HeaderActions />
				</header>

				<div className="flex flex-1 flex-col gap-6 py-6">
					<div>
						<h1 className="font-bold text-2xl tracking-tight">eRecruitment</h1>
						<p className="text-muted-foreground text-sm">
							Generate recruitment links for new joiners. Application approval is
							handled by Admin / Super Admin.
						</p>
					</div>

					<GenerateRecruitmentLinkCard />
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
