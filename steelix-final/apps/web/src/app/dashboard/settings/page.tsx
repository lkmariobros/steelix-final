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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import UserDropdown from "@/components/user-dropdown";
import { authClient } from "@/lib/auth-client";
import {
	RiDashboardLine,
	RiNotificationLine,
	RiPaletteLine,
	RiSecurePaymentLine,
	RiSettings3Line,
	RiUploadLine,
	RiUserLine,
} from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AgentSettingsPage() {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();

	// Settings state
	const [profileSettings, setProfileSettings] = useState({
		firstName: "John",
		lastName: "Smith",
		email: "john.smith@example.com",
		phone: "+1 (555) 123-4567",
		bio: "Experienced real estate agent specializing in residential properties.",
		avatar: "",
	});

	const [notificationSettings, setNotificationSettings] = useState({
		emailNotifications: true,
		smsNotifications: true,
		pushNotifications: true,
		newLeads: true,
		commissionUpdates: true,
		weeklyReports: false,
		marketingEmails: false,
	});

	const [preferenceSettings, setPreferenceSettings] = useState({
		theme: "system",
		language: "en",
		timezone: "America/New_York",
		dateFormat: "MM/DD/YYYY",
		currency: "USD",
	});

	const [privacySettings, setPrivacySettings] = useState({
		profileVisibility: "team",
		showEmail: false,
		showPhone: true,
		allowDirectMessages: true,
	});

	// Show loading while checking authentication
	if (isPending) {
		return (
			<div className="flex h-screen items-center justify-center">
				<div className="text-center">
					<div className="mx-auto h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
					<p className="mt-2 text-muted-foreground text-sm">Loading...</p>
				</div>
			</div>
		);
	}

	// Redirect if not authenticated
	if (!session) {
		router.push("/login");
		return null;
	}

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
					<div className="mx-auto w-full max-w-4xl">
						<div className="mb-6 flex items-center gap-4">
							<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
								<RiSettings3Line className="h-6 w-6 text-primary" />
							</div>
							<div>
								<h1 className="font-bold text-3xl">Settings</h1>
								<p className="text-muted-foreground">
									Manage your account settings and preferences
								</p>
							</div>
						</div>

						<Tabs defaultValue="profile" className="space-y-6">
							<TabsList className="grid w-full grid-cols-4">
								<TabsTrigger
									value="profile"
									className="flex items-center gap-2"
								>
									<RiUserLine size={16} />
									Profile
								</TabsTrigger>
								<TabsTrigger
									value="notifications"
									className="flex items-center gap-2"
								>
									<RiNotificationLine size={16} />
									Notifications
								</TabsTrigger>
								<TabsTrigger
									value="preferences"
									className="flex items-center gap-2"
								>
									<RiPaletteLine size={16} />
									Preferences
								</TabsTrigger>
								<TabsTrigger
									value="privacy"
									className="flex items-center gap-2"
								>
									<RiSecurePaymentLine size={16} />
									Privacy
								</TabsTrigger>
							</TabsList>

							<TabsContent value="profile" className="space-y-6">
								<Card>
									<CardHeader>
										<CardTitle>Profile Information</CardTitle>
										<CardDescription>
											Update your personal information and profile details
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-6">
										<div className="flex items-center gap-6">
											<Avatar className="h-20 w-20">
												<AvatarImage src={profileSettings.avatar} />
												<AvatarFallback className="text-lg">
													{profileSettings.firstName[0]}
													{profileSettings.lastName[0]}
												</AvatarFallback>
											</Avatar>
											<div className="space-y-2">
												<Button
													variant="outline"
													className="flex items-center gap-2"
												>
													<RiUploadLine size={16} />
													Upload Photo
												</Button>
												<p className="text-muted-foreground text-sm">
													JPG, PNG or GIF. Max size 2MB.
												</p>
											</div>
										</div>
										<div className="grid grid-cols-2 gap-4">
											<div className="space-y-2">
												<Label htmlFor="firstName">First Name</Label>
												<Input
													id="firstName"
													value={profileSettings.firstName}
													onChange={(e) =>
														setProfileSettings((prev) => ({
															...prev,
															firstName: e.target.value,
														}))
													}
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="lastName">Last Name</Label>
												<Input
													id="lastName"
													value={profileSettings.lastName}
													onChange={(e) =>
														setProfileSettings((prev) => ({
															...prev,
															lastName: e.target.value,
														}))
													}
												/>
											</div>
										</div>
										<div className="grid grid-cols-2 gap-4">
											<div className="space-y-2">
												<Label htmlFor="email">Email</Label>
												<Input
													id="email"
													type="email"
													value={profileSettings.email}
													onChange={(e) =>
														setProfileSettings((prev) => ({
															...prev,
															email: e.target.value,
														}))
													}
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="phone">Phone</Label>
												<Input
													id="phone"
													value={profileSettings.phone}
													onChange={(e) =>
														setProfileSettings((prev) => ({
															...prev,
															phone: e.target.value,
														}))
													}
												/>
											</div>
										</div>
										<div className="space-y-2">
											<Label htmlFor="bio">Bio</Label>
											<Textarea
												id="bio"
												placeholder="Tell us about yourself..."
												value={profileSettings.bio}
												onChange={(e) =>
													setProfileSettings((prev) => ({
														...prev,
														bio: e.target.value,
													}))
												}
											/>
										</div>
									</CardContent>
								</Card>
							</TabsContent>

							<TabsContent value="notifications" className="space-y-6">
								<Card>
									<CardHeader>
										<CardTitle>Notification Preferences</CardTitle>
										<CardDescription>
											Choose how you want to be notified about important updates
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="space-y-4">
											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<Label>Email Notifications</Label>
													<p className="text-muted-foreground text-sm">
														Receive notifications via email
													</p>
												</div>
												<Switch
													checked={notificationSettings.emailNotifications}
													onCheckedChange={(checked) =>
														setNotificationSettings((prev) => ({
															...prev,
															emailNotifications: checked,
														}))
													}
												/>
											</div>
											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<Label>SMS Notifications</Label>
													<p className="text-muted-foreground text-sm">
														Receive urgent notifications via SMS
													</p>
												</div>
												<Switch
													checked={notificationSettings.smsNotifications}
													onCheckedChange={(checked) =>
														setNotificationSettings((prev) => ({
															...prev,
															smsNotifications: checked,
														}))
													}
												/>
											</div>
											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<Label>New Leads</Label>
													<p className="text-muted-foreground text-sm">
														Get notified when you receive new leads
													</p>
												</div>
												<Switch
													checked={notificationSettings.newLeads}
													onCheckedChange={(checked) =>
														setNotificationSettings((prev) => ({
															...prev,
															newLeads: checked,
														}))
													}
												/>
											</div>
											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<Label>Commission Updates</Label>
													<p className="text-muted-foreground text-sm">
														Get notified about commission status changes
													</p>
												</div>
												<Switch
													checked={notificationSettings.commissionUpdates}
													onCheckedChange={(checked) =>
														setNotificationSettings((prev) => ({
															...prev,
															commissionUpdates: checked,
														}))
													}
												/>
											</div>
											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<Label>Weekly Reports</Label>
													<p className="text-muted-foreground text-sm">
														Receive weekly performance summaries
													</p>
												</div>
												<Switch
													checked={notificationSettings.weeklyReports}
													onCheckedChange={(checked) =>
														setNotificationSettings((prev) => ({
															...prev,
															weeklyReports: checked,
														}))
													}
												/>
											</div>
											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<Label>Marketing Emails</Label>
													<p className="text-muted-foreground text-sm">
														Receive marketing and promotional emails
													</p>
												</div>
												<Switch
													checked={notificationSettings.marketingEmails}
													onCheckedChange={(checked) =>
														setNotificationSettings((prev) => ({
															...prev,
															marketingEmails: checked,
														}))
													}
												/>
											</div>
										</div>
									</CardContent>
								</Card>
							</TabsContent>

							<TabsContent value="preferences" className="space-y-6">
								<Card>
									<CardHeader>
										<CardTitle>Display Preferences</CardTitle>
										<CardDescription>
											Customize your dashboard appearance and behavior
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="grid grid-cols-2 gap-4">
											<div className="space-y-2">
												<Label htmlFor="theme">Theme</Label>
												<Select
													value={preferenceSettings.theme}
													onValueChange={(value) =>
														setPreferenceSettings((prev) => ({
															...prev,
															theme: value,
														}))
													}
												>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="light">Light</SelectItem>
														<SelectItem value="dark">Dark</SelectItem>
														<SelectItem value="system">System</SelectItem>
													</SelectContent>
												</Select>
											</div>
											<div className="space-y-2">
												<Label htmlFor="language">Language</Label>
												<Select
													value={preferenceSettings.language}
													onValueChange={(value) =>
														setPreferenceSettings((prev) => ({
															...prev,
															language: value,
														}))
													}
												>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="en">English</SelectItem>
														<SelectItem value="es">Spanish</SelectItem>
														<SelectItem value="fr">French</SelectItem>
													</SelectContent>
												</Select>
											</div>
										</div>
										<div className="grid grid-cols-2 gap-4">
											<div className="space-y-2">
												<Label htmlFor="timezone">Timezone</Label>
												<Select
													value={preferenceSettings.timezone}
													onValueChange={(value) =>
														setPreferenceSettings((prev) => ({
															...prev,
															timezone: value,
														}))
													}
												>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="America/New_York">
															Eastern Time
														</SelectItem>
														<SelectItem value="America/Chicago">
															Central Time
														</SelectItem>
														<SelectItem value="America/Denver">
															Mountain Time
														</SelectItem>
														<SelectItem value="America/Los_Angeles">
															Pacific Time
														</SelectItem>
													</SelectContent>
												</Select>
											</div>
											<div className="space-y-2">
												<Label htmlFor="dateFormat">Date Format</Label>
												<Select
													value={preferenceSettings.dateFormat}
													onValueChange={(value) =>
														setPreferenceSettings((prev) => ({
															...prev,
															dateFormat: value,
														}))
													}
												>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="MM/DD/YYYY">
															MM/DD/YYYY
														</SelectItem>
														<SelectItem value="DD/MM/YYYY">
															DD/MM/YYYY
														</SelectItem>
														<SelectItem value="YYYY-MM-DD">
															YYYY-MM-DD
														</SelectItem>
													</SelectContent>
												</Select>
											</div>
										</div>
									</CardContent>
								</Card>
							</TabsContent>

							<TabsContent value="privacy" className="space-y-6">
								<Card>
									<CardHeader>
										<CardTitle>Privacy Settings</CardTitle>
										<CardDescription>
											Control your privacy and data sharing preferences
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="space-y-4">
											<div className="space-y-2">
												<Label htmlFor="profileVisibility">
													Profile Visibility
												</Label>
												<Select
													value={privacySettings.profileVisibility}
													onValueChange={(value) =>
														setPrivacySettings((prev) => ({
															...prev,
															profileVisibility: value,
														}))
													}
												>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="public">Public</SelectItem>
														<SelectItem value="team">Team Only</SelectItem>
														<SelectItem value="private">Private</SelectItem>
													</SelectContent>
												</Select>
											</div>
											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<Label>Show Email Address</Label>
													<p className="text-muted-foreground text-sm">
														Display your email in your public profile
													</p>
												</div>
												<Switch
													checked={privacySettings.showEmail}
													onCheckedChange={(checked) =>
														setPrivacySettings((prev) => ({
															...prev,
															showEmail: checked,
														}))
													}
												/>
											</div>
											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<Label>Show Phone Number</Label>
													<p className="text-muted-foreground text-sm">
														Display your phone number in your public profile
													</p>
												</div>
												<Switch
													checked={privacySettings.showPhone}
													onCheckedChange={(checked) =>
														setPrivacySettings((prev) => ({
															...prev,
															showPhone: checked,
														}))
													}
												/>
											</div>
											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<Label>Allow Direct Messages</Label>
													<p className="text-muted-foreground text-sm">
														Allow other team members to send you direct messages
													</p>
												</div>
												<Switch
													checked={privacySettings.allowDirectMessages}
													onCheckedChange={(checked) =>
														setPrivacySettings((prev) => ({
															...prev,
															allowDirectMessages: checked,
														}))
													}
												/>
											</div>
										</div>
									</CardContent>
								</Card>
							</TabsContent>
						</Tabs>

						<div className="mt-6 flex justify-end gap-4">
							<Button variant="outline">Cancel</Button>
							<Button>Save Changes</Button>
						</div>
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
