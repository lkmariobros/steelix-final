"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/avatar";
import { HeaderActions } from "@/components/header-actions";
import {
	SettingsFieldRow,
	SettingsPageIntro,
	SettingsSectionTitle,
	ThemePicker,
	titleCaseWords,
} from "@/components/settings/settings-ui";
import { SidebarTrigger } from "@/components/sidebar";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";
import {
	RiArrowRightLine,
	RiBuilding2Line,
	RiDashboardLine,
	RiSettings3Line,
	RiTeamLine,
} from "@remixicon/react";
import Link from "next/link";

function initialsFromName(name: string) {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length >= 2) {
		return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
	}
	return name.substring(0, 2).toUpperCase() || "AD";
}

export default function AdminSettingsPage() {
	const { data: session } = authClient.useSession();
	const user = session?.user;
	const roleRaw = (user as { role?: string } | undefined)?.role || "User";
	const role = titleCaseWords(roleRaw.replaceAll("_", " "));
	const name = user?.name?.trim() || "Unknown";
	const email = user?.email?.trim() || null;

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
				<div className="mx-auto w-full max-w-3xl space-y-6">
					<SettingsPageIntro
						icon={<RiSettings3Line className="size-6" />}
						title="Admin Settings"
						description="Your account, theme, and commission configuration."
					/>

					<Card>
						<CardContent className="space-y-5 pt-6">
							<div className="flex flex-wrap items-center gap-4 rounded-xl border bg-muted/40 p-4">
								<Avatar className="size-16 border-2 border-background shadow-sm">
									<AvatarImage src={user?.image || undefined} />
									<AvatarFallback className="bg-primary/15 font-semibold text-base text-primary">
										{initialsFromName(name)}
									</AvatarFallback>
								</Avatar>
								<div className="min-w-0 flex-1">
									<p className="truncate font-semibold text-lg text-foreground">
										{name}
									</p>
									<p className="truncate text-foreground/75 text-sm">
										{email ?? "No email on file"}
									</p>
									<div className="mt-2 flex flex-wrap gap-2">
										<span className="inline-flex items-center rounded-md bg-primary/15 px-2.5 py-1 font-semibold text-primary text-xs">
											{role}
										</span>
										<span className="inline-flex items-center rounded-md bg-emerald-500/15 px-2.5 py-1 font-semibold text-emerald-700 text-xs dark:text-emerald-400">
											Session active
										</span>
									</div>
								</div>
							</div>

							<SettingsSectionTitle
								title="Account information"
								description="Read-only details from your signed-in admin account."
							/>
							<div className="rounded-xl border px-4">
								<SettingsFieldRow label="Admin user" value={name} />
								<SettingsFieldRow label="Role" value={role} />
								<SettingsFieldRow label="Email" value={email} />
								<SettingsFieldRow
									label="Session"
									value="Active"
									valueClassName="text-emerald-700 dark:text-emerald-400"
								/>
							</div>
							<p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-foreground/80 text-sm leading-relaxed">
								Advanced system configuration (database, security policies) is
								managed via environment variables, not this page.
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardContent className="space-y-4 pt-6">
							<SettingsSectionTitle
								title="Appearance"
								description="Applies across the portal, including login screens."
							/>
							<ThemePicker />
						</CardContent>
					</Card>

					<Card>
						<CardContent className="space-y-4 pt-6">
							<SettingsSectionTitle
								title="Commission settings"
								description="Primary and secondary markets use separate rules."
							/>
							<div className="grid gap-3 sm:grid-cols-2">
								<Link
									href="/admin/commission-schemes"
									className="group flex flex-col rounded-xl border-2 border-border bg-background p-4 transition-colors hover:border-primary hover:bg-primary/5"
								>
									<div className="mb-2 flex items-center justify-between gap-2">
										<div className="flex items-center gap-2">
											<span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
												<RiBuilding2Line className="size-5" />
											</span>
											<p className="font-semibold text-foreground">
												Primary market
											</p>
										</div>
										<RiArrowRightLine className="size-5 text-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
									</div>
									<p className="text-foreground/75 text-sm leading-relaxed">
										Project schemes, commission %, SST, and 4-layer upline override.
									</p>
									<p className="mt-3 font-medium text-primary text-sm">
										Open schemes
									</p>
								</Link>
								<Link
									href="/admin/commission-settings"
									className="group flex flex-col rounded-xl border-2 border-border bg-background p-4 transition-colors hover:border-primary hover:bg-primary/5"
								>
									<div className="mb-2 flex items-center justify-between gap-2">
										<div className="flex items-center gap-2">
											<span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
												<RiTeamLine className="size-5" />
											</span>
											<p className="font-semibold text-foreground">
												Secondary market
											</p>
										</div>
										<RiArrowRightLine className="size-5 text-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
									</div>
									<p className="text-foreground/75 text-sm leading-relaxed">
										Commission tier splits and leadership bonus rates.
									</p>
									<p className="mt-3 font-medium text-primary text-sm">
										Open tiers
									</p>
								</Link>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</>
	);
}
