"use client";

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
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";
import {
	RiArrowRightLine,
	RiBuilding2Line,
	RiDashboardLine,
	RiMoneyDollarCircleLine,
	RiSettings3Line,
	RiTeamLine,
} from "@remixicon/react";
import Link from "next/link";
export default function AdminSettingsPage() {
	const { data: session } = authClient.useSession();

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
					<HeaderActions />
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
								Account information and commission configuration
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
										<p className="mt-1 font-medium">
											{session?.user?.name || "Unknown"}
										</p>
									</div>
									<div className="rounded-lg border bg-muted/50 p-3">
										<p className="text-muted-foreground">Role</p>
										<p className="mt-1 font-medium capitalize">
											{(session?.user as { role?: string })?.role || "User"}
										</p>
									</div>
									<div className="rounded-lg border bg-muted/50 p-3">
										<p className="text-muted-foreground">Email</p>
										<p className="mt-1 font-medium">
											{session?.user?.email || "Unknown"}
										</p>
									</div>
									<div className="rounded-lg border bg-muted/50 p-3">
										<p className="text-muted-foreground">Session Status</p>
										<p className="mt-1 font-medium text-green-600">Active</p>
									</div>
								</div>
								<p className="mt-4 text-muted-foreground text-xs">
									For advanced system configuration (database settings, security
									policies, etc.), please contact your system administrator or
									modify environment variables directly.
								</p>
							</CardContent>
						</Card>

						<Card className="mt-6">
							<CardHeader>
								<CardTitle>Commission configuration</CardTitle>
								<CardDescription>
									Primary and secondary markets use separate rules — adjust
									schemes and tier splits without mixing markets
								</CardDescription>
							</CardHeader>
							<CardContent className="grid gap-4 sm:grid-cols-2">
								<div className="rounded-lg border p-4">
									<div className="mb-2 flex items-center gap-2">
										<RiBuilding2Line className="size-5 text-primary" />
										<p className="font-medium">Primary market schemes</p>
									</div>
									<p className="mb-3 text-muted-foreground text-sm">
										Project commission %, SST rules, and upline override %
									</p>
									<Button asChild size="sm" variant="outline">
										<Link href="/admin/commission-schemes">
											Open schemes
											<RiArrowRightLine className="ml-1 size-4" />
										</Link>
									</Button>
								</div>
								<div className="rounded-lg border p-4">
									<div className="mb-2 flex items-center gap-2">
										<RiTeamLine className="size-5 text-primary" />
										<p className="font-medium">Secondary market tiers</p>
									</div>
									<p className="mb-3 text-muted-foreground text-sm">
										Agent tier splits (70/80/85/90) and leadership bonus rates
									</p>
									<Button asChild size="sm" variant="outline">
										<Link href="/admin/settings/tiers">
											Open tier config
											<RiArrowRightLine className="ml-1 size-4" />
										</Link>
									</Button>
								</div>
								<div className="sm:col-span-2">
									<Button asChild variant="secondary">
										<Link href="/admin/commission-settings">
											<RiMoneyDollarCircleLine className="mr-1.5 size-4" />
											Commission settings overview
										</Link>
									</Button>
								</div>
							</CardContent>
						</Card>
				</div>
			</div>
		</>
	);
}
