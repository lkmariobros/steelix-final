import { Avatar, AvatarFallback, AvatarImage } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { RiLogoutBoxLine } from "@remixicon/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function UserDropdown() {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();

	// Loading state
	if (isPending) {
		return <Skeleton className="size-8 rounded-full" />;
	}

	// Unauthenticated state
	if (!session) {
		return (
			<Button variant="outline" asChild>
				<Link href="/login">Sign In</Link>
			</Button>
		);
	}

	// Extract dynamic user data
	const userName = session.user.name || "User";
	const userEmail = session.user.email || "";
	const userInitials = userName
		.split(' ')
		.map(n => n[0])
		.join('')
		.toUpperCase();

	// Logout function
	const handleSignOut = async () => {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					router.push("/login");
				},
			},
		});
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
					<Avatar className="size-8">
						<AvatarImage
							src={session.user.image || undefined}
							alt="Profile image"
						/>
						<AvatarFallback>{userInitials}</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="max-w-64" align="end">
				<DropdownMenuLabel className="flex min-w-0 flex-col">
					<span className="truncate font-medium text-foreground text-sm">
						{userName}
					</span>
					<span className="truncate font-normal text-muted-foreground text-xs">
						{userEmail}
					</span>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={handleSignOut}>
					<RiLogoutBoxLine
						size={16}
						className="opacity-60"
						aria-hidden="true"
					/>
					<span>Sign out</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
