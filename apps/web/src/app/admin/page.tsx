"use client";

import { HeaderActions } from "@/components/header-actions";
import { Separator } from "@/components/separator";
import { SidebarTrigger } from "@/components/sidebar";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { AdminDashboard } from "@/dashboards/admin";
import { RiDashboardLine, RiShieldUserLine } from "@remixicon/react";

export default function AdminDashboardPage() {
	return (
		<>
			<header className="sticky top-0 z-30 -mx-4 flex h-16 shrink-0 items-center gap-2 border-border/60 border-b bg-background/95 px-4 backdrop-blur-md supports-backdrop-filter:bg-background/80 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
				<div className="flex flex-1 items-center gap-2 px-1 sm:px-0">
					<SidebarTrigger className="-ms-1 rounded-xl" />
					<Separator
						orientation="vertical"
						className="mr-2 data-[orientation=vertical]:h-4"
					/>
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem className="hidden md:block">
								<BreadcrumbLink
									href="/dashboard"
									className="text-muted-foreground transition-colors hover:text-foreground"
								>
									<RiDashboardLine size={20} aria-hidden="true" />
									<span className="sr-only">Dashboard</span>
								</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator className="hidden md:block" />
							<BreadcrumbItem>
								<BreadcrumbPage className="flex items-center gap-2 font-medium">
									<span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
										<RiShieldUserLine size={16} aria-hidden="true" />
									</span>
									Admin Dashboard
								</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				</div>
				<div className="ml-auto flex gap-2">
					<HeaderActions />
				</div>
			</header>
			<div className="flex flex-1 flex-col gap-4 py-5 lg:gap-6 lg:py-7">
				<AdminDashboard />
			</div>
		</>
	);
}
