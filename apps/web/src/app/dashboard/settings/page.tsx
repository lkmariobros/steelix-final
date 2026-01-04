"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/avatar";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/sidebar";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import UserDropdown from "@/components/user-dropdown";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import {
	RiDashboardLine,
	RiSettings3Line,
	RiUploadLine,
	RiCheckLine,
	RiLoader4Line,
} from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function AgentSettingsPage() {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();

	// Fetch profile data from backend
	const { data: profileData, isLoading: isProfileLoading } = trpc.agents.getMyProfile.useQuery(
		undefined,
		{ enabled: !!session }
	);

	// Get utils for cache invalidation
	const utils = trpc.useUtils();

	// Profile update mutation
	const updateProfileMutation = trpc.agents.updateMyProfile.useMutation({
		onSuccess: () => {
			toast.success("Profile updated successfully");
			// Invalidate profile cache to refetch updated data
			utils.agents.getMyProfile.invalidate();
			setHasChanges(false);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update profile");
		},
	});

	// Local state for form - initialized from profile data
	const [name, setName] = useState("");
	const [hasChanges, setHasChanges] = useState(false);

	// Sync profile data to local state when loaded
	useEffect(() => {
		if (profileData?.agent) {
			setName(profileData.agent.name || "");
		}
	}, [profileData]);

	// Track changes
	useEffect(() => {
		if (profileData?.agent) {
			setHasChanges(name !== profileData.agent.name);
		}
	}, [name, profileData]);

	// Handle save
	const handleSave = () => {
		if (!hasChanges) return;
		updateProfileMutation.mutate({ name });
	};

	// Handle cancel - reset to original values
	const handleCancel = () => {
		if (profileData?.agent) {
			setName(profileData.agent.name || "");
		}
		setHasChanges(false);
	};

	// Show loading while checking authentication
	if (isPending || isProfileLoading) {
		return (
			<div className="flex h-screen items-center justify-center">
				<div className="text-center">
					<RiLoader4Line className="mx-auto h-8 w-8 animate-spin text-primary" />
					<p className="mt-2 text-muted-foreground text-sm">Loading profile...</p>
				</div>
			</div>
		);
	}

	// Redirect if not authenticated
	if (!session) {
		router.push("/login");
		return null;
	}

	// Get initials for avatar fallback
	const getInitials = (fullName: string) => {
		const parts = fullName.split(" ");
		if (parts.length >= 2) {
			return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
		}
		return fullName.substring(0, 2).toUpperCase();
	};

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset className="overflow-hidden px-4 md:px-6 lg:px-8">
				<header className="flex h-16 shrink-0 items-center gap-2 border-b">
					<div className="flex flex-1 items-center gap-2 px-3">
						<SidebarTrigger className="-ms-4" />
						<Separator
							orientation="vertical"
							className="mr-2 data-[orientation=vertical]:h-4"
						/>
						<Breadcrumb>
							<BreadcrumbList>
								<BreadcrumbItem className="hidden md:block">
									<BreadcrumbLink href="/dashboard">
										<RiDashboardLine size={22} aria-hidden="true" />
										<span className="sr-only">Dashboard</span>
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator className="hidden md:block" />
								<BreadcrumbItem>
									<BreadcrumbPage className="flex items-center gap-2">
										<RiSettings3Line size={20} aria-hidden="true" />
										Settings
									</BreadcrumbPage>
								</BreadcrumbItem>
							</BreadcrumbList>
						</Breadcrumb>
					</div>
					<div className="ml-auto flex gap-3">
						<UserDropdown />
					</div>
				</header>
				<div className="flex flex-1 flex-col gap-4 py-4 lg:gap-6 lg:py-6">
					<div className="mx-auto w-full max-w-2xl">
						<div className="mb-6 flex items-center gap-4">
							<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
								<RiSettings3Line className="h-6 w-6 text-primary" />
							</div>
							<div>
								<h1 className="font-bold text-3xl">Profile Settings</h1>
								<p className="text-muted-foreground">
									Manage your account information
								</p>
							</div>
						</div>

						{/* Profile Information Card */}
						<Card>
							<CardHeader>
								<CardTitle>Profile Information</CardTitle>
								<CardDescription>
									Update your personal information and profile details
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6">
								{/* Avatar Section */}
								<div className="flex items-center gap-6">
									<Avatar className="h-20 w-20">
										<AvatarImage src={profileData?.agent?.image || ""} />
										<AvatarFallback className="text-lg">
											{name ? getInitials(name) : "??"}
										</AvatarFallback>
									</Avatar>
									<div className="space-y-2">
										<Button
											variant="outline"
											className="flex items-center gap-2"
											disabled
										>
											<RiUploadLine size={16} />
											Upload Photo
										</Button>
										<p className="text-muted-foreground text-xs">
											Photo upload coming soon
										</p>
									</div>
								</div>

								{/* Name Field */}
								<div className="space-y-2">
									<Label htmlFor="name">Full Name</Label>
									<Input
										id="name"
										value={name}
										onChange={(e) => setName(e.target.value)}
										placeholder="Enter your full name"
									/>
								</div>

								{/* Email Field - Read Only */}
								<div className="space-y-2">
									<Label htmlFor="email">Email</Label>
									<Input
										id="email"
										type="email"
										value={profileData?.agent?.email || ""}
										disabled
										className="bg-muted"
									/>
									<p className="text-muted-foreground text-xs">
										Email cannot be changed. Contact support if needed.
									</p>
								</div>

								{/* Account Info Section */}
								<div className="rounded-lg border bg-muted/50 p-4">
									<h4 className="mb-3 font-medium text-sm">Account Information</h4>
									<div className="grid grid-cols-2 gap-4 text-sm">
										<div>
											<p className="text-muted-foreground">Role</p>
											<Badge variant="outline" className="mt-1">
												{profileData?.agent?.role || "Agent"}
											</Badge>
										</div>
										<div>
											<p className="text-muted-foreground">Tier</p>
											<Badge variant="secondary" className="mt-1">
												{profileData?.agent?.agentTier?.replace("_", " ") || "Advisor"}
											</Badge>
										</div>
										{profileData?.team && (
											<div>
												<p className="text-muted-foreground">Team</p>
												<p className="mt-1 font-medium">{profileData.team.name}</p>
											</div>
										)}
										{profileData?.agency && (
											<div>
												<p className="text-muted-foreground">Agency</p>
												<p className="mt-1 font-medium">{profileData.agency.name}</p>
											</div>
										)}
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Action Buttons */}
						<div className="mt-6 flex justify-end gap-4">
							<Button
								variant="outline"
								onClick={handleCancel}
								disabled={!hasChanges || updateProfileMutation.isPending}
							>
								Cancel
							</Button>
							<Button
								onClick={handleSave}
								disabled={!hasChanges || updateProfileMutation.isPending}
							>
								{updateProfileMutation.isPending ? (
									<>
										<RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
										Saving...
									</>
								) : (
									<>
										<RiCheckLine className="mr-2 h-4 w-4" />
										Save Changes
									</>
								)}
							</Button>
						</div>
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
