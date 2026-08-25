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
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { TierBadge } from "@/components/agent-tier/tier-badge";
import type { AgentTier } from "@/lib/agent-tier-config";
import { formatDateTimeDMY } from "@/lib/date-format";
import { formatAccountRole } from "@/lib/user-role";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { RiDashboardLine, RiHistoryLine } from "@remixicon/react";
import { useMemo, useState } from "react";

type CategoryFilter = "all" | "configuration" | "transaction";

function actionBadgeClass(action: string) {
	switch (action) {
		case "create":
		case "tier_config_create":
			return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-300";
		case "save_draft":
			return "bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-200";
		case "update":
		case "tier_config_update":
			return "bg-sky-100 text-sky-800 dark:bg-sky-900/35 dark:text-sky-300";
		case "upload_document":
			return "bg-violet-100 text-violet-800 dark:bg-violet-900/35 dark:text-violet-300";
		case "submit":
			return "bg-amber-100 text-amber-800 dark:bg-amber-900/35 dark:text-amber-300";
		default:
			return "bg-muted text-muted-foreground";
	}
}

function formatActionLabel(action: string) {
	switch (action) {
		case "create":
			return "Create";
		case "save_draft":
			return "Save draft";
		case "update":
			return "Update / edit";
		case "upload_document":
			return "Upload document";
		case "submit":
			return "Submit";
		case "tier_config_create":
			return "Tier create";
		case "tier_config_update":
			return "Tier update";
		default:
			return action.replace(/_/g, " ");
	}
}

export default function AdminRecordLogPage() {
	const [category, setCategory] = useState<CategoryFilter>("all");

	const { data, isLoading } = trpc.admin.getRecordLog.useQuery({
		category,
		limit: 150,
	});

	const entries = data?.entries ?? [];
	const retentionDays = data?.retentionDays ?? 365;

	const subtitle = useMemo(
		() =>
			`Configuration changes and agent transaction actions (create, edit, save draft, upload document). Retained for ${retentionDays} days.`,
		[retentionDays],
	);

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
				<div className="flex flex-wrap items-end justify-between gap-3">
					<div className="space-y-1">
						<h1 className="flex items-center gap-2 font-semibold text-2xl">
							<RiHistoryLine className="size-6" />
							Record Log
						</h1>
						<p className="text-muted-foreground text-sm">{subtitle}</p>
					</div>
					<Select
						value={category}
						onValueChange={(v) => setCategory(v as CategoryFilter)}
					>
						<SelectTrigger className="w-[200px] rounded-full">
							<SelectValue placeholder="Filter" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All records</SelectItem>
							<SelectItem value="transaction">Transaction actions</SelectItem>
							<SelectItem value="configuration">Configuration</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Audit trail</CardTitle>
						<CardDescription>
							Tier commission settings and transaction case activity (who
							changed what and when).
						</CardDescription>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<div className="space-y-3">
								{["sk-1", "sk-2", "sk-3"].map((id) => (
									<Skeleton key={id} className="h-16 w-full rounded-md" />
								))}
							</div>
						) : entries.length > 0 ? (
							<div className="divide-y rounded-md border">
								{entries.map((entry) => {
									const tier =
										entry.category === "configuration" &&
										entry.metadata &&
										typeof entry.metadata === "object" &&
										"tier" in entry.metadata
											? String(
													(entry.metadata as { tier?: string }).tier ?? "",
												)
											: "";

									return (
										<div
											key={entry.id}
											className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between"
										>
											<div className="space-y-1">
												<div className="flex flex-wrap items-center gap-2">
													{tier ? (
														<TierBadge tier={tier as AgentTier} />
													) : (
														<Badge
															variant="secondary"
															className={cn(
																"rounded-full border-0 font-medium text-[11px]",
																actionBadgeClass(entry.action),
															)}
														>
															{formatActionLabel(entry.action)}
														</Badge>
													)}
													<span className="font-medium text-sm">
														{entry.summary}
													</span>
													{entry.caseNo ? (
														<span className="font-mono text-muted-foreground text-xs">
															{entry.caseNo}
														</span>
													) : null}
												</div>
												{entry.detail ? (
													<p className="text-muted-foreground text-sm">
														{entry.detail}
													</p>
												) : null}
											</div>
											<div className="shrink-0 text-muted-foreground text-sm">
												<p>
													{entry.actorName ?? "Unknown"}
													{entry.actorRole
														? ` · ${formatAccountRole(entry.actorRole)}`
														: ""}
												</p>
												<p>
													{entry.createdAt
														? formatDateTimeDMY(entry.createdAt)
														: "—"}
												</p>
											</div>
										</div>
									);
								})}
							</div>
						) : (
							<p className="py-8 text-center text-muted-foreground text-sm">
								No record log entries in the last {retentionDays} days.
							</p>
						)}
					</CardContent>
				</Card>
			</div>
		</>
	);
}
