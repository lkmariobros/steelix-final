"use client";

import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
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
import { authClient } from "@/lib/auth-client";
import { useUserRole } from "@/hooks/use-user-role";
import { PORTAL_PATHS } from "@/lib/user-role";
import { trpc } from "@/utils/trpc";
import { TeamSwitcher } from "@/components/team-switcher";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
	RiBarChartLine,
	RiCheckboxCircleLine,
	RiCalendarLine,
	RiDashboardLine,
	RiFileList3Line,
	RiFileTextLine,
	RiLogoutBoxLine,
	RiSettings3Line,
	RiTeamLine,
	RiUserLine,
	RiMessageLine,
	RiRobotLine,
	RiPriceTagLine,
	RiNotificationLine,
	RiMoneyDollarCircleLine,
	RiPushpinLine,
	RiArrowRightLine,
} from "@remixicon/react";

// Clean data structure - no mock teams
const data = {
	teams: [],
};

// Component for notification bell with announcements popover
function AnnouncementNotification({ 
	open, 
	onOpenChange 
}: { 
	open?: boolean; 
	onOpenChange?: (open: boolean) => void;
}) {
	const pathname = usePathname();
	const router = useRouter();
	const { data: session } = authClient.useSession();
	const isCurrentlyInAdminPortal = pathname.startsWith("/admin");
	
	// Only show for agent portal, not admin portal
	const { data: announcementsData } = trpc.calendar.listAnnouncements.useQuery(
		{ includeExpired: false, includeInactive: false },
		{ 
			enabled: !!session && !isCurrentlyInAdminPortal,
			refetchInterval: 30000, // Refetch every 30 seconds
		}
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

	// Don't show if in admin portal
	if (isCurrentlyInAdminPortal) {
		return null;
	}

	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="relative h-9 w-9 rounded-md p-0 hover:bg-sidebar-accent"
				>
					<RiNotificationLine
						className="text-muted-foreground/60 size-5"
						aria-hidden="true"
					/>
					{announcementCount > 0 && (
						<Badge
							variant="destructive"
							className="absolute -right-1 -top-1 h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs"
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
				className="w-80 max-h-[400px] overflow-y-auto p-0 -translate-y-[5px]"
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
									className="rounded-md border bg-muted/30 p-3 hover:bg-muted/50 transition-colors cursor-pointer"
									onClick={() => router.push("/dashboard/calendar")}
								>
									<div className="flex items-start justify-between gap-2 mb-1.5">
										<div className="flex items-center gap-1.5 flex-1 min-w-0">
											{announcement.isPinned && (
												<RiPushpinLine className="size-3.5 text-yellow-500 shrink-0" />
											)}
											<h4 className="font-medium text-sm truncate">
												{announcement.title}
											</h4>
										</div>
										<Badge
											className={`${getPriorityColor(announcement.priority || "normal")} shrink-0 text-xs`}
										>
											{announcement.priority || "normal"}
										</Badge>
									</div>
									<p className="text-muted-foreground text-xs line-clamp-2 mb-1.5">
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

function isNavItemActive(pathname: string, url: string): boolean {
	if (!url || url === "#") return false;
	if (url === "/admin") {
		return pathname === "/admin" || pathname === "/admin/";
	}
	if (url === "/dashboard") {
		return pathname === "/dashboard" || pathname === "/dashboard/";
	}
	return pathname === url || pathname.startsWith(`${url}/`);
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const pathname = usePathname();
	const router = useRouter();
	const [isAnnouncementPopoverOpen, setIsAnnouncementPopoverOpen] = useState(false);
	const { data: session } = authClient.useSession();

	const handleSignOut = useCallback(async () => {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					window.location.href = "/login";
				},
			},
		});
	}, []);

	const { hasAdminAccess } = useUserRole();
	const isCurrentlyInAdminPortal = pathname.startsWith("/admin");

	const portalSwitch =
		hasAdminAccess ? (
			<div className="px-2 pt-2">
				<Button
					variant="outline"
					size="sm"
					className="w-full justify-between"
					onClick={() =>
						window.location.assign(
							isCurrentlyInAdminPortal
								? PORTAL_PATHS.agent
								: PORTAL_PATHS.admin,
						)
					}
				>
					<span>
						{isCurrentlyInAdminPortal
							? "Switch to Agent Portal"
							: "Switch to Admin Portal"}
					</span>
					<RiArrowRightLine className="size-4" />
				</Button>
			</div>
		) : null;

	// Navigation follows the active portal (URL), not role alone
	const navigationItems = isCurrentlyInAdminPortal && hasAdminAccess
		? [
				{
					title: "Overview",
					url: "#",
					items: [
						{
							title: "Dashboard",
							url: "/admin",
							icon: RiDashboardLine,
						},
						{
							title: "Leads",
							url: "/admin/leads",
							icon: RiFileList3Line,
						},
						{
							title: "Transactions",
							url: "/admin/reports",
							icon: RiFileTextLine,
						},
						{
							title: "Commission approvals",
							url: "/admin/approvals",
							icon: RiCheckboxCircleLine,
						},
						{
							title: "All transactions",
							url: "/admin/transactions",
							icon: RiFileList3Line,
						},
						{
							title: "Commission payout",
							url: "/admin/commissions",
							icon: RiMoneyDollarCircleLine,
						},
					],
				},
				{
					title: "Management",
					url: "#",
					items: [
						{
							title: "Agent management",
							url: "/admin/agents",
							icon: RiTeamLine,
						},
						{
							title: "Tags",
							url: "/admin/tags",
							icon: RiPriceTagLine,
						},
						{
							title: "Office calendar",
							url: "/admin/calendar",
							icon: RiCalendarLine,
						},
					],
				},
				{
					title: "Configuration",
					url: "#",
					items: [
						{
							title: "Settings",
							url: "/admin/settings",
							icon: RiSettings3Line,
						},
						{
							title: "Commission schemes",
							url: "/admin/commission-schemes",
							icon: RiMoneyDollarCircleLine,
						},
						{
							title: "Reports & analytics",
							url: "/admin/reports",
							icon: RiBarChartLine,
						},
					],
				},
			]
		: [
				// Agent Portal Navigation
				{
					title: "Agent",
					url: "#",
					items: [
						{
							title: "Dashboard",
							url: "/dashboard",
							icon: RiDashboardLine,
						},
						{
							title: "My leads",
							url: "/dashboard/leads",
							icon: RiFileList3Line,
						},
						{
							title: "My transactions",
							url: "/dashboard/transactions",
							icon: RiFileTextLine,
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
					url: "#",
					items: [
						{
							title: "WhatsApp",
							url: "/dashboard/whatsapp",
							icon: RiMessageLine,
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
							title: "Settings",
							url: "/dashboard/settings",
							icon: RiSettings3Line,
						},
					],
				},
			];

	return (
		<Sidebar {...props}>
			<SidebarHeader>
				<TeamSwitcher teams={data.teams} />
				<hr className="-mt-px mx-2 border-border border-t" />
				<SearchForm className="mt-3" />
			</SidebarHeader>
			<SidebarContent>
				{/* We create a SidebarGroup for each parent. */}
				{navigationItems.map((item) => (
					<SidebarGroup key={item.title}>
						<SidebarGroupLabel className="text-muted-foreground/60 uppercase">
							{item.title}
						</SidebarGroupLabel>
						<SidebarGroupContent className="px-2">
							<SidebarMenu>
								{item.items.map((menuItem) => (
									<SidebarMenuItem key={menuItem.title}>
										<SidebarMenuButton
											asChild
											className="group/menu-button h-9 gap-3 rounded-md bg-gradient-to-r font-medium hover:bg-transparent hover:from-sidebar-accent hover:to-sidebar-accent/40 data-[active=true]:from-primary/20 data-[active=true]:to-primary/5 [&>svg]:size-auto"
											isActive={isNavItemActive(pathname, menuItem.url)}
										>
											<a href={menuItem.url} className="relative flex items-center justify-between w-full">
												<div className="flex items-center gap-3">
													{menuItem.icon && (
														<menuItem.icon
															className="text-muted-foreground/60 group-data-[active=true]/menu-button:text-primary"
															size={22}
															aria-hidden="true"
														/>
													)}
													<span>{menuItem.title}</span>
												</div>
											</a>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				))}
			</SidebarContent>
			<SidebarFooter>
				{/* Announcement button: only on agent dashboard, not admin */}
				{!isCurrentlyInAdminPortal && (
					<>
						<div className="flex flex-col gap-2 px-2 py-2">
							<div
								className="flex justify-start items-center gap-2 cursor-pointer hover:bg-sidebar-accent rounded-md p-1 transition-colors"
								onClick={() => router.push("/dashboard/calendar")}
							>
								<AnnouncementNotification
									open={isAnnouncementPopoverOpen}
									onOpenChange={setIsAnnouncementPopoverOpen}
								/>
								<span>Announcement</span>
							</div>
						</div>
						<hr className="-mt-px mx-2 border-border border-t" />
					</>
				)}
				<div className="flex flex-col gap-2 px-2 py-2">
					{/* Sign Out Button */}
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton
								type="button"
								className="h-9 gap-4 rounded-md bg-gradient-to-r font-medium hover:bg-transparent hover:from-sidebar-accent hover:to-sidebar-accent/40 data-[active=true]:from-primary/20 data-[active=true]:to-primary/5 [&>svg]:size-auto"
								onClick={() => void handleSignOut()}
							>
								<RiLogoutBoxLine
									className="text-muted-foreground/60 group-data-[active=true]/menu-button:text-primary"
									size={22}
									aria-hidden="true"
								/>
								<span>Sign Out</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</div>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
