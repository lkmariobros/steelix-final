"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthSession } from "@/hooks/use-user-role";
import { authClient } from "@/lib/auth-client";
import {
	accountRoleBadgeClass,
	formatAccountRole,
} from "@/lib/user-role";
import { trpc } from "@/utils/trpc";
import { RiLogoutBoxLine, RiMailLine, RiSettings3Line } from "@remixicon/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export default function UserDropdown() {
	const pathname = usePathname();
	const { data: session, isPending } = useAuthSession();
	const [loadProfile, setLoadProfile] = useState(false);
	const [isSigningOut, setIsSigningOut] = useState(false);

	useEffect(() => {
		const id = window.setTimeout(() => setLoadProfile(true), 2_000);
		return () => window.clearTimeout(id);
	}, []);

	// Fresh name/image from DB — deferred so login is not blocked by profile fetch
	const { data: profile } = trpc.agents.getMyProfile.useQuery(undefined, {
		enabled: !!session && loadProfile,
		staleTime: 3 * 60 * 1000,
		gcTime: 15 * 60 * 1000,
	});

	if (isPending) {
		return <Skeleton className="size-9 rounded-full" />;
	}

	if (!session) {
		return (
			<Button variant="outline" asChild>
				<Link href="/login">Sign In</Link>
			</Button>
		);
	}

	const userName = profile?.agent?.name || session.user.name || "User";
	const userEmail = session.user.email || "";
	const userRole =
		profile?.agent?.role ||
		(session.user as { role?: string })?.role ||
		"agent";
	const userInitials = userName
		.split(" ")
		.filter(Boolean)
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
	const settingsHref = pathname.startsWith("/admin")
		? "/admin/settings"
		: "/dashboard/settings";
	const sessionImage =
		typeof session.user.image === "string" ? session.user.image : undefined;

	const handleSignOut = async () => {
		if (isSigningOut) return;
		setIsSigningOut(true);
		await authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					window.location.href = "/login";
				},
				onError: () => {
					setIsSigningOut(false);
				},
			},
		});
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					className="h-auto rounded-full p-0.5 ring-offset-background transition-shadow hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring"
					aria-label="Account menu"
				>
					<Avatar className="size-9 border border-border/70 shadow-sm">
						<AvatarImage
							src={profile?.agent?.image || sessionImage || undefined}
							alt="Profile image"
						/>
						<AvatarFallback className="bg-muted font-medium text-foreground text-xs">
							{userInitials}
						</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className="w-72 rounded-xl border-border/80 bg-popover p-2 shadow-lg"
				align="end"
				sideOffset={8}
			>
				<div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-3 dark:bg-muted/20">
					<div className="flex items-start gap-3">
						<Avatar className="size-10 shrink-0 border border-border/70">
							<AvatarImage
								src={profile?.agent?.image || sessionImage || undefined}
								alt="Profile image"
							/>
							<AvatarFallback className="bg-background font-semibold text-foreground text-sm">
								{userInitials}
							</AvatarFallback>
						</Avatar>
						<div className="min-w-0 flex-1 space-y-1.5">
							<p className="truncate font-semibold text-foreground text-sm leading-tight">
								{userName}
							</p>
							<span
								className={cn(
									"inline-flex rounded-md px-2 py-0.5 font-medium text-[11px] leading-none",
									accountRoleBadgeClass(userRole),
								)}
							>
								{formatAccountRole(userRole)}
							</span>
						</div>
					</div>
					{userEmail ? (
						<div className="mt-3 flex items-center gap-2 border-border/50 border-t pt-3">
							<RiMailLine
								size={14}
								className="shrink-0 text-muted-foreground"
								aria-hidden="true"
							/>
							<p className="truncate text-muted-foreground text-xs">
								{userEmail}
							</p>
						</div>
					) : null}
				</div>

				<div className="mt-1.5 space-y-0.5 p-0.5">
					<DropdownMenuItem asChild className="cursor-pointer rounded-lg px-2.5 py-2">
						<Link href={settingsHref}>
							<RiSettings3Line size={16} aria-hidden="true" />
							<span>Settings</span>
						</Link>
					</DropdownMenuItem>
				</div>

				<DropdownMenuSeparator className="my-1.5" />

				<DropdownMenuItem
					variant="destructive"
					disabled={isSigningOut}
					onClick={() => void handleSignOut()}
					className="cursor-pointer rounded-lg px-2.5 py-2.5 font-medium"
				>
					<RiLogoutBoxLine size={16} aria-hidden="true" />
					<span>{isSigningOut ? "Signing out…" : "Sign out"}</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
