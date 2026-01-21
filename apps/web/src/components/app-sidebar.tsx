"use client";

import { usePathname } from "next/navigation";
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
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { TeamSwitcher } from "@/components/team-switcher";
import {
	RiBarChartLine,
	RiCheckboxCircleLine,
	RiCalendarLine,
	RiDashboardLine,
	RiFileTextLine,
	RiLogoutBoxLine,
	RiSettings3Line,
	RiTeamLine,
	RiUserLine,
	RiMessageLine,
	RiRobotLine,
	RiPriceTagLine,
} from "@remixicon/react";

// Clean data structure - no mock teams
const data = {
	teams: [],
};

// Component to show announcement count badge
function AnnouncementBadge() {
	const pathname = usePathname();
	const { data: session } = authClient.useSession();
	const isCurrentlyInAdminPortal = pathname.startsWith("/admin");
	
	// Only show badge for agent portal, not admin portal
	const { data: announcementsData } = trpc.calendar.listAnnouncements.useQuery(
		{ includeExpired: false, includeInactive: false },
		{ 
			enabled: !!session && !isCurrentlyInAdminPortal,
			refetchInterval: 30000, // Refetch every 30 seconds
		}
	);

	const announcementCount = announcementsData?.announcements?.length || 0;

	if (announcementCount === 0) {
		return null;
	}

	return (
		<Badge 
			variant="destructive" 
			className="ml-auto h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs"
		>
			{announcementCount}
		</Badge>
	);
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const pathname = usePathname();

	// Path-based navigation logic - no role checking in sidebar
	const isCurrentlyInAdminPortal = pathname.startsWith("/admin");

	// Generate navigation based on current portal path only
	const navigationItems = isCurrentlyInAdminPortal
		? [
				// Admin Portal Navigation
				{
					title: "Admin Portal",
					url: "#",
					items: [
						{
							title: "Dashboard Overview",
							url: "/admin",
							icon: RiDashboardLine,
						},
						{
							title: "Commission Approvals",
							url: "/admin/approvals",
							icon: RiCheckboxCircleLine,
						},
						{
							title: "Reports & Analytics",
							url: "/admin/reports",
							icon: RiBarChartLine,
						},
						{
							title: "Agent Management",
							url: "/admin/agents",
							icon: RiTeamLine,
						},
					{
						title: "Tag Management",
						url: "/admin/tags",
						icon: RiPriceTagLine,
					},
					{
						title: "Office Calendar",
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
				],
			},
			]
		: [
				// Agent Portal Navigation
				{
					title: "Agent Dashboard",
					url: "#",
					items: [
						{
							title: "Dashboard",
							url: "/dashboard",
							icon: RiDashboardLine,
						},
					{
						title: "Transactions",
						url: "/dashboard/transactions",
						icon: RiFileTextLine,
					},
					{
						title: "CRM",
						url: "/dashboard/crm",
						icon: RiUserLine,
					},
					{
						title: "WhatsApp",
						url: "/dashboard/whatsapp",
						icon: RiMessageLine,
					},
					{
						title: "Auto-Reply",
						url: "/dashboard/auto-reply",
						icon: RiRobotLine,
					},
					{
						title: "Office Calendar",
						url: "/dashboard/calendar",
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
											isActive={pathname === menuItem.url}
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
												{menuItem.title === "Office Calendar" && !pathname.startsWith("/admin") && (
													<AnnouncementBadge />
												)}
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
				<hr className="-mt-px mx-2 border-border border-t" />
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton className="h-9 gap-3 rounded-md bg-gradient-to-r font-medium hover:bg-transparent hover:from-sidebar-accent hover:to-sidebar-accent/40 data-[active=true]:from-primary/20 data-[active=true]:to-primary/5 [&>svg]:size-auto">
							<RiLogoutBoxLine
								className="text-muted-foreground/60 group-data-[active=true]/menu-button:text-primary"
								size={22}
								aria-hidden="true"
							/>
							<span>Sign Out</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
