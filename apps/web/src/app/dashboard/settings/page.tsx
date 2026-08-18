"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/avatar";
import { HeaderActions } from "@/components/header-actions";
import {
	SettingsFieldRow,
	SettingsPageIntro,
	SettingsSectionTitle,
	ThemePicker,
	titleCaseWords,
} from "@/components/settings/settings-ui";
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
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingScreen } from "@/components/ui/loading-spinner";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useRedirectUnauthenticated } from "@/hooks/use-redirect-unauthenticated";
import { authClient } from "@/lib/auth-client";
import { compressImageFileToDataUrl } from "@/lib/profile-image";
import { trpc } from "@/utils/trpc";
import {
	RiCheckLine,
	RiDashboardLine,
	RiLockLine,
	RiLoader4Line,
	RiSettings3Line,
	RiUploadLine,
} from "@remixicon/react";
import {
	useEffect,
	useRef,
	useState,
	type ChangeEvent,
	type ReactNode,
} from "react";
import { toast } from "sonner";

function SettingsPageShell({ children }: { children: ReactNode }) {
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
					{children}
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}

function initialsFromName(fullName: string) {
	const parts = fullName.trim().split(/\s+/).filter(Boolean);
	if (parts.length >= 2) {
		return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
	}
	return fullName.substring(0, 2).toUpperCase() || "??";
}

export default function AgentSettingsPage() {
	const { data: session, isPending, refetch: refetchSession } =
		authClient.useSession();
	useRedirectUnauthenticated(session?.user?.id, isPending);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const { data: profileData, isLoading: isProfileLoading } =
		trpc.agents.getMyProfile.useQuery(undefined, { enabled: !!session });

	const utils = trpc.useUtils();

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

	const [name, setName] = useState("");
	/** `undefined` = no local image edit; `null` = remove photo; string = new image data URL */
	const [pendingImage, setPendingImage] = useState<string | null | undefined>(
		undefined,
	);
	const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
	const [hasChanges, setHasChanges] = useState(false);

	useEffect(() => {
		if (!profileData?.agent?.id) return;
		setName(profileData.agent.name || "");
		setPendingImage(undefined);
	}, [profileData?.agent?.id]);

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

	const handleSave = () => {
		if (!hasChanges || !profileData?.agent) return;
		const baselineName = profileData.agent.name || "";
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

	const handleCancel = () => {
		if (profileData?.agent) {
			setName(profileData.agent.name || "");
		}
		setPendingImage(undefined);
		setHasChanges(false);
	};

	const handlePickPhoto = () => fileInputRef.current?.click();

	const handlePhotoSelected = async (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) return;
		setIsCompressingPhoto(true);
		try {
			const dataUrl = await compressImageFileToDataUrl(file);
			setPendingImage(dataUrl);
		} catch (err) {
			const msg =
				err instanceof Error ? err.message : "Could not use this image";
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
			? profileData?.agent?.image || ""
			: pendingImage === null
				? ""
				: pendingImage;

	if (isPending) {
		return <LoadingScreen text="Loading..." />;
	}

	if (isProfileLoading) {
		return (
			<SettingsPageShell>
				<div className="mx-auto w-full max-w-3xl space-y-6">
					<div className="flex items-center gap-3">
						<Skeleton className="size-11 rounded-xl" />
						<div className="space-y-2">
							<Skeleton className="h-8 w-52" />
							<Skeleton className="h-4 w-72" />
						</div>
					</div>
					<Card>
						<CardContent className="space-y-5 pt-6">
							<div className="flex items-center gap-4">
								<Skeleton className="size-16 rounded-full" />
								<div className="space-y-2">
									<Skeleton className="h-6 w-40" />
									<Skeleton className="h-4 w-56" />
								</div>
							</div>
							<Skeleton className="h-24 w-full rounded-xl" />
							<Skeleton className="h-40 w-full rounded-xl" />
						</CardContent>
					</Card>
				</div>
			</SettingsPageShell>
		);
	}

	if (!session) {
		return <LoadingScreen text="Redirecting..." />;
	}

	const showRemove =
		Boolean(profileData?.agent?.image || pendingImage) &&
		pendingImage !== null;

	const role = titleCaseWords(
		(profileData?.agent?.role || "Agent").replaceAll("_", " "),
	);
	const tier = titleCaseWords(
		(profileData?.agent?.agentTier || "Advisor").replaceAll("_", " "),
	);

	const saveBusy = updateProfileMutation.isPending || isCompressingPhoto;

	const saveActions = hasChanges ? (
		<div className="flex flex-wrap items-center gap-2">
			<span className="rounded-full bg-amber-500/15 px-2.5 py-1 font-semibold text-amber-800 text-xs dark:text-amber-300">
				Unsaved changes
			</span>
			<Button variant="outline" onClick={handleCancel} disabled={saveBusy}>
				Cancel
			</Button>
			<Button onClick={handleSave} disabled={saveBusy}>
				{updateProfileMutation.isPending ? (
					<>
						<RiLoader4Line className="mr-2 size-4 animate-spin" />
						Saving…
					</>
				) : (
					<>
						<RiCheckLine className="mr-2 size-4" />
						Save changes
					</>
				)}
			</Button>
		</div>
	) : null;

	return (
		<SettingsPageShell>
			<div className="mx-auto w-full max-w-3xl space-y-6">
				<SettingsPageIntro
					icon={<RiSettings3Line className="size-6" />}
					title="Profile Settings"
					description="Manage how you appear in the portal and review your assigned account details."
					actions={<div className="hidden sm:block">{saveActions}</div>}
				/>

				<Card>
					<CardContent className="space-y-6 pt-6">
						<input
							ref={fileInputRef}
							type="file"
							accept="image/jpeg,image/png,image/webp"
							className="hidden"
							onChange={handlePhotoSelected}
						/>

						<div className="flex flex-col gap-4 rounded-xl border bg-muted/40 p-4 sm:flex-row sm:items-center">
							<Avatar className="size-20 border-2 border-background shadow-sm">
								<AvatarImage src={avatarSrc || undefined} />
								<AvatarFallback className="bg-primary/15 font-semibold text-lg text-primary">
									{name ? initialsFromName(name) : "??"}
								</AvatarFallback>
							</Avatar>
							<div className="min-w-0 flex-1 space-y-2">
								<div>
									<p className="truncate font-semibold text-lg text-foreground">
										{name.trim() || "Your display name"}
									</p>
									<p className="truncate text-foreground/75 text-sm">
										{profileData?.agent?.email || "No email on file"}
									</p>
								</div>
								<div className="flex flex-wrap items-center gap-2">
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="gap-2"
										disabled={saveBusy}
										onClick={handlePickPhoto}
									>
										<RiUploadLine size={16} />
										{isCompressingPhoto ? "Processing…" : "Upload photo"}
									</Button>
									{showRemove ? (
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="text-destructive hover:bg-destructive/10 hover:text-destructive"
											disabled={updateProfileMutation.isPending}
											onClick={handleRemovePhoto}
										>
											Remove
										</Button>
									) : null}
								</div>
								<p className="text-foreground/70 text-sm">
									JPEG, PNG, or WebP up to 5MB. Photos are resized automatically.
								</p>
							</div>
						</div>

						<div className="grid gap-5 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="name" className="font-semibold text-foreground">
									Display name
								</Label>
								<Input
									id="name"
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="Name shown in the app"
									className="h-11"
								/>
								<p className="text-foreground/70 text-sm leading-relaxed">
									This is what colleagues and clients see across the portal.
								</p>
							</div>

							<div className="space-y-2">
								<Label htmlFor="email" className="font-semibold text-foreground">
									Email
								</Label>
								<div className="relative">
									<Input
										id="email"
										type="email"
										value={profileData?.agent?.email || ""}
										disabled
										className="h-11 bg-muted pr-10 font-medium"
									/>
									<RiLockLine className="-translate-y-1/2 absolute top-1/2 right-3 size-4 text-foreground/50" />
								</div>
								<p className="text-foreground/70 text-sm leading-relaxed">
									Email cannot be changed here. Contact support if you need an
									update.
								</p>
							</div>
						</div>

						<div className="space-y-3">
							<SettingsSectionTitle
								title="Account information"
								description="Assigned by your office. Ask admin if something looks wrong."
							/>
							<div className="rounded-xl border px-4">
								<SettingsFieldRow label="Role" value={role} />
								<SettingsFieldRow label="Tier" value={tier} />
								<SettingsFieldRow
									label="Branch"
									value={profileData?.agent?.branch}
								/>
								<SettingsFieldRow
									label="Team"
									value={profileData?.team?.name}
								/>
								<SettingsFieldRow
									label="Agency"
									value={profileData?.agency?.name}
								/>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="space-y-4 pt-6">
						<SettingsSectionTitle
							title="Appearance"
							description="Choose light, dark, or match your device. Applies across the portal."
						/>
						<ThemePicker />
					</CardContent>
				</Card>

				{hasChanges ? (
					<div className="sticky bottom-4 z-10 flex justify-end gap-2 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur sm:hidden">
						<Button
							variant="outline"
							className="flex-1"
							onClick={handleCancel}
							disabled={saveBusy}
						>
							Cancel
						</Button>
						<Button
							className="flex-1"
							onClick={handleSave}
							disabled={saveBusy}
						>
							{updateProfileMutation.isPending ? "Saving…" : "Save"}
						</Button>
					</div>
				) : null}
			</div>
		</SettingsPageShell>
	);
}
