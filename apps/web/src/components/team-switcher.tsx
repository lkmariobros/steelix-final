"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

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
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	RiExpandUpDownLine,
	RiShieldUserLine,
	RiUserLine,
	RiLoader4Line,
} from "@remixicon/react";
import { useKeyboardNavigation } from "@/hooks/use-keyboard-navigation";
import { useUserRole } from "@/hooks/use-user-role";
import { cn } from "@/lib/utils";
import { BRAND_LOGO_SRC } from "@/lib/brand";
import {
	PORTAL_PATHS,
	isAdminPortalPath,
	isAgentPortalPath,
} from "@/lib/user-role";

interface TeamSwitcherProps {
	teams?: {
		name: string;
		logo: string;
	}[];
}

export function TeamSwitcher({ teams = [] }: TeamSwitcherProps) {
	const pathname = usePathname();
	const router = useRouter();
	const [isOpen, setIsOpen] = React.useState(false);
	const { session, hasAdminAccess, isChecking } = useUserRole();

	const isInAdminPortal = isAdminPortalPath(pathname);
	const isInAgentPortal = isAgentPortalPath(pathname);
	const currentPortal = isInAdminPortal ? "Admin Portal" : "Agent Dashboard";

	const displayTeam = teams[0] || {
		name: "DevotsPortal",
		logo: BRAND_LOGO_SRC,
	};

	/** Client navigation between admin/agent layouts — no full page reload. */
	const switchPortal = React.useCallback(
		(target: (typeof PORTAL_PATHS)[keyof typeof PORTAL_PATHS]) => {
			setIsOpen(false);
			if (target === PORTAL_PATHS.admin && isInAdminPortal) return;
			if (target === PORTAL_PATHS.agent && isInAgentPortal) return;
			router.replace(target);
		},
		[isInAdminPortal, isInAgentPortal, router],
	);

	const { handleKeyDown: handleTriggerKeyDown } = useKeyboardNavigation({
		onEnter: () => setIsOpen(!isOpen),
		onSpace: () => setIsOpen(!isOpen),
		onEscape: () => setIsOpen(false),
	});

	/** Agents: static header only — no portal switcher, no admin link in DOM. */
	if (!isChecking && session && !hasAdminAccess) {
		return (
			<SidebarMenu>
				<SidebarMenuItem>
					<SidebarMenuButton
						size="lg"
						className="gap-3 pointer-events-none cursor-default [&>svg]:size-auto"
						aria-label={`${displayTeam.name} — ${currentPortal}`}
					>
						<div className="flex aspect-square size-8 items-center justify-center overflow-hidden rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
							<img
								src={displayTeam.logo}
								width={36}
								height={36}
								alt={`${displayTeam.name} logo`}
								className="object-cover"
							/>
						</div>
						<div className="grid flex-1 text-left text-base leading-tight">
							<span className="truncate font-medium">{displayTeam.name}</span>
							<span className="truncate text-muted-foreground text-xs">
								{currentPortal}
							</span>
						</div>
					</SidebarMenuButton>
				</SidebarMenuItem>
			</SidebarMenu>
		);
	}

	const showPortalMenu = !!session && hasAdminAccess && !isChecking;

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							className="gap-3 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground [&>svg]:size-auto"
							aria-label={`Current team: ${displayTeam.name}, Portal: ${currentPortal}. Press Enter or Space to open menu.`}
							aria-expanded={isOpen}
							aria-haspopup="menu"
							onKeyDown={handleTriggerKeyDown}
						>
							<div className="flex aspect-square size-8 items-center justify-center overflow-hidden rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
								<img
									src={displayTeam.logo}
									width={36}
									height={36}
									alt={`${displayTeam.name} logo`}
									className="object-cover"
								/>
							</div>
							<div className="grid flex-1 text-left text-base leading-tight">
								<span className="truncate font-medium">
									{displayTeam.name}
								</span>
								<span className="truncate text-muted-foreground text-xs">
									{currentPortal}
								</span>
							</div>
							{isChecking ? (
								<RiLoader4Line
									className="ms-auto animate-spin text-muted-foreground/60"
									size={20}
									aria-hidden="true"
								/>
							) : (
								<RiExpandUpDownLine
									className="ms-auto text-muted-foreground/60"
									size={20}
									aria-hidden="true"
								/>
							)}
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-md"
						align="start"
						side="bottom"
						sideOffset={4}
					>
						{isChecking && (
							<div className="flex items-center justify-center p-4">
								<RiLoader4Line
									className="animate-spin text-muted-foreground"
									size={20}
								/>
								<span className="ml-2 text-muted-foreground text-sm">
									Loading...
								</span>
							</div>
						)}

						{showPortalMenu && (
							<>
								<DropdownMenuLabel className="text-muted-foreground/60 text-xs uppercase">
									Portal Access
								</DropdownMenuLabel>

								<DropdownMenuItem
									className={cn(
										"cursor-pointer gap-2 p-2 focus:bg-sidebar-accent focus:text-sidebar-accent-foreground",
										isInAgentPortal && "bg-sidebar-accent/50",
									)}
									onSelect={(event) => {
										event.preventDefault();
										switchPortal(PORTAL_PATHS.agent);
									}}
								>
									<RiUserLine
										className="opacity-60"
										size={16}
										aria-hidden="true"
									/>
									<span className="font-medium">Agent Dashboard</span>
									{isInAgentPortal && (
										<span className="ml-auto text-muted-foreground text-xs">
											Current
										</span>
									)}
								</DropdownMenuItem>

								<DropdownMenuItem
									className={cn(
										"cursor-pointer gap-2 p-2 focus:bg-sidebar-accent focus:text-sidebar-accent-foreground",
										isInAdminPortal && "bg-sidebar-accent/50",
									)}
									onSelect={(event) => {
										event.preventDefault();
										switchPortal(PORTAL_PATHS.admin);
									}}
								>
									<RiShieldUserLine
										className="opacity-60"
										size={16}
										aria-hidden="true"
									/>
									<span className="font-medium">Admin Portal</span>
									{isInAdminPortal && (
										<span className="ml-auto text-muted-foreground text-xs">
											Current
										</span>
									)}
								</DropdownMenuItem>
							</>
						)}

						{!isChecking && !session && (
							<div className="p-4 text-center">
								<p className="text-muted-foreground text-sm">
									Please sign in to access portals
								</p>
							</div>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
