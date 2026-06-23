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
	RiBuilding2Line,
	RiDashboardLine,
	RiMoneyDollarCircleLine,
	RiTeamLine,
} from "@remixicon/react";
import Link from "next/link";

export default function CommissionSettingsPage() {
	const { data: session } = authClient.useSession();

	const { data: schemesData } = trpc.commissionSchemes.list.useQuery(
		{ includeInactive: false, limit: 200, offset: 0 },
		{ enabled: !!session, staleTime: 60_000 },
	);
	const { data: tierConfigs } = trpc.admin.getTierConfigurations.useQuery(
		undefined,
		{ enabled: !!session, staleTime: 60_000 },
	);

	const activeSchemeCount = schemesData?.schemes?.length ?? 0;
	const primarySchemeRates = (schemesData?.schemes ?? [])
		.slice(0, 6)
		.map((s) => {
			const activeTier =
				s.tiers?.find((t) => t.isActive) ?? s.tiers?.[0] ?? null;
			return {
				id: s.id,
				name: s.schemeName,
				project: s.projectName,
				commission: activeTier?.commissionPercent ?? null,
				override: activeTier?.overridePercent ?? null,
			};
		});
	const secondaryTiers = TIER_ORDER.map((tier) => {
		const config = tierConfigs?.find((c) => c.tier === tier);
		return {
			tier,
			label: config?.displayName ?? tier,
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
									<RiMoneyDollarCircleLine size={20} aria-hidden="true" />
									Commission Settings
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
						Commission Settings
					</h1>
					<p className="mt-1 max-w-3xl text-muted-foreground text-sm">
						Primary and secondary markets use separate commission rules and
						database tables. Adjust schemes here when rates change — approved
						deals keep their locked snapshot.
					</p>
				</div>

				<div className="grid gap-4 lg:grid-cols-2">
					<Card className="flex flex-col">
						<CardHeader>
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
									<RiBuilding2Line className="h-5 w-5 text-primary" />
								</div>
								<div>
									<CardTitle>Primary Market</CardTitle>
									<CardDescription>
										Project / developer commission schemes
									</CardDescription>
								</div>
							</div>
						</CardHeader>
						<CardContent className="flex flex-1 flex-col gap-4">
							<ul className="space-y-2 text-sm">
								<li>
									<span className="font-medium">Agent entitlement:</span> 100% of
									announced scheme commission
								</li>
								<li>
									<span className="font-medium">Upline override:</span> separate
									override % per scheme tier (paid to recruiter / team leader)
								</li>
								<li>
									<span className="font-medium">Storage:</span>{" "}
									<code className="text-xs">commission_schemes</code> tables
								</li>
							</ul>
							<p className="text-muted-foreground text-sm">
								{activeSchemeCount} active scheme
								{activeSchemeCount === 1 ? "" : "s"} configured
							</p>
							{primarySchemeRates.length > 0 ? (
								<div className="rounded-md border bg-muted/30 p-3 text-sm">
									<p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
										Commission & upline override
									</p>
									<div className="space-y-2">
										{primarySchemeRates.map((s) => (
											<div
												key={s.id}
												className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b pb-2 last:border-0 last:pb-0"
											>
												<span className="min-w-0 truncate">
													{s.name}
													<span className="text-muted-foreground">
														{" "}
														· {s.project}
													</span>
												</span>
												<span className="shrink-0 font-medium tabular-nums">
													{s.commission != null ? `${s.commission}%` : "—"} /{" "}
													<span className="text-primary">
														override{" "}
														{s.override != null ? `${s.override}%` : "—"}
													</span>
												</span>
											</div>
										))}
									</div>
									<p className="mt-2 text-muted-foreground text-xs">
										Edit upline override % in Primary schemes → Edit scheme →
										Commission rate tiers.
									</p>
								</div>
							) : null}
							<Button asChild className="mt-auto w-fit">
								<Link href="/admin/commission-schemes">
									Manage primary schemes
									<RiArrowRightLine className="ml-1.5 size-4" />
								</Link>
							</Button>
						</CardContent>
					</Card>

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
								<div className="grid grid-cols-2 gap-x-4 gap-y-1">
									{secondaryTiers.map(({ tier, label, split }) => (
										<div key={tier} className="flex justify-between gap-2">
											<span>{label}</span>
											<span className="font-medium tabular-nums">
												{typeof split === "number" ? `${split}%` : split}
											</span>
										</div>
									))}
								</div>
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
