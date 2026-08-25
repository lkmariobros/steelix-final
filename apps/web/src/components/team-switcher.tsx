"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/sidebar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
	RiCheckLine,
	RiExpandUpDownLine,
	RiLoader4Line,
	RiShieldUserLine,
	RiUserLine,
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

type PortalOption = {
	id: "agent" | "admin";
	label: string;
	description: string;
	path: (typeof PORTAL_PATHS)[keyof typeof PORTAL_PATHS];
	icon: typeof RiUserLine;
	isActive: boolean;
};

export function TeamSwitcher({ teams = [] }: TeamSwitcherProps) {
	const pathname = usePathname();
	const router = useRouter();
	const [isOpen, setIsOpen] = React.useState(false);
	const [menuWidth, setMenuWidth] = React.useState<number>();
	const triggerRef = React.useRef<HTMLDivElement>(null);
	const { session, hasAdminAccess, isChecking } = useUserRole();
	const { state } = useSidebar();
	const isCollapsed = state === "collapsed";

	const isInAdminPortal = isAdminPortalPath(pathname);
	const isInAgentPortal = isAgentPortalPath(pathname);
	const currentPortal = isInAdminPortal ? "Admin Portal" : "Agent Dashboard";

	const displayTeam = teams[0] || {
		name: "DevotsPortal",
		logo: BRAND_LOGO_SRC,
	};

	const portalOptions: PortalOption[] = [
		{
			id: "agent",
			label: "Agent Dashboard",
			description: "Leads, deals & commissions",
			path: PORTAL_PATHS.agent,
			icon: RiUserLine,
			isActive: isInAgentPortal,
		},
		{
			id: "admin",
			label: "Admin Portal",
			description: "Approvals, agents & reports",
			path: PORTAL_PATHS.admin,
			icon: RiShieldUserLine,
			isActive: isInAdminPortal,
		},
	];

	const syncMenuWidth = React.useCallback(() => {
		const width = triggerRef.current?.offsetWidth;
		if (width) setMenuWidth(width);
	}, []);

	const handleOpenChange = React.useCallback(
		(open: boolean) => {
			if (open) syncMenuWidth();
			setIsOpen(open);
		},
		[syncMenuWidth],
	);

	React.useEffect(() => {
		if (!isOpen) return;
		syncMenuWidth();
		window.addEventListener("resize", syncMenuWidth);
		return () => window.removeEventListener("resize", syncMenuWidth);
	}, [isOpen, syncMenuWidth]);

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
		onEnter: () => handleOpenChange(!isOpen),
		onSpace: () => handleOpenChange(!isOpen),
		onEscape: () => setIsOpen(false),
	});

	/** Agents: static header only — no portal switcher, no admin link in DOM. */
	if (!isChecking && session && !hasAdminAccess) {
		return (
			<SidebarMenu>
				<SidebarMenuItem>
					<SidebarMenuButton
						size="lg"
						className="pointer-events-none cursor-default gap-3 [&>svg]:size-auto"
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
						<div className="grid flex-1 text-left text-base leading-tight group-data-[collapsible=icon]:hidden">
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
				<DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
					<div ref={triggerRef} className="w-full">
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
							<div className="grid flex-1 text-left text-base leading-tight group-data-[collapsible=icon]:hidden">
								<span className="truncate font-medium">
									{displayTeam.name}
								</span>
								<span className="truncate text-muted-foreground text-xs">
									{currentPortal}
								</span>
							</div>
							{isChecking ? (
								<RiLoader4Line
									className="ms-auto animate-spin text-muted-foreground/60 group-data-[collapsible=icon]:hidden"
									size={20}
									aria-hidden="true"
								/>
							) : (
								<RiExpandUpDownLine
									className="ms-auto text-muted-foreground/60 group-data-[collapsible=icon]:hidden"
									size={20}
									aria-hidden="true"
								/>
							)}
							</SidebarMenuButton>
						</DropdownMenuTrigger>
					</div>
					<DropdownMenuContent
						className="rounded-2xl border-border/60 p-2 shadow-lg"
						style={menuWidth ? { width: menuWidth } : undefined}
						align="start"
						side={isCollapsed ? "right" : "bottom"}
						sideOffset={8}
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
								<DropdownMenuLabel className="px-2.5 pb-2 pt-1.5 font-semibold text-[10px] text-muted-foreground tracking-[0.14em]">
									PORTAL ACCESS
								</DropdownMenuLabel>

								<div className="flex flex-col gap-1">
									{portalOptions.map((portal) => {
										const Icon = portal.icon;
										return (
											<DropdownMenuItem
												key={portal.id}
												className={cn(
													"cursor-pointer gap-3 rounded-xl p-2.5 focus:bg-primary/8 focus:text-foreground",
													portal.isActive &&
														"border border-primary/20 bg-primary/10 text-foreground focus:bg-primary/12",
													!portal.isActive && "border border-transparent",
												)}
												onSelect={(event) => {
													event.preventDefault();
													switchPortal(portal.path);
												}}
												aria-current={portal.isActive ? "page" : undefined}
											>
												<span
													className={cn(
														"flex size-9 shrink-0 items-center justify-center rounded-xl shadow-sm",
														portal.isActive
															? "bg-primary"
															: "bg-muted",
													)}
												>
													<Icon
														className={cn(
															"size-4 shrink-0",
															portal.isActive
																? "!text-white"
																: "!text-foreground",
														)}
														aria-hidden="true"
													/>
												</span>
												<span className="min-w-0 flex-1">
													<span className="block truncate font-semibold text-sm leading-tight">
														{portal.label}
													</span>
													<span className="mt-0.5 block truncate text-[11px] text-muted-foreground leading-tight">
														{portal.description}
													</span>
												</span>
												{portal.isActive && (
													<Badge
														className="ml-auto size-5 justify-center rounded-full border-transparent bg-primary p-0 shadow-none [&_svg]:size-3"
														aria-label="Currently selected portal"
													>
														<RiCheckLine
															className="!text-white"
															aria-hidden="true"
														/>
													</Badge>
												)}
											</DropdownMenuItem>
										);
									})}
								</div>
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
