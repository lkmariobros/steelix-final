"use client";

import { HeaderActions } from "@/components/header-actions";
import { Separator } from "@/components/ui/separator";
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
import { Skeleton } from "@/components/ui/skeleton";
import { TierBadge } from "@/components/agent-tier/tier-badge";
import type { AgentTier } from "@/lib/agent-tier-config";
import { trpc } from "@/utils/trpc";
import { RiDashboardLine, RiHistoryLine } from "@remixicon/react";

export default function AdminRecordLogPage() {
	const { data: history, isLoading } = trpc.admin.getTierConfigHistory.useQuery({
		limit: 100,
	});

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
									<RiHistoryLine size={18} aria-hidden="true" />
									Record Log
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
						<RiHistoryLine className="size-6" />
						Record Log
					</h1>
					<p className="text-muted-foreground text-sm">
						Audit trail of configuration changes across the admin portal.
					</p>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Configuration changes</CardTitle>
						<CardDescription>
							Tier commission settings updates with who changed what and when.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<div className="space-y-3">
								{["sk-1", "sk-2", "sk-3"].map((id) => (
									<Skeleton key={id} className="h-16 w-full rounded-md" />
								))}
							</div>
						) : history && history.length > 0 ? (
							<div className="divide-y rounded-md border">
								{history.map((entry) => (
									<div
										key={entry.id}
										className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between"
									>
										<div className="space-y-1">
											<div className="flex flex-wrap items-center gap-2">
												<TierBadge tier={entry.tier as AgentTier} />
												<span className="font-medium text-sm">
													{entry.changeType === "create"
														? "Created"
														: "Updated"}{" "}
													tier configuration
												</span>
											</div>
											{entry.changeReason ? (
												<p className="text-muted-foreground text-sm">
													{entry.changeReason}
												</p>
											) : null}
										</div>
										<div className="shrink-0 text-muted-foreground text-sm">
											<p>{entry.changedByName ?? "Unknown"}</p>
											<p>
												{entry.timestamp
													? new Date(entry.timestamp).toLocaleString("en-MY", {
															day: "numeric",
															month: "short",
															year: "numeric",
															hour: "2-digit",
															minute: "2-digit",
														})
													: "—"}
											</p>
										</div>
									</div>
								))}
							</div>
						) : (
							<p className="py-8 text-center text-muted-foreground text-sm">
								No configuration changes recorded yet.
							</p>
						)}
					</CardContent>
				</Card>
			</div>
		</>
	);
}
