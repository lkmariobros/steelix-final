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
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TIER_ORDER } from "@/lib/agent-tier-config";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import {
	RiArrowRightLine,
	RiDashboardLine,
	RiPercentLine,
	RiTeamLine,
} from "@remixicon/react";
import Link from "next/link";

const TIER_SKELETON_IDS = [
	"sk-tier-1",
	"sk-tier-2",
	"sk-tier-3",
	"sk-tier-4",
	"sk-tier-5",
] as const;

/**
 * Secondary Commission Setting — Secondary Market card layout.
 * Tier split values come from `agent_tier_config` (editable via Manage).
 * Primary schemes live at /admin/commission-schemes.
 */
export default function SecondaryCommissionSettingPage() {
	const { data: session } = authClient.useSession();

	const { data: tierConfigs, isLoading } =
		trpc.admin.getTierConfigurations.useQuery(undefined, {
			enabled: !!session,
			staleTime: 60_000,
		});

	const secondaryTiers = TIER_ORDER.map((tier) => {
		const config = tierConfigs?.find((c) => c.tier === tier);
		return {
			tier,
			label: config?.displayName ?? tier.replace(/_/g, " "),
			split: config?.commissionSplit ?? "—",
		};
	});

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
									<span className="sr-only">Admin Dashboard</span>
								</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator className="hidden md:block" />
							<BreadcrumbItem>
								<BreadcrumbPage className="flex items-center gap-2 font-medium">
									<span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
										<RiPercentLine size={16} aria-hidden="true" />
									</span>
									Secondary Commission Setting
								</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				</div>
				<div className="ml-auto flex gap-2">
					<HeaderActions />
				</div>
			</header>

			<div className="flex flex-1 flex-col gap-5 py-5 lg:gap-6 lg:py-7">
				<div className="space-y-1">
					<h1 className="font-bold text-2xl tracking-tight">
						Secondary Commission Setting
					</h1>
					<p className="mt-1 max-w-3xl text-muted-foreground text-sm">
						Configure secondary market agent tier splits and leadership bonus.
						Primary market schemes are managed separately.
					</p>
				</div>

				<div className="max-w-xl">
					{isLoading ? (
						<Card className="flex flex-col gap-0 overflow-hidden rounded-3xl border-border/50 py-0 shadow-card">
							<CardHeader className="border-border/40 border-b px-5 py-4">
								<div className="flex items-center gap-3">
									<Skeleton className="size-10 rounded-xl" />
									<div className="space-y-2">
										<Skeleton className="h-5 w-40" />
										<Skeleton className="h-3.5 w-48" />
									</div>
								</div>
							</CardHeader>
							<CardContent className="flex flex-1 flex-col gap-4 px-5 py-5">
								<div className="space-y-2.5">
									<Skeleton className="h-4 w-full max-w-sm" />
									<Skeleton className="h-4 w-full max-w-md" />
									<Skeleton className="h-4 w-48" />
								</div>
								<div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
									<Skeleton className="mb-3 h-3 w-32" />
									<div className="grid grid-cols-2 gap-x-4 gap-y-3">
										{TIER_SKELETON_IDS.map((id) => (
											<div
												key={id}
												className="flex items-center justify-between gap-2"
											>
												<Skeleton className="h-4 w-24" />
												<Skeleton className="h-4 w-10" />
											</div>
										))}
									</div>
								</div>
								<Skeleton className="mt-1 h-9 w-48 rounded-full" />
							</CardContent>
						</Card>
					) : (
						<Card className="flex flex-col gap-0 overflow-hidden rounded-3xl border-border/50 py-0 shadow-card">
							<CardHeader className="border-border/40 border-b px-5 py-4">
								<div className="flex items-center gap-3">
									<div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
										<RiTeamLine className="size-5 text-primary" />
									</div>
									<div>
										<CardTitle className="text-base">Secondary Market</CardTitle>
										<CardDescription>
											Agent tier commission splits
										</CardDescription>
									</div>
								</div>
							</CardHeader>
							<CardContent className="flex flex-1 flex-col gap-4 px-5 py-5">
								<ul className="space-y-2 text-sm">
									<li>
										<span className="font-medium">Agent split:</span> tier-based
										percentage (default 70 / 80 / 85 / 90)
									</li>
									<li>
										<span className="font-medium">Leadership bonus:</span> upline
										share from company portion (secondary only)
									</li>
									<li>
										<span className="font-medium">Storage:</span>{" "}
										<code className="text-xs">agent_tier_config</code> table
									</li>
								</ul>
								<div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm">
									<p className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
										Current tier splits
									</p>
									<div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
										{secondaryTiers.map(({ tier, label, split }) => (
											<div
												key={tier}
												className="flex justify-between gap-2"
											>
												<span className="capitalize">{label}</span>
												<span className="font-medium tabular-nums">
													{typeof split === "number" ? `${split}%` : split}
												</span>
											</div>
										))}
									</div>
								</div>
								<Button
									asChild
									className="mt-auto w-fit rounded-full"
									variant="outline"
								>
									<Link href="/admin/settings/tiers">
										Manage secondary tiers
										<RiArrowRightLine className="ml-1.5 size-4" />
									</Link>
								</Button>
							</CardContent>
						</Card>
					)}
				</div>
			</div>
		</>
	);
}
