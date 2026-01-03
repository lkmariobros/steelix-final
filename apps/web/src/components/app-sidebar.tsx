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
import { TeamSwitcher } from "@/components/team-switcher";
import {
	RiBarChartLine,
	RiCheckboxCircleLine,
	RiDashboardLine,
	RiFileTextLine,
	RiLogoutBoxLine,
	RiSettings3Line,
	RiTeamLine,
} from "@remixicon/react";

// Clean data structure - no mock teams
const data = {
	teams: [],
};

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
							title: "Agent Management",
							url: "/admin/agents",
							icon: RiTeamLine,
						},
						{
							title: "Reports & Analytics",
							url: "/admin/reports",
							icon: RiBarChartLine,
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
							title: "Pipeline",
							url: "/dashboard/pipeline",
							icon: RiBarChartLine,
						},
						{
							title: "Transactions",
							url: "/dashboard/transactions",
							icon: RiFileTextLine,
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
											<a href={menuItem.url}>
												{menuItem.icon && (
													<menuItem.icon
														className="text-muted-foreground/60 group-data-[active=true]/menu-button:text-primary"
														size={22}
														aria-hidden="true"
													/>
												)}
												<span>{menuItem.title}</span>
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
