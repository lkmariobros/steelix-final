"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type * as React from "react";

import { SearchForm } from "@/components/search-form";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@/components/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { AuthSessionData } from "@/lib/auth-client";
import { useUserRole } from "@/hooks/use-user-role";
import {
	FINANCE_SIDEBAR_ITEMS,
	TRANSACTIONS_SIDEBAR_ITEMS,
} from "@/features/admin-transactions/segment-config";
import { trpc } from "@/utils/trpc";
import { TeamSwitcher } from "@/components/team-switcher";
import { formatDistanceToNow } from "date-fns";
import {
	RiArrowRightLine,
	RiBarChartBoxLine,
	RiBuilding2Line,
	RiCalendarLine,
	RiContactsBookLine,
	RiDashboardLine,
	RiExchangeDollarLine,
	RiFileChartLine,
	RiFileList3Line,
	RiFolderCloudLine,
	RiGiftLine,
	RiHandCoinLine,
	RiHistoryLine,
	RiKey2Line,
	RiMessage2Line,
	RiMoneyDollarCircleLine,
	RiNotificationLine,
	RiPercentLine,
	RiPriceTag3Line,
	RiPushpinLine,
	RiRobotLine,
	RiSettings3Line,
	RiShieldCheckLine,
	RiTeamLine,
	RiUserFollowLine,
	RiWallet3Line,
	RiWhatsappLine,
} from "@remixicon/react";

const data = {
	teams: [],
};

type NavIcon = typeof RiDashboardLine;

const TRANSACTION_ICONS: Record<
	(typeof TRANSACTIONS_SIDEBAR_ITEMS)[number]["title"],
	NavIcon
> = {
	"New Project": RiBuilding2Line,
	Subsale: RiExchangeDollarLine,
	Rental: RiKey2Line,
	Approvals: RiShieldCheckLine,
	Requests: RiMessage2Line,
};

const FINANCE_ICONS: Record<
	(typeof FINANCE_SIDEBAR_ITEMS)[number]["title"],
	NavIcon
> = {
	"Commission approvals": RiHandCoinLine,
	Incentive: RiGiftLine,
	"Commission payout": RiWallet3Line,
};

type NavItem = {
	title: string;
	url: string;
	icon: NavIcon;
};

type NavGroup =
	| {
			title: string;
			items: NavItem[];
	  }
	| {
			title: string;
			isTransactionsGroup: true;
	  }
	| {
			title: string;
			isFinanceGroup: true;
	  };

function AnnouncementNotification({
	open,
	onOpenChange,
	session,
}: {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	session: AuthSessionData | null;
}) {
	const pathname = usePathname();
	const router = useRouter();
	const isCurrentlyInAdminPortal = pathname.startsWith("/admin");

	const { data: announcementsData } = trpc.calendar.listAnnouncements.useQuery(
		{ includeExpired: false, includeInactive: false },
		{
			enabled: !!session && !isCurrentlyInAdminPortal,
			refetchInterval: 30000,
		},
	);

	const announcements = announcementsData?.announcements || [];
	const announcementCount = announcements.length;

	const formatDate = (date: Date | string) => {
		try {
			const dateObj = typeof date === "string" ? new Date(date) : date;
			return formatDistanceToNow(dateObj, { addSuffix: true });
		} catch {
			return "";
		}
	};

	const getPriorityColor = (priority: string) => {
		switch (priority) {
			case "urgent":
				return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
			case "high":
				return "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400";
			case "normal":
				return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
			case "low":
				return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
			default:
				return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
		}
	};

	if (isCurrentlyInAdminPortal) {
		return null;
	}

	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="relative h-8 w-8 shrink-0 rounded-md p-0 hover:bg-sidebar-accent"
				>
					<RiNotificationLine
						className="size-4 text-muted-foreground/70"
						aria-hidden="true"
					/>
					{announcementCount > 0 && (
						<Badge
							variant="destructive"
							className="absolute -top-1 -right-1 h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px]"
						>
							{announcementCount}
						</Badge>
					)}
					<span className="sr-only">View announcements</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				side="right"
				className="-translate-y-[5px] max-h-[400px] w-80 overflow-y-auto p-0"
			>
				<div className="border-b p-4">
					<div className="flex items-center justify-between">
						<h3 className="font-semibold text-sm">Office Announcements</h3>
						{announcementCount > 0 && (
							<Badge variant="secondary" className="text-xs">
								{announcementCount}
							</Badge>
						)}
					</div>
				</div>
				<div className="p-2">
					{announcements.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-8 text-center">
							<RiNotificationLine className="mb-2 size-8 text-muted-foreground" />
							<p className="text-muted-foreground text-sm">No announcements</p>
						</div>
					) : (
						<div className="space-y-2">
							{announcements.map((announcement) => (
								<div
									key={announcement.id}
									className="cursor-pointer rounded-md border bg-muted/30 p-3 transition-colors hover:bg-muted/50"
									onClick={() => router.push("/dashboard/calendar")}
								>
									<div className="mb-1.5 flex items-start justify-between gap-2">
										<div className="flex min-w-0 flex-1 items-center gap-1.5">
											{announcement.isPinned && (
												<RiPushpinLine className="size-3.5 shrink-0 text-yellow-500" />
											)}
											<h4 className="truncate font-medium text-sm">
												{announcement.title}
											</h4>
										</div>
										<Badge
											className={`${getPriorityColor(announcement.priority || "normal")} shrink-0 text-xs`}
										>
											{announcement.priority || "normal"}
										</Badge>
									</div>
									<p className="mb-1.5 line-clamp-2 text-muted-foreground text-xs">
										{announcement.content}
									</p>
									<div className="text-muted-foreground text-xs">
										{formatDate(announcement.createdAt)}
										{announcement.expiresAt && (
											<span> • Expires {formatDate(announcement.expiresAt)}</span>
										)}
									</div>
								</div>
							))}
						</div>
					)}
					{announcements.length > 0 && (
						<div className="mt-2 border-t pt-2">
							<Button
								variant="ghost"
								size="sm"
								className="w-full justify-between text-xs"
								onClick={() => router.push("/dashboard/calendar")}
							>
								View all announcements
								<RiArrowRightLine className="size-3.5" />
							</Button>
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}

function isNavItemActive(
	pathname: string,
	url: string,
	searchParams?: { get: (key: string) => string | null },
): boolean {
	if (!url || url === "#") return false;
	if (url === "/admin") {
		return pathname === "/admin" || pathname === "/admin/";
	}
	if (url === "/dashboard") {
		return pathname === "/dashboard" || pathname === "/dashboard/";
	}
	if (
		url === "/admin/approvals/requests" ||
		url.startsWith("/admin/approvals/requests?")
	) {
		if (!searchParams || !url.includes("?")) {
			return pathname === "/admin/approvals/requests";
		}
		const urlParams = new URLSearchParams(url.split("?")[1]);
		const segment = urlParams.get("segment");
		if (segment) {
			return (
				pathname === "/admin/approvals/requests" &&
				searchParams.get("segment") === segment
			);
		}
		return pathname === "/admin/approvals/requests";
	}
	if (url === "/admin/approvals" || url.startsWith("/admin/approvals?")) {
		if (!searchParams || !url.includes("?")) {
			return pathname === "/admin/approvals";
		}
		const urlParams = new URLSearchParams(url.split("?")[1]);
		const segment = urlParams.get("segment");
		if (segment) {
			return (
				pathname === "/admin/approvals" &&
				searchParams.get("segment") === segment
			);
		}
		return pathname === "/admin/approvals";
	}
	if (url.startsWith("/admin/commissions?")) {
		if (pathname !== "/admin/commissions" || !searchParams) return false;
		const urlParams = new URLSearchParams(url.split("?")[1]);
		const status = urlParams.get("status");
		if (status) {
			return searchParams.get("status") === status;
		}
		return !searchParams.get("status");
	}
	if (url === "/admin/commissions") {
		return (
			pathname === "/admin/commissions" &&
			(!searchParams || !searchParams.get("status"))
		);
	}

	const [path, query] = url.split("?");
	const pathMatch = pathname === path || pathname.startsWith(`${path}/`);
	if (!pathMatch) return false;
	if (!query || !searchParams) return true;

	const urlParams = new URLSearchParams(query);
	const segment = urlParams.get("segment");
	if (segment) {
		return searchParams.get("segment") === segment;
	}
	return true;
}

function NavLink({
	title,
	url,
	icon: Icon,
	isActive,
}: {
	title: string;
	url: string;
	icon: NavIcon;
	isActive: boolean;
}) {
	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				asChild
				tooltip={title}
				isActive={isActive}
				className="h-9 justify-start gap-3 font-medium data-[active=true]:bg-primary/15 data-[active=true]:text-primary"
			>
				<Link href={url}>
					<Icon
						className="size-[18px] shrink-0 text-muted-foreground/70 group-data-[active=true]/menu-button:text-primary"
						aria-hidden="true"
					/>
					<span className="group-data-[collapsible=icon]:hidden">{title}</span>
				</Link>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const router = useRouter();
	const [isAnnouncementPopoverOpen, setIsAnnouncementPopoverOpen] =
		useState(false);
	const { session, hasAdminAccess } = useUserRole();
	const isCurrentlyInAdminPortal = pathname.startsWith("/admin");

	const navigationItems: NavGroup[] =
		isCurrentlyInAdminPortal && hasAdminAccess
			? [
					{
						title: "Overview",
						items: [
							{ title: "Dashboard", url: "/admin", icon: RiDashboardLine },
							{
								title: "Leads",
								url: "/admin/leads",
								icon: RiContactsBookLine,
							},
						],
					},
					{
						title: "Transactions",
						isTransactionsGroup: true,
					},
					{
						title: "Finance",
						isFinanceGroup: true,
					},
					{
						title: "Management",
						items: [
							{
								title: "Agent management",
								url: "/admin/agents",
								icon: RiTeamLine,
							},
							{
								title: "eRecruitment Approval",
								url: "/admin/erecruitment",
								icon: RiUserFollowLine,
							},
							{
								title: "Lead Categories",
								url: "/admin/tags",
								icon: RiPriceTag3Line,
							},
							{
								title: "Office calendar",
								url: "/admin/calendar",
								icon: RiCalendarLine,
							},
							{
								title: "Files",
								url: "/admin/files",
								icon: RiFolderCloudLine,
							},
						],
					},
					{
						title: "Configuration",
						items: [
							{
								title: "Settings",
								url: "/admin/settings",
								icon: RiSettings3Line,
							},
							{
								title: "Commission settings",
								url: "/admin/commission-settings",
								icon: RiPercentLine,
							},
							{
								title: "Primary schemes",
								url: "/admin/commission-schemes",
								icon: RiFileChartLine,
							},
							{
								title: "Reports & analytics",
								url: "/admin/reports",
								icon: RiBarChartBoxLine,
							},
							{
								title: "Record Log",
								url: "/admin/record-log",
								icon: RiHistoryLine,
							},
						],
					},
				]
			: [
					{
						title: "Agent",
						items: [
							{
								title: "Dashboard",
								url: "/dashboard",
								icon: RiDashboardLine,
							},
							{
								title: "My leads",
								url: "/dashboard/leads",
								icon: RiContactsBookLine,
							},
							{
								title: "My transactions",
								url: "/dashboard/transactions",
								icon: RiFileList3Line,
							},
							{
								title: "My commissions",
								url: "/dashboard/commissions",
								icon: RiMoneyDollarCircleLine,
							},
						],
					},
					{
						title: "Tools",
						items: [
							{
								title: "WhatsApp",
								url: "/dashboard/whatsapp",
								icon: RiWhatsappLine,
							},
							{
								title: "Auto-reply",
								url: "/dashboard/auto-reply",
								icon: RiRobotLine,
							},
							{
								title: "Calendar",
								url: "/dashboard/calendar",
								icon: RiCalendarLine,
							},
							{
								title: "Files",
								url: "/dashboard/files",
								icon: RiFolderCloudLine,
							},
							{
								title: "eRecruitment",
								url: "/dashboard/erecruitment",
								icon: RiUserFollowLine,
							},
							{
								title: "Settings",
								url: "/dashboard/settings",
								icon: RiSettings3Line,
							},
						],
					},
				];

	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<TeamSwitcher teams={data.teams} />
				<hr className="-mt-px mx-2 border-border border-t group-data-[collapsible=icon]:hidden" />
				<SearchForm className="mt-3 group-data-[collapsible=icon]:hidden" />
			</SidebarHeader>
			<SidebarContent>
				{navigationItems.map((item) => (
					<SidebarGroup key={item.title}>
						<SidebarGroupLabel className="text-muted-foreground/60 uppercase">
							{item.title}
						</SidebarGroupLabel>
						<SidebarGroupContent className="px-2 group-data-[collapsible=icon]:px-0">
							{"isTransactionsGroup" in item && item.isTransactionsGroup ? (
								<SidebarMenu>
									{TRANSACTIONS_SIDEBAR_ITEMS.map((menuItem) => (
										<NavLink
											key={menuItem.url}
											title={menuItem.title}
											url={menuItem.url}
											icon={TRANSACTION_ICONS[menuItem.title]}
											isActive={isNavItemActive(
												pathname,
												menuItem.url,
												searchParams,
											)}
										/>
									))}
								</SidebarMenu>
							) : "isFinanceGroup" in item && item.isFinanceGroup ? (
								<SidebarMenu>
									{FINANCE_SIDEBAR_ITEMS.map((menuItem) => (
										<NavLink
											key={menuItem.url}
											title={menuItem.title}
											url={menuItem.url}
											icon={FINANCE_ICONS[menuItem.title]}
											isActive={isNavItemActive(
												pathname,
												menuItem.url,
												searchParams,
											)}
										/>
									))}
								</SidebarMenu>
							) : (
								<SidebarMenu>
									{"items" in item &&
										item.items.map((menuItem) => (
											<NavLink
												key={menuItem.title}
												title={menuItem.title}
												url={menuItem.url}
												icon={menuItem.icon}
												isActive={isNavItemActive(
													pathname,
													menuItem.url,
													searchParams,
												)}
											/>
										))}
								</SidebarMenu>
							)}
						</SidebarGroupContent>
					</SidebarGroup>
				))}
			</SidebarContent>
			{!isCurrentlyInAdminPortal ? (
				<SidebarFooter>
					<div className="flex items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
						<AnnouncementNotification
							open={isAnnouncementPopoverOpen}
							onOpenChange={setIsAnnouncementPopoverOpen}
							session={session}
						/>
						<button
							type="button"
							className="truncate text-left text-sm group-data-[collapsible=icon]:hidden"
							onClick={() => router.push("/dashboard/calendar")}
						>
							Announcement
						</button>
					</div>
				</SidebarFooter>
			) : null}
			<SidebarRail />
		</Sidebar>
	);
}
