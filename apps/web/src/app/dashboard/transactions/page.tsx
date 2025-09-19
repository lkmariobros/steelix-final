"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/separator";
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
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import UserDropdown from "@/components/user-dropdown";
import {
	RiAddLine,
	RiDashboardLine,
	RiDownloadLine,
	RiFileTextLine,
	RiRefreshLine,
} from "@remixicon/react";
import { useEffect, useState } from "react";

export default function TransactionsPage() {
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [currentTime, setCurrentTime] = useState<string>("");

	// Update time on client side only to avoid hydration mismatch
	useEffect(() => {
		setCurrentTime(new Date().toLocaleTimeString());
	}, []);

	// Handle refresh
	const handleRefresh = () => {
		window.location.reload();
	};

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
									<BreadcrumbLink href="/dashboard">
										<RiDashboardLine size={22} aria-hidden="true" />
										<span className="sr-only">Dashboard</span>
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator className="hidden md:block" />
								<BreadcrumbItem>
									<BreadcrumbPage className="flex items-center gap-2">
										<RiFileTextLine size={18} />
										Transactions
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
					{/* Transactions Page Header */}
					<div className="flex items-center justify-between gap-4">
						<div className="space-y-1">
							<h1 className="flex items-center gap-2 font-semibold text-2xl">
								<RiFileTextLine className="size-6" />
								Transactions
							</h1>
							<p className="text-muted-foreground text-sm">
								View and manage all your real estate transactions, commissions,
								and deal history.
							</p>
						</div>

						{/* Transaction Controls */}
						<div className="flex items-center gap-2">
							{/* Status Filter */}
							<Select value={statusFilter} onValueChange={setStatusFilter}>
								<SelectTrigger className="w-40">
									<SelectValue placeholder="Filter by status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Transactions</SelectItem>
									<SelectItem value="pending">Pending</SelectItem>
									<SelectItem value="approved">Approved</SelectItem>
									<SelectItem value="completed">Completed</SelectItem>
									<SelectItem value="cancelled">Cancelled</SelectItem>
								</SelectContent>
							</Select>

							{/* Refresh Button */}
							<Button variant="outline" size="sm" onClick={handleRefresh}>
								<RiRefreshLine className="size-4" />
							</Button>
						</div>
					</div>

					{/* Transactions Content */}
					<div className="grid gap-6">
						{/* Transaction Summary Cards */}
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="font-medium text-sm">
										Total Transactions
									</CardTitle>
									<RiFileTextLine className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="font-bold text-2xl">24</div>
									<p className="text-muted-foreground text-xs">
										+2 from last month
									</p>
								</CardContent>
							</Card>
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="font-medium text-sm">
										Pending Approval
									</CardTitle>
									<RiFileTextLine className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="font-bold text-2xl">3</div>
									<p className="text-muted-foreground text-xs">
										Awaiting review
									</p>
								</CardContent>
							</Card>
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="font-medium text-sm">
										Total Commission
									</CardTitle>
									<RiFileTextLine className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="font-bold text-2xl">$45,231</div>
									<p className="text-muted-foreground text-xs">
										+20.1% from last month
									</p>
								</CardContent>
							</Card>
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="font-medium text-sm">
										This Month
									</CardTitle>
									<RiFileTextLine className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="font-bold text-2xl">$12,234</div>
									<p className="text-muted-foreground text-xs">
										+15% from last month
									</p>
								</CardContent>
							</Card>
						</div>

						{/* Transaction List Placeholder */}
						<Card>
							<CardHeader>
								<CardTitle>Recent Transactions</CardTitle>
								<CardDescription>
									Your latest real estate transactions and their current status
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="py-8 text-center">
									<RiFileTextLine
										size={48}
										className="mx-auto mb-4 text-muted-foreground"
									/>
									<h3 className="mb-2 font-semibold text-lg">
										Transaction Management
									</h3>
									<p className="mb-4 text-muted-foreground">
										Your transaction history and management tools will be
										available here
									</p>
									<div className="flex justify-center gap-2">
										<Button variant="outline">
											<RiDownloadLine className="mr-2 h-4 w-4" />
											Export Transactions
										</Button>
										<Button>
											<RiAddLine className="mr-2 h-4 w-4" />
											Add Transaction
										</Button>
									</div>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Transactions Footer */}
					<div className="mt-8 border-t pt-6">
						<div className="flex items-center justify-between">
							<div className="text-muted-foreground text-sm">
								Transactions last updated: {currentTime || "Loading..."}
							</div>
							<div className="flex items-center gap-2">
								<Button variant="outline" size="sm">
									<RiDownloadLine className="mr-2 h-4 w-4" />
									Export Report
								</Button>
								<Button size="sm">
									<RiAddLine className="mr-2 h-4 w-4" />
									New Transaction
								</Button>
							</div>
						</div>
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
