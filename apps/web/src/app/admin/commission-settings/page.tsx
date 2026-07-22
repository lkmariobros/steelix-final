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
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
									<RiPercentLine size={20} aria-hidden="true" />
									Secondary Commission Setting
								</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				</div>
				<div className="ml-auto flex gap-3">
					<HeaderActions />
				</div>
			</header>

			<div className="flex flex-1 flex-col gap-6 py-6">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">
						Secondary Commission Setting
					</h1>
					<p className="mt-1 max-w-3xl text-muted-foreground text-sm">
						Configure secondary market agent tier splits and leadership bonus.
						Primary market schemes are managed separately.
					</p>
				</div>

				{/* Layout matches Secondary Market card mockup */}
				<div className="max-w-xl">
					<Card className="flex flex-col">
						<CardHeader>
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
									<RiTeamLine className="h-5 w-5 text-primary" />
								</div>
								<div>
									<CardTitle>Secondary Market</CardTitle>
									<CardDescription>
										Agent tier commission splits
									</CardDescription>
								</div>
							</div>
						</CardHeader>
						<CardContent className="flex flex-1 flex-col gap-4">
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
							<div className="rounded-md border bg-muted/30 p-3 text-sm">
								<p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
									Current tier splits
								</p>
								{isLoading ? (
									<p className="text-muted-foreground text-xs">Loading…</p>
								) : (
									<div className="grid grid-cols-2 gap-x-4 gap-y-1">
										{secondaryTiers.map(({ tier, label, split }) => (
											<div key={tier} className="flex justify-between gap-2">
												<span className="capitalize">{label}</span>
												<span className="font-medium tabular-nums">
													{typeof split === "number" ? `${split}%` : split}
												</span>
											</div>
										))}
									</div>
								)}
							</div>
							<Button asChild className="mt-auto w-fit" variant="outline">
								<Link href="/admin/settings/tiers">
									Manage secondary tiers
									<RiArrowRightLine className="ml-1.5 size-4" />
								</Link>
							</Button>
						</CardContent>
					</Card>
				</div>
			</div>
		</>
	);
}
