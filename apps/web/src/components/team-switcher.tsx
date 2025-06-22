"use client";

import * as React from "react";

import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/sidebar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RiAddLine, RiExpandUpDownLine, RiShieldUserLine, RiUserLine } from "@remixicon/react";
import { useRouter, usePathname } from "next/navigation";

export function TeamSwitcher({
	teams,
}: {
	teams: {
		name: string;
		logo: string;
	}[];
}) {
	const [activeTeam, setActiveTeam] = React.useState(teams[0] ?? null);
	const router = useRouter();
	const pathname = usePathname();

	// Determine current portal
	const isInAdminPortal = pathname.startsWith('/admin');
	const currentPortal = isInAdminPortal ? 'Admin Portal' : 'Agent Dashboard';

	// TODO: Replace with real role check from tRPC
	const isAdmin = true; // For testing

	if (!teams.length) return null;

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							className="gap-3 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground [&>svg]:size-auto"
						>
							<div className="flex aspect-square size-8 items-center justify-center overflow-hidden rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
								{activeTeam && (
									<img
										src={activeTeam.logo}
										width={36}
										height={36}
										alt={activeTeam.name}
									/>
								)}
							</div>
							<div className="grid flex-1 text-left text-base leading-tight">
								<span className="truncate font-medium">
									{activeTeam?.name ?? "Select a Team"}
								</span>
								<span className="truncate text-xs text-muted-foreground">
									{currentPortal}
								</span>
							</div>
							<RiExpandUpDownLine
								className="ms-auto text-muted-foreground/60"
								size={20}
								aria-hidden="true"
							/>
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-md"
						align="start"
						side="bottom"
						sideOffset={4}
					>
						{/* Portal Switching Section - Only for Admin Users */}
						{isAdmin && (
							<>
								<DropdownMenuLabel className="text-muted-foreground/60 text-xs uppercase">
									Portal Access
								</DropdownMenuLabel>
								<DropdownMenuItem
									onClick={() => router.push('/dashboard')}
									className="gap-2 p-2"
									disabled={!isInAdminPortal}
								>
									<RiUserLine className="opacity-60" size={16} aria-hidden="true" />
									<div className="font-medium">Agent Dashboard</div>
									{!isInAdminPortal && <span className="ml-auto text-xs text-muted-foreground">Current</span>}
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() => router.push('/admin')}
									className="gap-2 p-2"
									disabled={isInAdminPortal}
								>
									<RiShieldUserLine className="opacity-60" size={16} aria-hidden="true" />
									<div className="font-medium">Admin Portal</div>
									{isInAdminPortal && <span className="ml-auto text-xs text-muted-foreground">Current</span>}
								</DropdownMenuItem>
								<DropdownMenuSeparator />
							</>
						)}

						{/* Teams Section */}
						<DropdownMenuLabel className="text-muted-foreground/60 text-xs uppercase">
							Teams
						</DropdownMenuLabel>
						{teams.map((team, index) => (
							<DropdownMenuItem
								key={team.name}
								onClick={() => setActiveTeam(team)}
								className="gap-2 p-2"
							>
								<div className="flex size-6 items-center justify-center overflow-hidden rounded-md">
									<img src={team.logo} width={36} height={36} alt={team.name} />
								</div>
								{team.name}
								<DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
							</DropdownMenuItem>
						))}
						<DropdownMenuSeparator />
						<DropdownMenuItem className="gap-2 p-2">
							<RiAddLine className="opacity-60" size={16} aria-hidden="true" />
							<div className="font-medium">Add team</div>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
