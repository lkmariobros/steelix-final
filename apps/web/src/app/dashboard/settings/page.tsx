"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/avatar";
import { HeaderActions } from "@/components/header-actions";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/sidebar";
import { Badge } from "@/components/ui/badge";
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
import { LoadingScreen } from "@/components/ui/loading-spinner";
import { ModeToggle } from "@/components/mode-toggle";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useRedirectUnauthenticated } from "@/hooks/use-redirect-unauthenticated";
import { authClient } from "@/lib/auth-client";
import { compressImageFileToDataUrl } from "@/lib/profile-image";
import { trpc } from "@/utils/trpc";
import {
	RiCheckLine,
	RiDashboardLine,
	RiLoader4Line,
	RiSettings3Line,
	RiUploadLine,
} from "@remixicon/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export default function AgentSettingsPage() {
	const { data: session, isPending, refetch: refetchSession } =
		authClient.useSession();
	useRedirectUnauthenticated(session?.user?.id, isPending);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Fetch profile data from backend
	const { data: profileData, isLoading: isProfileLoading } =
		trpc.agents.getMyProfile.useQuery(undefined, { enabled: !!session });

	// Get utils for cache invalidation
	const utils = trpc.useUtils();

	// Profile update mutation
	const updateProfileMutation = trpc.agents.updateMyProfile.useMutation({
		onSuccess: () => {
			toast.success("Profile updated successfully");
			utils.agents.getMyProfile.invalidate();
			setPendingImage(undefined);
			setHasChanges(false);
			refetchSession();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update profile");
		},
	});

	// Local state for form - initialized from profile data
	const [name, setName] = useState("");
	/** `undefined` = no local image edit; `null` = remove photo; string = new image data URL */
	const [pendingImage, setPendingImage] = useState<string | null | undefined>(
		undefined,
	);
	const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
	const [hasChanges, setHasChanges] = useState(false);

	// Sync when the signed-in user changes (avoid clearing unsaved edits on cache refresh)
	useEffect(() => {
		if (!profileData?.agent?.id) return;
		setName(profileData.agent.name || "");
		setPendingImage(undefined);
	}, [profileData?.agent?.id]);

	// Track changes (name + optional photo)
	useEffect(() => {
		if (!profileData?.agent) return;
		const baselineName = profileData.agent.name || "";
		const baselineImage = profileData.agent.image ?? null;
		const nameChanged = name.trim() !== baselineName.trim();
		const imageChanged =
			pendingImage !== undefined &&
			(pendingImage === null
				? Boolean(baselineImage)
				: pendingImage !== baselineImage);
		setHasChanges(nameChanged || imageChanged);
	}, [name, pendingImage, profileData]);

	// Handle save
	const handleSave = () => {
		if (!hasChanges || !profileData?.agent) return;
		const baselineName = profileData.agent.name || "";
		const baselineImage = profileData.agent.image ?? null;
		const payload: { name?: string; image?: string | null } = {};
		if (name.trim() !== baselineName.trim()) {
			payload.name = name.trim();
		}
		if (pendingImage !== undefined) {
			payload.image = pendingImage;
		}
		if (Object.keys(payload).length === 0) return;
		updateProfileMutation.mutate(payload);
	};

	// Handle cancel - reset to original values
	const handleCancel = () => {
		if (profileData?.agent) {
			setName(profileData.agent.name || "");
		}
		setPendingImage(undefined);
		setHasChanges(false);
	};

	const handlePickPhoto = () => fileInputRef.current?.click();

	const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) return;
		setIsCompressingPhoto(true);
		try {
			const dataUrl = await compressImageFileToDataUrl(file);
			setPendingImage(dataUrl);
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Could not use this image";
			toast.error(msg);
		} finally {
			setIsCompressingPhoto(false);
		}
	};

	const handleRemovePhoto = () => {
		setPendingImage(null);
	};

	const avatarSrc =
		pendingImage === undefined
			? (profileData?.agent?.image || "")
			: pendingImage === null
				? ""
				: pendingImage;

	// Show loading while checking authentication
	if (isPending) {
		return <LoadingScreen text="Loading..." />;
	}

	// Show profile skeleton while profile data loads
	if (isProfileLoading) {
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
							<HeaderActions />
						</div>
					</header>
					<div className="flex flex-1 flex-col gap-4 py-4 lg:gap-6 lg:py-6">
						<div className="mx-auto w-full max-w-2xl">
							{/* Page title skeleton */}
							<div className="mb-6 flex items-center gap-4">
								<Skeleton className="h-12 w-12 rounded-lg" />
								<div className="space-y-1.5">
									<Skeleton className="h-8 w-48" />
									<Skeleton className="h-4 w-56" />
								</div>
							</div>
							{/* Profile card skeleton */}
							<Card>
								<CardHeader>
									<Skeleton className="h-5 w-40" />
									<Skeleton className="mt-1 h-4 w-64" />
								</CardHeader>
								<CardContent className="space-y-6">
									{/* Avatar row */}
									<div className="flex items-center gap-6">
										<Skeleton className="h-20 w-20 rounded-full" />
										<div className="space-y-2">
											<Skeleton className="h-9 w-32 rounded-md" />
											<Skeleton className="h-3.5 w-36" />
										</div>
									</div>
									{/* Name field */}
									<div className="space-y-2">
										<Skeleton className="h-4 w-20" />
										<Skeleton className="h-10 w-full rounded-md" />
									</div>
									{/* Email field */}
									<div className="space-y-2">
										<Skeleton className="h-4 w-12" />
										<Skeleton className="h-10 w-full rounded-md" />
										<Skeleton className="h-3.5 w-64" />
									</div>
									{/* Account info */}
									<div className="rounded-lg border bg-muted/50 p-4">
										<Skeleton className="mb-3 h-4 w-40" />
										<div className="grid grid-cols-2 gap-4">
											<div className="space-y-2">
												<Skeleton className="h-3.5 w-8" />
												<Skeleton className="h-5 w-16 rounded-full" />
											</div>
											<div className="space-y-2">
												<Skeleton className="h-3.5 w-8" />
												<Skeleton className="h-5 w-20 rounded-full" />
											</div>
										</div>
									</div>
								</CardContent>
							</Card>
							{/* Action buttons skeleton */}
							<div className="mt-6 flex justify-end gap-4">
								<Skeleton className="h-9 w-20 rounded-md" />
								<Skeleton className="h-9 w-28 rounded-md" />
							</div>
						</div>
					</div>
				</SidebarInset>
			</SidebarProvider>
		);
	}

	// Redirect if not authenticated (navigation runs in useRedirectUnauthenticated)
	if (!session) {
		return <LoadingScreen text="Redirecting..." />;
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
						<HeaderActions />
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
								<input
									ref={fileInputRef}
									type="file"
									accept="image/jpeg,image/png,image/webp"
									className="hidden"
									onChange={handlePhotoSelected}
								/>

								{/* Avatar Section */}
								<div className="flex flex-wrap items-center gap-4">
									<Avatar className="h-20 w-20">
										<AvatarImage src={avatarSrc || undefined} />
										<AvatarFallback className="text-lg">
											{name ? getInitials(name) : "??"}
										</AvatarFallback>
									</Avatar>
									<div className="flex flex-col gap-2">
										<div className="flex flex-wrap gap-2">
											<Button
												type="button"
												variant="outline"
												size="sm"
												className="gap-2"
												disabled={
													isCompressingPhoto || updateProfileMutation.isPending
												}
												onClick={handlePickPhoto}
											>
												<RiUploadLine size={16} />
												{isCompressingPhoto ? "Processing…" : "Upload photo"}
											</Button>
											{(profileData?.agent?.image || pendingImage) &&
												pendingImage !== null && (
													<Button
														type="button"
														variant="ghost"
														size="sm"
														className="text-muted-foreground"
														disabled={updateProfileMutation.isPending}
														onClick={handleRemovePhoto}
													>
														Remove
													</Button>
												)}
										</div>
										<p className="text-muted-foreground text-xs max-w-sm">
											JPEG, PNG, or WebP up to 5MB. Images are resized automatically.
										</p>
									</div>
								</div>

								{/* Name Field */}
								<div className="space-y-2">
									<Label htmlFor="name">Display name</Label>
									<Input
										id="name"
										value={name}
										onChange={(e) => setName(e.target.value)}
										placeholder="Name shown in the app"
									/>
									<p className="text-muted-foreground text-xs">
										Use the name you want colleagues and clients to see. It does
										not have to match your ID unless your office requires it for
										compliance.
									</p>
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
									<h4 className="mb-3 font-medium text-sm">
										Account Information
									</h4>
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
												{profileData?.agent?.agentTier?.replace("_", " ") ||
													"Advisor"}
											</Badge>
										</div>
										<div>
											<p className="text-muted-foreground">Branch</p>
											<Badge variant="secondary" className="mt-1">
												{profileData?.agent?.branch || "—"}
											</Badge>
										</div>
										{profileData?.team && (
											<div>
												<p className="text-muted-foreground">Team</p>
												<p className="mt-1 font-medium">
													{profileData.team.name}
												</p>
											</div>
										)}
										{profileData?.agency && (
											<div>
												<p className="text-muted-foreground">Agency</p>
												<p className="mt-1 font-medium">
													{profileData.agency.name}
												</p>
											</div>
										)}
									</div>
								</div>
							</CardContent>
						</Card>

						<Card className="mt-6">
							<CardHeader>
								<CardTitle>Appearance</CardTitle>
								<CardDescription>
									Choose light, dark, or match your system preference
								</CardDescription>
							</CardHeader>
							<CardContent className="flex items-center justify-between gap-4">
								<div>
									<p className="font-medium text-sm">Color theme</p>
									<p className="text-muted-foreground text-xs">
										Applies across the portal and login screens
									</p>
								</div>
								<ModeToggle />
							</CardContent>
						</Card>

						{/* Action Buttons */}
						<div className="mt-6 flex justify-end gap-4">
							<Button
								variant="outline"
								onClick={handleCancel}
								disabled={
									!hasChanges ||
									updateProfileMutation.isPending ||
									isCompressingPhoto
								}
							>
								Cancel
							</Button>
							<Button
								onClick={handleSave}
								disabled={
									!hasChanges ||
									updateProfileMutation.isPending ||
									isCompressingPhoto
								}
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
