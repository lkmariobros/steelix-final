"use client";

import { HeaderActions } from "@/components/header-actions";
import { SidebarTrigger } from "@/components/sidebar";
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
import { RiDashboardLine, RiFolderCloudLine } from "@remixicon/react";

export default function AdminFilesPage() {
	return (
		<>
			<header className="flex h-16 shrink-0 items-center gap-2 border-b">
				<div className="flex flex-1 items-center gap-2">
					<SidebarTrigger className="-ms-4" />
					<Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
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
					<h1 className="font-bold text-2xl tracking-tight">Portal files</h1>
					<p className="text-muted-foreground text-sm">
						Manage your files or browse and upload on behalf of any agent.
					</p>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>File drive</CardTitle>
						<CardDescription>
							Shared storage for admins and agents — PDF, Office, images, video
						</CardDescription>
					</CardHeader>
					<CardContent>
						<PortalFilesBrowser mode="admin" />
					</CardContent>
				</Card>
			</div>
		</>
	);
}
