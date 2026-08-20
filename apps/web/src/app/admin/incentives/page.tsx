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
import { Button } from "@/components/ui/button";
import { RiDashboardLine, RiGiftLine, RiMoneyDollarCircleLine } from "@remixicon/react";
import Link from "next/link";

export default function AdminIncentivesPage() {
	return (
		<>
			<header className="sticky top-0 z-40 -mx-4 flex h-16 shrink-0 items-center gap-2 border-border/60 border-b bg-background px-4 backdrop-blur-md supports-backdrop-filter:bg-background/95 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
				<div className="flex flex-1 items-center gap-2 px-1 sm:px-0">
					<SidebarTrigger className="-ms-1 rounded-xl" />
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
								<BreadcrumbPage className="flex items-center gap-2 font-medium">
									<span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
										<RiMoneyDollarCircleLine size={16} aria-hidden="true" />
									</span>
									Incentive
								</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				</div>
				<div className="ml-auto flex gap-2">
					<HeaderActions />
				</div>
			</header>

			<div className="flex min-h-[calc(100svh-4rem)] flex-1 flex-col items-center justify-center px-4 py-10">
				<div className="flex w-full max-w-xl flex-col items-center rounded-3xl border border-border/70 bg-card px-8 py-14 text-center shadow-card sm:px-12 sm:py-16">
					<span className="mb-6 flex size-20 items-center justify-center rounded-3xl bg-primary/15 text-primary shadow-sm sm:size-24">
						<RiGiftLine className="size-10 sm:size-12" aria-hidden="true" />
					</span>
					<p className="mb-2 font-semibold text-primary text-sm uppercase tracking-[0.2em]">
						Finance
					</p>
					<h1 className="font-bold text-3xl tracking-tight sm:text-4xl">
						Coming soon
					</h1>
					<p className="mt-4 max-w-md text-base text-muted-foreground leading-relaxed sm:text-lg">
						Incentive management will be available in a future update. Use
						Commission approvals and Commission payout for commission workflows
						in the meantime.
					</p>
					<div className="mt-8 flex flex-wrap items-center justify-center gap-3">
						<Button className="h-11 rounded-full px-6" asChild>
							<Link href="/admin/commissions?status=pending_approval">
								Commission approvals
							</Link>
						</Button>
						<Button
							variant="outline"
							className="h-11 rounded-full border-border/70 px-6 shadow-card"
							asChild
						>
							<Link href="/admin/commissions">Commission payout</Link>
						</Button>
					</div>
				</div>
			</div>
		</>
	);
}
