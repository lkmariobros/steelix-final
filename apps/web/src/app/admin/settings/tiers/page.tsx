"use client";

import { TierConfigurationManager } from "@/components/admin/tier-configuration-manager";
import { HeaderActions } from "@/components/header-actions";
import {
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
import { authClient } from "@/lib/auth-client";
import { RiDashboardLine, RiSettings3Line } from "@remixicon/react";
export default function TierConfigurationPage() {
	authClient.useSession();

	return (
		<>
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
									<BreadcrumbLink href="/admin/commission-settings">
										Secondary Commission Setting
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator className="hidden md:block" />
								<BreadcrumbItem>
									<BreadcrumbPage className="flex items-center gap-2">
										<RiSettings3Line size={20} aria-hidden="true" />
										Secondary Market Tiers
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
					<div className="mx-auto w-full max-w-5xl">
						<div className="mb-6 flex items-center gap-4">
							<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
								<RiSettings3Line className="h-6 w-6 text-primary" />
							</div>
							<div>
								<h1 className="font-bold text-3xl">Secondary Market Tiers</h1>
								<p className="text-muted-foreground">
									Agent tier commission splits (70/80/85/90), leadership bonus
									from company share, and promotion rules — separate from
									primary schemes
								</p>
							</div>
						</div>
						<TierConfigurationManager />
					</div>
				</div>
		</>
	);
}
