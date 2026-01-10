"use client";

import { useState } from "react";
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

// Mock data types
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

// Mock rules data
const initialRules: AutoReplyRule[] = [
	{
		id: "1",
		trigger: {
			type: "contains",
			keywords: ["hello", "hi"],
		},
		response: "Hello! Thank you for contacting us. How can I assist you today?",
		messageOwner: "John Smith",
		status: "owner",
		logCount: 12,
	},
	{
		id: "2",
		trigger: {
			type: "contains",
			keywords: ["price", "cost"],
		},
		response: "The price range for properties varies. Let me connect you with our agent for detailed pricing information.",
		messageOwner: "Sarah Lee",
		status: "tenant",
		logCount: 8,
	},
	{
		id: "3",
		trigger: {
			type: "contains",
			keywords: ["view", "visit", "see"],
		},
		response: "I'd be happy to schedule a property viewing for you. Please let me know your preferred date and time.",
		messageOwner: "John Smith",
		status: "owner",
		logCount: 5,
	},
	{
		id: "4",
		trigger: {
			type: "contains",
			keywords: ["location", "where", "address"],
		},
		response: "The property is located in a prime area. I'll send you the exact address shortly.",
		messageOwner: "Mike Chen",
		status: "tenant",
		logCount: 3,
	},
];

export default function AutoReplyPage() {
	const [rules, setRules] = useState<AutoReplyRule[]>(initialRules);
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<"all" | "tenant" | "owner">("all");
	const [sortBy, setSortBy] = useState<"owner" | "status">("status");
	const [isNewRuleDialogOpen, setIsNewRuleDialogOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [ruleToDelete, setRuleToDelete] = useState<AutoReplyRule | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	// Filter and sort rules
	const filteredRules = rules
		.filter((rule) => {
			const matchesSearch =
				rule.response.toLowerCase().includes(searchQuery.toLowerCase()) ||
				rule.trigger.keywords.some((keyword) =>
					keyword.toLowerCase().includes(searchQuery.toLowerCase())
				) ||
				rule.messageOwner.toLowerCase().includes(searchQuery.toLowerCase());
			const matchesStatus =
				statusFilter === "all" || rule.status === statusFilter;
			return matchesSearch && matchesStatus;
		})
		.sort((a, b) => {
			if (sortBy === "status") {
				// Sort by status: owner first, then tenant
				if (a.status === b.status) {
					return a.messageOwner.localeCompare(b.messageOwner);
				}
				return a.status === "owner" ? -1 : 1;
			}
			if (sortBy === "owner") {
				return a.messageOwner.localeCompare(b.messageOwner);
			}
			return 0;
		});

	const totalRules = rules.length;
	const ownerRules = rules.filter((r) => r.status === "owner").length;
	const tenantRules = rules.filter((r) => r.status === "tenant").length;

	const handleNewRule = () => {
		setIsNewRuleDialogOpen(true);
	};

	const handleEdit = (rule: AutoReplyRule) => {
		// TODO: Open edit dialog
		console.log("Edit rule:", rule);
	};

	const handleDeleteClick = (rule: AutoReplyRule) => {
		setRuleToDelete(rule);
		setIsDeleteDialogOpen(true);
	};

	const handleDeleteConfirm = async () => {
		if (!ruleToDelete) return;

		setIsDeleting(true);
		try {
			// TODO: Replace with actual API call
			setRules((prev) => prev.filter((r) => r.id !== ruleToDelete.id));

			toast.success("Auto-reply rule deleted successfully!");
			setIsDeleteDialogOpen(false);
			setRuleToDelete(null);
		} catch (error) {
			console.error("Error deleting rule:", error);
			toast.error("Failed to delete rule. Please try again.");
		} finally {
			setIsDeleting(false);
		}
	};

	const handleTest = (rule: AutoReplyRule) => {
		// TODO: Test rule execution
		console.log("Test rule:", rule);
	};

	const handleViewLogs = (rule: AutoReplyRule) => {
		// TODO: Open logs dialog
		console.log("View logs for rule:", rule);
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
						{filteredRules.map((rule) => (
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
						))}
					</div>

					{/* Summary */}
					<div className="flex items-center justify-between border-t pt-4">
						<div className="text-sm text-muted-foreground">
							Total Rules: <span className="font-medium">{totalRules}</span> | Owner:{" "}
							<span className="font-medium text-blue-600 dark:text-blue-400">{ownerRules}</span> | Tenant:{" "}
							<span className="font-medium text-purple-600 dark:text-purple-400">{tenantRules}</span>
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
								disabled={isDeleting}
							>
								Cancel
							</Button>
							<Button
								onClick={handleDeleteConfirm}
								disabled={isDeleting}
								className="bg-red-600 hover:bg-red-700"
							>
								{isDeleting ? (
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
