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
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { RiDashboardLine, RiMoneyDollarCircleLine } from "@remixicon/react";

export default function AdminIncentivesPage() {
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
									<span className="sr-only">Admin</span>
								</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator className="hidden md:block" />
							<BreadcrumbItem>
								<BreadcrumbPage className="flex items-center gap-2">
									<RiMoneyDollarCircleLine size={18} aria-hidden="true" />
									Incentive
								</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				</div>
				<HeaderActions />
			</header>

			<div className="flex flex-1 flex-col gap-4 py-4 lg:gap-6 lg:py-6">
				<div className="space-y-1">
					<h1 className="flex items-center gap-2 font-semibold text-2xl">
						<RiMoneyDollarCircleLine className="size-6" />
						Incentive
					</h1>
					<p className="text-muted-foreground text-sm">
						Agent incentive programs and bonus tracking.
					</p>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Coming soon</CardTitle>
						<CardDescription>
							Incentive management will be available in a future update.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-muted-foreground text-sm">
							Use Commission approvals and Commission payout for commission
							workflows in the meantime.
						</p>
					</CardContent>
				</Card>
			</div>
		</>
	);
}
