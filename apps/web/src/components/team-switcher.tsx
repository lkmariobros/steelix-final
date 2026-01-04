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
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	RiExpandUpDownLine,
	RiShieldUserLine,
	RiUserLine,
	RiLoader4Line,
} from "@remixicon/react";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { useKeyboardNavigation } from "@/hooks/use-keyboard-navigation";

interface TeamSwitcherProps {
	teams?: {
		name: string;
		logo: string;
	}[];
}

export function TeamSwitcher({ teams = [] }: TeamSwitcherProps) {
	const router = useRouter();
	const pathname = usePathname();
	const [isOpen, setIsOpen] = React.useState(false);

	// Authentication and role checking
	const { data: session, isPending: isSessionPending } = authClient.useSession();
	const { data: roleData, isLoading: isRoleLoading, error: roleError } = trpc.admin.checkAdminRole.useQuery(
		undefined,
		{
			enabled: !!session,
			retry: false,
		}
	);

	// Determine current portal and admin access
	const isInAdminPortal = pathname.startsWith("/admin");
	const currentPortal = isInAdminPortal ? "Admin Portal" : "Agent Dashboard";
	const hasAdminAccess = !!roleData?.hasAdminAccess;

	// Loading state
	const isLoading = isSessionPending || (session && isRoleLoading);

	// Default team for display (using fixed company name as per requirements)
	const displayTeam = teams[0] || {
		name: "SteelixTech",
		logo: "https://raw.githubusercontent.com/origin-space/origin-images/refs/heads/main/exp1/logo-01_kp2j8x.png"
	};

	// Navigation handlers with proper error handling
	const handleNavigateToAgent = React.useCallback(() => {
		try {
			router.push("/dashboard");
			setIsOpen(false);
		} catch (error) {
			console.error("Navigation error:", error);
		}
	}, [router]);

	const handleNavigateToAdmin = React.useCallback(() => {
		try {
			router.push("/admin");
			setIsOpen(false);
		} catch (error) {
			console.error("Navigation error:", error);
		}
	}, [router]);

	// Keyboard navigation for dropdown trigger
	const { handleKeyDown: handleTriggerKeyDown } = useKeyboardNavigation({
		onEnter: () => setIsOpen(!isOpen),
		onSpace: () => setIsOpen(!isOpen),
		onEscape: () => setIsOpen(false),
	});

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
							{isLoading ? (
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
						{/* Loading State */}
						{isLoading && (
							<div className="flex items-center justify-center p-4">
								<RiLoader4Line className="animate-spin text-muted-foreground" size={20} />
								<span className="ml-2 text-muted-foreground text-sm">Loading...</span>
							</div>
						)}

						{/* Error State */}
						{roleError && !isLoading && (
							<div className="p-4 text-center">
								<p className="text-destructive text-sm">Failed to load user permissions</p>
							</div>
						)}

						{/* Portal Switching Section - Show when not loading */}
						{!isLoading && session && (
							<>
								<DropdownMenuLabel className="text-muted-foreground/60 text-xs uppercase">
									Portal Access
								</DropdownMenuLabel>

								{/* Agent Dashboard - Always available */}
								<DropdownMenuItem
									onClick={handleNavigateToAgent}
									className="gap-2 p-2 focus:bg-sidebar-accent focus:text-sidebar-accent-foreground"
									disabled={!isInAdminPortal}
									role="menuitem"
									aria-label="Switch to Agent Dashboard"
									tabIndex={0}
								>
									<RiUserLine
										className="opacity-60"
										size={16}
										aria-hidden="true"
									/>
									<div className="font-medium">Agent Dashboard</div>
									{!isInAdminPortal && (
										<span className="ml-auto text-muted-foreground text-xs">
											Current
										</span>
									)}
								</DropdownMenuItem>

								{/* Admin Portal - Only for admin users */}
								{hasAdminAccess && (
									<DropdownMenuItem
										onClick={handleNavigateToAdmin}
										className="gap-2 p-2 focus:bg-sidebar-accent focus:text-sidebar-accent-foreground"
										disabled={isInAdminPortal}
										role="menuitem"
										aria-label="Switch to Admin Portal"
										tabIndex={0}
									>
										<RiShieldUserLine
											className="opacity-60"
											size={16}
											aria-hidden="true"
										/>
										<div className="font-medium">Admin Portal</div>
										{isInAdminPortal && (
											<span className="ml-auto text-muted-foreground text-xs">
												Current
											</span>
										)}
									</DropdownMenuItem>
								)}
							</>
						)}

						{/* Not authenticated state */}
						{!isLoading && !session && (
							<div className="p-4 text-center">
								<p className="text-muted-foreground text-sm">Please sign in to access portals</p>
							</div>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
