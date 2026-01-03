"use client";

import { AppSidebar } from "@/components/app-sidebar";
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
import { trpc } from "@/utils/trpc";
import { LoadingScreen } from "@/components/ui/loading-spinner";
import { AccessDenied } from "@/components/ui/access-denied";
import {
	RiDashboardLine,
	RiGlobalLine,
	RiNotificationLine,
	RiSecurePaymentLine,
	RiSettings3Line,
	RiTeamLine,
	RiUserSettingsLine,
} from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminSettingsPage() {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();

	// Admin role checking
	const { data: roleData, isLoading: isRoleLoading } = trpc.admin.checkAdminRole.useQuery(
		undefined,
		{
			enabled: !!session,
			retry: false
		}
	);

	// Settings state
	const [systemSettings, setSystemSettings] = useState({
		siteName: "InnovaCraft Admin Portal",
		siteDescription: "Real estate commission management system",
		maintenanceMode: false,
		allowRegistration: true,
		requireEmailVerification: true,
		sessionTimeout: "24",
	});

	const [notificationSettings, setNotificationSettings] = useState({
		emailNotifications: true,
		smsNotifications: false,
		pushNotifications: true,
		weeklyReports: true,
		monthlyReports: true,
	});

	const [securitySettings, setSecuritySettings] = useState({
		twoFactorAuth: false,
		passwordExpiry: "90",
		maxLoginAttempts: "5",
		ipWhitelist: "",
	});

	// Show loading while checking authentication and role
	if (isPending || isRoleLoading) {
		return <LoadingScreen text="Checking permissions..." />;
	}

	// Redirect if not authenticated
	if (!session) {
		router.push("/login");
		return null;
	}

	// Access denied if not admin
	if (!roleData || !roleData.hasAdminAccess) {
		return (
			<AccessDenied
				title="Access Denied"
				message="You don't have permission to access admin settings."
				userRole={roleData?.role || 'Unknown'}
				redirectPath="/dashboard"
				redirectLabel="Go to Agent Dashboard"
			/>
		);
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
									<BreadcrumbLink href="/admin">
										<RiDashboardLine size={22} aria-hidden="true" />
										<span className="sr-only">Admin Dashboard</span>
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator className="hidden md:block" />
								<BreadcrumbItem>
									<BreadcrumbPage className="flex items-center gap-2">
										<RiSettings3Line size={20} aria-hidden="true" />
										Admin Settings
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
					<div className="mx-auto w-full max-w-6xl">
						<div className="mb-6 flex items-center gap-4">
							<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
								<RiSettings3Line className="h-6 w-6 text-primary" />
							</div>
							<div>
								<h1 className="font-bold text-3xl">Admin Settings</h1>
								<p className="text-muted-foreground">
									Configure system-wide settings and administrative preferences
								</p>
							</div>
						</div>

						<Tabs defaultValue="system" className="space-y-6">
							<TabsList className="grid w-full grid-cols-4">
								<TabsTrigger value="system" className="flex items-center gap-2">
									<RiGlobalLine size={16} />
									System
								</TabsTrigger>
								<TabsTrigger value="users" className="flex items-center gap-2">
									<RiTeamLine size={16} />
									Users
								</TabsTrigger>
								<TabsTrigger
									value="notifications"
									className="flex items-center gap-2"
								>
									<RiNotificationLine size={16} />
									Notifications
								</TabsTrigger>
								<TabsTrigger
									value="security"
									className="flex items-center gap-2"
								>
									<RiSecurePaymentLine size={16} />
									Security
								</TabsTrigger>
							</TabsList>

							<TabsContent value="system" className="space-y-6">
								<Card>
									<CardHeader>
										<CardTitle>System Configuration</CardTitle>
										<CardDescription>
											Configure basic system settings and preferences
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="grid grid-cols-2 gap-4">
											<div className="space-y-2">
												<Label htmlFor="siteName">Site Name</Label>
												<Input
													id="siteName"
													value={systemSettings.siteName}
													onChange={(e) =>
														setSystemSettings((prev) => ({
															...prev,
															siteName: e.target.value,
														}))
													}
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="sessionTimeout">
													Session Timeout (hours)
												</Label>
												<Select
													value={systemSettings.sessionTimeout}
													onValueChange={(value) =>
														setSystemSettings((prev) => ({
															...prev,
															sessionTimeout: value,
														}))
													}
												>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="1">1 hour</SelectItem>
														<SelectItem value="8">8 hours</SelectItem>
														<SelectItem value="24">24 hours</SelectItem>
														<SelectItem value="168">1 week</SelectItem>
													</SelectContent>
												</Select>
											</div>
										</div>
										<div className="space-y-2">
											<Label htmlFor="siteDescription">Site Description</Label>
											<Textarea
												id="siteDescription"
												value={systemSettings.siteDescription}
												onChange={(e) =>
													setSystemSettings((prev) => ({
														...prev,
														siteDescription: e.target.value,
													}))
												}
											/>
										</div>
										<div className="space-y-4">
											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<Label>Maintenance Mode</Label>
													<p className="text-muted-foreground text-sm">
														Enable maintenance mode to restrict access
													</p>
												</div>
												<Switch
													checked={systemSettings.maintenanceMode}
													onCheckedChange={(checked) =>
														setSystemSettings((prev) => ({
															...prev,
															maintenanceMode: checked,
														}))
													}
												/>
											</div>
											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<Label>Allow Registration</Label>
													<p className="text-muted-foreground text-sm">
														Allow new users to register accounts
													</p>
												</div>
												<Switch
													checked={systemSettings.allowRegistration}
													onCheckedChange={(checked) =>
														setSystemSettings((prev) => ({
															...prev,
															allowRegistration: checked,
														}))
													}
												/>
											</div>
											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<Label>Require Email Verification</Label>
													<p className="text-muted-foreground text-sm">
														Require email verification for new accounts
													</p>
												</div>
												<Switch
													checked={systemSettings.requireEmailVerification}
													onCheckedChange={(checked) =>
														setSystemSettings((prev) => ({
															...prev,
															requireEmailVerification: checked,
														}))
													}
												/>
											</div>
										</div>
									</CardContent>
								</Card>
							</TabsContent>

							<TabsContent value="users" className="space-y-6">
								<Card>
									<CardHeader>
										<CardTitle>User Management</CardTitle>
										<CardDescription>
											Configure user roles, permissions, and access controls
										</CardDescription>
									</CardHeader>
									<CardContent>
										<div className="py-8 text-center">
											<RiUserSettingsLine
												size={48}
												className="mx-auto mb-4 text-muted-foreground"
											/>
											<h3 className="mb-2 font-semibold text-lg">
												User Management
											</h3>
											<p className="mb-4 text-muted-foreground">
												Advanced user management features will be available here
											</p>
											<Button variant="outline">Configure User Roles</Button>
										</div>
									</CardContent>
								</Card>
							</TabsContent>

							<TabsContent value="notifications" className="space-y-6">
								<Card>
									<CardHeader>
										<CardTitle>Notification Settings</CardTitle>
										<CardDescription>
											Configure system-wide notification preferences
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="space-y-4">
											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<Label>Email Notifications</Label>
													<p className="text-muted-foreground text-sm">
														Send email notifications for important events
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
														Send SMS notifications for urgent alerts
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
													<Label>Weekly Reports</Label>
													<p className="text-muted-foreground text-sm">
														Send weekly summary reports to administrators
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
													<Label>Monthly Reports</Label>
													<p className="text-muted-foreground text-sm">
														Send monthly analytics reports
													</p>
												</div>
												<Switch
													checked={notificationSettings.monthlyReports}
													onCheckedChange={(checked) =>
														setNotificationSettings((prev) => ({
															...prev,
															monthlyReports: checked,
														}))
													}
												/>
											</div>
										</div>
									</CardContent>
								</Card>
							</TabsContent>

							<TabsContent value="security" className="space-y-6">
								<Card>
									<CardHeader>
										<CardTitle>Security Settings</CardTitle>
										<CardDescription>
											Configure security policies and access controls
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="grid grid-cols-2 gap-4">
											<div className="space-y-2">
												<Label htmlFor="passwordExpiry">
													Password Expiry (days)
												</Label>
												<Select
													value={securitySettings.passwordExpiry}
													onValueChange={(value) =>
														setSecuritySettings((prev) => ({
															...prev,
															passwordExpiry: value,
														}))
													}
												>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="30">30 days</SelectItem>
														<SelectItem value="60">60 days</SelectItem>
														<SelectItem value="90">90 days</SelectItem>
														<SelectItem value="180">180 days</SelectItem>
														<SelectItem value="never">Never</SelectItem>
													</SelectContent>
												</Select>
											</div>
											<div className="space-y-2">
												<Label htmlFor="maxLoginAttempts">
													Max Login Attempts
												</Label>
												<Select
													value={securitySettings.maxLoginAttempts}
													onValueChange={(value) =>
														setSecuritySettings((prev) => ({
															...prev,
															maxLoginAttempts: value,
														}))
													}
												>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="3">3 attempts</SelectItem>
														<SelectItem value="5">5 attempts</SelectItem>
														<SelectItem value="10">10 attempts</SelectItem>
													</SelectContent>
												</Select>
											</div>
										</div>
										<div className="space-y-2">
											<Label htmlFor="ipWhitelist">IP Whitelist</Label>
											<Textarea
												id="ipWhitelist"
												placeholder="Enter IP addresses (one per line)"
												value={securitySettings.ipWhitelist}
												onChange={(e) =>
													setSecuritySettings((prev) => ({
														...prev,
														ipWhitelist: e.target.value,
													}))
												}
											/>
											<p className="text-muted-foreground text-sm">
												Restrict admin access to specific IP addresses
											</p>
										</div>
										<div className="flex items-center justify-between">
											<div className="space-y-0.5">
												<Label>Two-Factor Authentication</Label>
												<p className="text-muted-foreground text-sm">
													Require 2FA for all admin accounts
												</p>
											</div>
											<Switch
												checked={securitySettings.twoFactorAuth}
												onCheckedChange={(checked) =>
													setSecuritySettings((prev) => ({
														...prev,
														twoFactorAuth: checked,
													}))
												}
											/>
										</div>
									</CardContent>
								</Card>
							</TabsContent>
						</Tabs>

						<div className="mt-6 flex justify-end gap-4">
							<Button variant="outline">Reset to Defaults</Button>
							<Button>Save Changes</Button>
						</div>
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
