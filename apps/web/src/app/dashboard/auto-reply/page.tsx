"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
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
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import UserDropdown from "@/components/user-dropdown";
import {
	RiDashboardLine,
	RiAddLine,
	RiSearchLine,
	RiSettings3Line,
	RiEditLine,
	RiDeleteBinLine,
	RiUserLine,
	RiAlertLine,
	RiLoader4Line,
} from "@remixicon/react";

// Auto-reply rule interface matching database schema
interface AutoReplyRule {
	id: string;
	trigger: {
		type: "contains" | "equals" | "starts_with" | "regex";
		keywords: string[];
	};
	response: string;
	messageOwner: string; // Agent/user who created this rule
	status: "tenant" | "owner"; // User status
	logCount: number;
}

export default function AutoReplyPage() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { data: session, isPending } = authClient.useSession();
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<"all" | "tenant" | "owner">("all");
	const [sortBy, setSortBy] = useState<"owner" | "status">("status");
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [ruleToDelete, setRuleToDelete] = useState<AutoReplyRule | null>(null);

	// Fetch auto-reply rules with tRPC - only when session is available
	const {
		data: rulesData,
		isLoading: isLoadingRules,
		error: rulesError,
		refetch: refetchRules,
	} = trpc.autoReply.list.useQuery(
		{
			search: searchQuery || undefined,
			status: statusFilter !== "all" ? (statusFilter as "tenant" | "owner") : undefined,
			sortBy,
		},
		{
			enabled: !!session, // Only run query when user is authenticated
			retry: 1,
			staleTime: 30000, // 30 seconds
		},
	);

	const rules = rulesData?.rules || [];
	const summary = rulesData?.summary || { total: 0, owner: 0, tenant: 0 };

	// Delete rule mutation
	const deleteRuleMutation = trpc.autoReply.delete.useMutation({
		onSuccess: () => {
			toast.success("Auto-reply rule deleted successfully!");
			setIsDeleteDialogOpen(false);
			setRuleToDelete(null);
			queryClient.invalidateQueries({ queryKey: [["autoReply", "list"]] });
			refetchRules();
		},
		onError: (error) => {
			console.error("Error deleting rule:", error);
			toast.error("Failed to delete rule. Please try again.");
		},
	});

	const handleDeleteClick = (rule: AutoReplyRule) => {
		setRuleToDelete(rule);
		setIsDeleteDialogOpen(true);
	};

	const handleDeleteConfirm = async () => {
		if (!ruleToDelete) return;
		deleteRuleMutation.mutate({ id: ruleToDelete.id });
	};

	// Authentication check
	if (isPending) {
		return (
			<div className="flex h-screen items-center justify-center">
				<LoadingSpinner size="lg" text="Loading..." />
			</div>
		);
	}

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
										<RiSettings3Line size={18} />
										Auto-Reply
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
					{/* Page Header */}
					<div className="flex items-center justify-between">
						<h1 className="font-semibold text-2xl">Auto-Reply Rules</h1>
					</div>

					{/* Search and Filters */}
					<div className="flex items-center gap-3">
						<div className="relative flex-1">
							<RiSearchLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search rules..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-9"
							/>
						</div>
						<Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | "tenant" | "owner")}>
							<SelectTrigger className="w-40">
								<SelectValue placeholder="Status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">Status: All</SelectItem>
								<SelectItem value="owner">Status: Owner</SelectItem>
								<SelectItem value="tenant">Status: Tenant</SelectItem>
							</SelectContent>
						</Select>
						<Select value={sortBy} onValueChange={(value) => setSortBy(value as "owner" | "status")}>
							<SelectTrigger className="w-48">
								<SelectValue placeholder="Sort" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="status">Sort: Status</SelectItem>
								<SelectItem value="owner">Sort: Owner Name</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Rules List */}
					<div className="flex flex-col gap-6">
						{isLoadingRules ? (
							<div className="flex items-center justify-center py-12">
								<RiLoader4Line className="h-8 w-8 animate-spin text-muted-foreground" />
							</div>
						) : rulesError ? (
							<div className="text-center py-12">
								<div className="text-red-500 mb-2">Error loading rules</div>
								<div className="text-sm text-muted-foreground">
									{rulesError.message}
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={() => refetchRules()}
									className="mt-4"
								>
									Retry
								</Button>
							</div>
						) : rules.length === 0 ? (
							<div className="text-center py-12 text-muted-foreground">
								No auto-reply rules found. Create your first rule to get started.
							</div>
						) : (
							rules.map((rule) => (
							<Card key={rule.id} className="border-2">
								<CardContent>
									<div className="space-y-6">
										{/* Message Owner - with green border outline */}
										<div className="flex items-center justify-between border-2 border-green-500 rounded-md p-3 bg-muted/30">
											<div className="flex items-center gap-2.5">
												<RiUserLine className="size-5 text-foreground" />
												<span className="text-base font-semibold text-foreground">{rule.messageOwner}</span>
											</div>
											<Badge
												variant="outline"
												className={`text-xs font-semibold ${
													rule.status === "owner"
														? "border-blue-500 text-blue-600 dark:text-blue-400"
														: "border-purple-500 text-purple-600 dark:text-purple-400"
												}`}
											>
												{rule.status === "owner" ? "Owner" : "Tenant"}
											</Badge>
										</div>

										{/* Trigger */}
										<div className="space-y-3">
											<div className="text-sm font-bold text-foreground uppercase tracking-wider">
												TRIGGER:
											</div>
											<div className="text-base text-foreground">
												Message contains:{" "}
												<span className="font-semibold">
													"{rule.trigger.keywords.join('" or "')}"
												</span>
											</div>
										</div>

										{/* Response */}
										<div className="space-y-3">
											<div className="text-sm font-bold text-foreground uppercase tracking-wider">
												RESPONSE:
											</div>
											<div className="relative">
												<Input
													value={`"${rule.response}"`}
													readOnly
													className="bg-muted/60 border border-border rounded-md text-base py-3 px-4 font-normal text-foreground cursor-default"
												/>
											</div>
										</div>

										{/* Action Buttons */}
										<div className="flex items-center gap-2 pt-4 border-t">
											<Button
												variant="outline"
												size="sm"
												onClick={() => handleDeleteClick(rule)}
												className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:border-red-500/50 dark:hover:bg-red-500/10 dark:hover:text-red-300"
											>
												<RiDeleteBinLine className="mr-2 h-4 w-4" />
												Delete
											</Button>
										</div>
									</div>
								</CardContent>
							</Card>
							))
						)}
					</div>

					{/* Summary */}
					<div className="flex items-center justify-between border-t pt-4">
						<div className="text-sm text-muted-foreground">
							Total Rules: <span className="font-medium">{summary.total}</span> | Owner:{" "}
							<span className="font-medium text-blue-600 dark:text-blue-400">{summary.owner}</span> | Tenant:{" "}
							<span className="font-medium text-purple-600 dark:text-purple-400">{summary.tenant}</span>
						</div>
					</div>
				</div>

				{/* Delete Confirmation Dialog */}
				<Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
					<DialogContent className="sm:max-w-[500px]">
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
								<RiAlertLine className="size-5" />
								Delete Auto-Reply Rule
							</DialogTitle>
							<DialogDescription>
								Are you sure you want to delete this auto-reply rule? This action cannot be undone.
							</DialogDescription>
						</DialogHeader>

						{ruleToDelete && (
							<div className="py-4">
								<div className="rounded-lg border bg-muted/30 p-4">
									<div className="space-y-4">
										{/* Message Owner */}
										<div className="flex items-center justify-between border-2 border-green-500 rounded-md p-3 bg-muted/30">
											<div className="flex items-center gap-2.5">
												<RiUserLine className="size-5 text-foreground" />
												<span className="text-base font-semibold text-foreground">
													{ruleToDelete.messageOwner}
												</span>
											</div>
											<Badge
												variant="outline"
												className={`text-xs font-semibold ${
													ruleToDelete.status === "owner"
														? "border-blue-500 text-blue-600 dark:text-blue-400"
														: "border-purple-500 text-purple-600 dark:text-purple-400"
												}`}
											>
												{ruleToDelete.status === "owner" ? "Owner" : "Tenant"}
											</Badge>
										</div>

										{/* Trigger */}
										<div className="space-y-2">
											<div className="text-sm font-bold text-foreground uppercase tracking-wider">
												TRIGGER:
											</div>
											<div className="text-base text-foreground">
												Message contains:{" "}
												<span className="font-semibold">
													"{ruleToDelete.trigger.keywords.join('" or "')}"
												</span>
											</div>
										</div>

										{/* Response */}
										<div className="space-y-2">
											<div className="text-sm font-bold text-foreground uppercase tracking-wider">
												RESPONSE:
											</div>
											<div className="rounded-md bg-muted/60 border border-border p-3 text-sm text-foreground">
												"{ruleToDelete.response}"
											</div>
										</div>
									</div>
								</div>
							</div>
						)}

						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => {
									setIsDeleteDialogOpen(false);
									setRuleToDelete(null);
								}}
								disabled={deleteRuleMutation.isPending}
							>
								Cancel
							</Button>
							<Button
								onClick={handleDeleteConfirm}
								disabled={deleteRuleMutation.isPending}
								className="bg-red-600 hover:bg-red-700"
							>
								{deleteRuleMutation.isPending ? (
									<>
										<RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
										Deleting...
									</>
								) : (
									<>
										<RiDeleteBinLine className="mr-2 h-4 w-4" />
										Delete Rule
									</>
								)}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</SidebarInset>
		</SidebarProvider>
	);
}
