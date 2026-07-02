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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PortalFilesBrowser } from "@/features/portal-files/portal-files-browser";
import { useRedirectUnauthenticated } from "@/hooks/use-redirect-unauthenticated";
import { authClient } from "@/lib/auth-client";
import { RiDashboardLine, RiFolderCloudLine } from "@remixicon/react";

export default function AgentFilesPage() {
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
										<RiFolderCloudLine size={18} />
										Files
									</BreadcrumbPage>
								</BreadcrumbItem>
							</BreadcrumbList>
						</Breadcrumb>
					</div>
					<HeaderActions />
				</header>

				<div className="flex flex-1 flex-col gap-6 py-6">
					<div>
						<h1 className="font-bold text-2xl tracking-tight">Files</h1>
						<p className="text-muted-foreground text-sm">
							View company documents and files shared with you by your admin team.
						</p>
					</div>

					<Card>
						<CardHeader>
							<CardTitle>File drive</CardTitle>
							<CardDescription>
								View-only access — preview files in your browser. Admins can upload
								and download on your behalf.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<PortalFilesBrowser mode="agent" />
						</CardContent>
					</Card>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
