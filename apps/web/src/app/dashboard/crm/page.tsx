"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { KanbanBoard, type PipelineStage } from "@/components/crm-kanban-board";
import { HeaderActions } from "@/components/header-actions";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/sidebar";
import { TagSelector } from "@/components/tag-selector";
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
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { LoadingScreen } from "@/components/ui/loading-spinner";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	RiAddLine,
	RiAlertLine,
	RiCalendarLine,
	RiDashboardLine,
	RiDeleteBinLine,
	RiEyeLine,
	RiHomeLine,
	RiLinksLine,
	RiLoader4Line,
	RiMailLine,
	RiMapPinLine,
	RiMessageLine,
	RiPhoneLine,
	RiPriceTagLine,
	RiSearchLine,
	RiUserLine,
} from "@remixicon/react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

// Pipeline stages for Kanban board
type LeadType = "personal" | "company";

// Prospect interface matching database schema
// Dates come as strings from API and are converted when needed
interface Prospect {
	id: string;
	name: string;
	email: string;
	phone: string;
	source: string;
	type: "tenant" | "buyer";
	property: string; // Free text field
	projectId?: string | null; // Optional developer project (admin-managed)
	projectName?: string | null; // Joined label from backend
	status: "active" | "inactive" | "pending";
	stage: PipelineStage; // New: Pipeline stage for Kanban
	leadType: LeadType; // New: Personal or company lead
	tags: string | null; // Old: Comma-separated tags (kept for backward compatibility)
	tagIds?: string[]; // New: Array of tag IDs (optional for backward compatibility)
	tagNames?: string[]; // New: Array of tag names (optional for backward compatibility)
	lastContact: Date | string | null;
	nextContact: Date | string | null;
	agentId: string | null; // Can be null for unclaimed company leads
	agentName?: string | null; // Agent name (from backend join)
	createdAt: Date | string;
	updatedAt: Date | string;
}

// Prospect note interface
interface ProspectNote {
	id: string;
	prospectId: string;
	content: string;
	agentId: string;
	agentName?: string; // Agent name (from backend join)
	createdAt: Date | string;
}

// Form validation schema
const prospectFormSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters"),
	email: z.string().email("Please enter a valid email address"),
	phone: z
		.string()
		.min(8, "Phone number must be at least 8 characters")
		.regex(/^[\d\s\+\-\(\)]+$/, "Please enter a valid phone number"),
	source: z.string().min(1, "Please select a source"),
	type: z.enum(["tenant", "buyer"], {
		required_error: "Please select a type",
	}),
	property: z.string().min(1, "Property name is required"),
	projectId: z.string().uuid().optional(),
	status: z.enum(["active", "inactive", "pending"], {
		required_error: "Please select a status",
	}),
	stage: z
		.enum([
			"new_lead",
			"follow_up_in_progress",
			"no_pick_reply",
			"follow_up_for_appointment",
			"potential_lead",
			"consider_seen",
			"appointment_made",
			"reject_project",
			"booking_made",
			"spam_fake_lead",
		])
		.default("new_lead")
		.optional(),
	leadType: z.enum(["personal", "company"]).default("personal").optional(),
	tagIds: z.array(z.string().uuid()).optional(),
});

type ProspectFormValues = z.infer<typeof prospectFormSchema>;

// Helper function to format date for display
// Handle both Date objects and date strings from API
const formatContactDate = (
	date: Date | string | null | undefined,
): string | undefined => {
	if (!date) return undefined;

	// Convert string to Date if needed
	const dateObj = typeof date === "string" ? new Date(date) : date;

	// Check if date is valid
	if (Number.isNaN(dateObj.getTime())) return undefined;

	const now = new Date();
	const diffMs = now.getTime() - dateObj.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) return "Today";
	if (diffDays === 1) return "1 day ago";
	if (diffDays < 7) return `${diffDays} days ago`;

	// For future dates
	if (diffMs < 0) {
		const futureDays = Math.abs(diffDays);
		if (futureDays === 0) return "Today";
		if (futureDays === 1) return "Tomorrow";
		return `In ${futureDays} days`;
	}

	return dateObj.toLocaleDateString();
};

type ViewMode = "list" | "kanban";
type LeadsTab = "my" | "company";

export default function CRMPage() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { data: session, isPending } = authClient.useSession();
	const [activeTab, setActiveTab] = useState<LeadsTab>("my"); // My Leads | Company Leads
	const [viewMode, setViewMode] = useState<ViewMode>("list"); // New: View mode toggle
	const [searchQuery, setSearchQuery] = useState("");
	const [typeFilter, setTypeFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState("all");
	const [propertyFilter, setPropertyFilter] = useState("all");
	const [currentPage, setCurrentPage] = useState(1);
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isStagePromptOpen, setIsStagePromptOpen] = useState(false);
	const [stagePromptProspect, setStagePromptProspect] =
		useState<Prospect | null>(null);
	const [stagePromptMessage, setStagePromptMessage] = useState("");
	const [stagePromptTargetStage, setStagePromptTargetStage] =
		useState<PipelineStage | null>(null);
	const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(
		null,
	);
	const [prospectToDelete, setProspectToDelete] = useState<Prospect | null>(
		null,
	);
	const itemsPerPage = 10;

	// Projects (admin-managed developer projects) for dropdown selection
	const { data: projectsData } = trpc.crm.projectsList.useQuery(undefined, {
		enabled: !!session,
		staleTime: 60_000,
	});

	// Fetch prospects with tRPC - only when session is available
	const {
		data: prospectsData,
		isLoading: isLoadingProspects,
		error: prospectsError,
		refetch: refetchProspects,
	} = trpc.crm.list.useQuery(
		{
			search: searchQuery || undefined,
			type:
				typeFilter !== "all" ? (typeFilter as "tenant" | "buyer") : undefined,
			property: propertyFilter !== "all" ? propertyFilter : undefined,
			status:
				statusFilter !== "all"
					? (statusFilter as "active" | "inactive" | "pending")
					: undefined,
			leadType: activeTab === "company" ? "company" : undefined,
			includeCompanyLeads: activeTab === "company",
			page: currentPage,
			limit: viewMode === "kanban" ? 1000 : itemsPerPage,
		},
		{
			enabled: !!session,
			retry: 1,
			staleTime: 30000,
		},
	);

	const prospects = prospectsData?.prospects || [];
	const totalPages = prospectsData?.pagination.totalPages || 0;

	// Form setup
	const form = useForm<ProspectFormValues>({
		resolver: zodResolver(prospectFormSchema),
		defaultValues: {
			name: "",
			email: "",
			phone: "",
			source: "",
			type: "buyer",
			property: "",
			status: "active",
			leadType: "personal",
		},
	});

	// Create prospect mutation
	const createProspectMutation = trpc.crm.create.useMutation({
		onSuccess: () => {
			toast.success("Prospect added successfully!");
			setIsAddDialogOpen(false);
			form.reset();
			// Invalidate and refetch prospects list
			queryClient.invalidateQueries({ queryKey: [["crm", "list"]] });
			refetchProspects();
		},
		onError: (error) => {
			console.error("Error adding prospect:", error);
			toast.error("Failed to add prospect. Please try again.");
		},
	});

	// Delete prospect mutation
	const deleteProspectMutation = trpc.crm.delete.useMutation({
		onSuccess: () => {
			toast.success("Prospect deleted successfully!");
			setIsDeleteDialogOpen(false);
			setProspectToDelete(null);
			// Invalidate and refetch prospects list
			queryClient.invalidateQueries({ queryKey: [["crm", "list"]] });
			refetchProspects();
		},
		onError: (error) => {
			console.error("Error deleting prospect:", error);
			toast.error("Failed to delete prospect. Please try again.");
		},
	});

	const handleAddProspect = () => {
		form.reset({
			name: "",
			email: "",
			phone: "",
			source: "",
			type: "buyer",
			property: "",
			status: "active",
			leadType: activeTab === "company" ? "company" : "personal",
		});
		setIsAddDialogOpen(true);
	};

	const onSubmit = async (data: ProspectFormValues) => {
		createProspectMutation.mutate(data);
	};

	const handleMessage = (prospect: Prospect) => {
		// TODO: Open WhatsApp message
		console.log("Message prospect:", prospect);

		// Show micro-prompt to move to Follow Up In Progress stage
		if (prospect.stage === "new_lead") {
			setStagePromptProspect(prospect);
			setStagePromptMessage("Move lead to Follow Up In Progress?");
			setStagePromptTargetStage("follow_up_in_progress");
			setIsStagePromptOpen(true);
		}
	};

	const handleCall = (prospect: Prospect) => {
		// TODO: Initiate call
		console.log("Call prospect:", prospect);

		// Show micro-prompt based on current stage
		if (prospect.stage === "new_lead") {
			setStagePromptProspect(prospect);
			setStagePromptMessage("Move lead to Follow Up In Progress?");
			setStagePromptTargetStage("follow_up_in_progress");
			setIsStagePromptOpen(true);
		} else if (prospect.stage === "follow_up_in_progress") {
			setStagePromptProspect(prospect);
			setStagePromptMessage("Move lead to Follow Up For Appointment?");
			setStagePromptTargetStage("follow_up_for_appointment");
			setIsStagePromptOpen(true);
		}
	};

	// Fetch notes for selected prospect
	const { data: notesData, refetch: refetchNotes } = trpc.crm.getNotes.useQuery(
		{ id: selectedProspect?.id || "" },
		{
			enabled: !!selectedProspect?.id && isViewDialogOpen,
		},
	);

	const notes: ProspectNote[] = (notesData || []) as ProspectNote[];

	const handleView = (prospect: Prospect) => {
		setSelectedProspect(prospect);
		setIsViewDialogOpen(true);
	};

	const [newNoteContent, setNewNoteContent] = useState("");

	// Add note mutation
	const addNoteMutation = trpc.crm.addNote.useMutation({
		onSuccess: () => {
			toast.success("Note added successfully!");
			refetchNotes();
			setNewNoteContent("");
		},
		onError: (error) => {
			console.error("Error adding note:", error);
			toast.error("Failed to add note. Please try again.");
		},
	});

	const handleAddNote = () => {
		if (!selectedProspect?.id || !newNoteContent.trim()) return;
		addNoteMutation.mutate({
			prospectId: selectedProspect.id,
			content: newNoteContent.trim(),
		});
	};

	const handleLink = (prospect: Prospect) => {
		// TODO: Link to transaction
		console.log("Link prospect:", prospect);
	};

	const handleDeleteClick = (prospect: Prospect) => {
		setProspectToDelete(prospect);
		setIsDeleteDialogOpen(true);
	};

	const handleDeleteConfirm = async () => {
		if (!prospectToDelete) return;
		deleteProspectMutation.mutate({ id: prospectToDelete.id });
	};

	// Stage change handler (for Kanban drag-and-drop) with optimistic updates
	const updateStageMutation = trpc.crm.updateStage.useMutation({
		onMutate: async (variables) => {
			// Cancel any outgoing refetches (so they don't overwrite our optimistic update)
			await queryClient.cancelQueries({ queryKey: [["crm", "list"]] });

			// Snapshot the previous value
			const previousData = queryClient.getQueryData([["crm", "list"]]);

			// Optimistically update the cache - move prospect to new stage immediately
			queryClient.setQueryData(
				[["crm", "list"]],
				(old: { prospects?: Prospect[] } | undefined) => {
					if (!old?.prospects) return old;
					return {
						...old,
						prospects: old.prospects.map((p) =>
							p.id === variables.id
								? {
										...p,
										stage: variables.stage,
										updatedAt: new Date().toISOString(),
									}
								: p,
						),
					};
				},
			);

			// Return context with the snapshotted value for rollback
			return { previousData };
		},
		onSuccess: () => {
			// Silently sync with server (no toast for drag-and-drop to avoid spam)
			queryClient.invalidateQueries({ queryKey: [["crm", "list"]] });
		},
		onError: (error, variables, context) => {
			// Rollback optimistic update on error
			if (context?.previousData) {
				queryClient.setQueryData([["crm", "list"]], context.previousData);
			}
			console.error("Error updating stage:", error);
			toast.error("Failed to update stage. Please try again.");
		},
	});

	const handleStageChange = (prospectId: string, newStage: PipelineStage) => {
		updateStageMutation.mutate({ id: prospectId, stage: newStage });
	};

	const handleStagePromptConfirm = () => {
		if (stagePromptProspect && stagePromptTargetStage) {
			handleStageChange(stagePromptProspect.id, stagePromptTargetStage);
		}
		setIsStagePromptOpen(false);
		setStagePromptProspect(null);
		setStagePromptMessage("");
		setStagePromptTargetStage(null);
	};

	const handleStagePromptCancel = () => {
		setIsStagePromptOpen(false);
		setStagePromptProspect(null);
		setStagePromptMessage("");
		setStagePromptTargetStage(null);
	};

	// Claim lead handler
	const claimLeadMutation = trpc.crm.claimLead.useMutation({
		onSuccess: () => {
			toast.success("Lead claimed successfully!");
			queryClient.invalidateQueries({ queryKey: [["crm", "list"]] });
			refetchProspects();
		},
		onError: (error) => {
			console.error("Error claiming lead:", error);
			toast.error("Failed to claim lead. Please try again.");
		},
	});

	const handleClaimLead = (prospectId: string) => {
		claimLeadMutation.mutate({ id: prospectId });
	};

	// Authentication check
	if (isPending) {
		return <LoadingScreen text="Loading..." />;
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
										<RiUserLine size={18} />
										CRM
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
					{/* Page Header with My Leads / Company Leads tabs */}
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex items-center gap-4">
							<h1 className="font-semibold text-2xl">
								CRM - Prospect Management
							</h1>
							{/* My Leads | Company Leads tabs */}
							<div
								className="flex items-center gap-1 rounded-md border bg-muted/50 p-1"
								role="tablist"
								aria-label="Lead type"
							>
								<Button
									type="button"
									role="tab"
									aria-selected={activeTab === "my"}
									variant={activeTab === "my" ? "default" : "ghost"}
									size="sm"
									onClick={() => setActiveTab("my")}
									className="h-8"
								>
									My Leads
								</Button>
								<Button
									type="button"
									role="tab"
									aria-selected={activeTab === "company"}
									variant={activeTab === "company" ? "default" : "ghost"}
									size="sm"
									onClick={() => setActiveTab("company")}
									className="h-8"
								>
									Company Leads
								</Button>
							</div>
						</div>
						<div className="flex items-center gap-3">
							{/* View Toggle */}
							<div className="flex items-center gap-1 rounded-md border bg-muted/50 p-1">
								<Button
									type="button"
									variant={viewMode === "list" ? "default" : "ghost"}
									size="sm"
									onClick={() => setViewMode("list")}
									className="h-8"
								>
									List View
								</Button>
								<Button
									type="button"
									variant={viewMode === "kanban" ? "default" : "ghost"}
									size="sm"
									onClick={() => setViewMode("kanban")}
									className="h-8"
								>
									Kanban View
								</Button>
							</div>
							<Button
								type="button"
								onClick={handleAddProspect}
								size="sm"
								className="bg-green-600 hover:bg-green-700"
							>
								<RiAddLine className="mr-2 h-4 w-4" />
								Add
							</Button>
						</div>
					</div>

					{/* Add Prospect Dialog */}
					<Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
						<DialogContent className="sm:max-w-[600px]">
							<DialogHeader>
								<DialogTitle className="flex items-center gap-2">
									<RiUserLine className="size-5" />
									Add New Prospect
								</DialogTitle>
								<DialogDescription>
									Enter the prospect's information to add them to your CRM.
								</DialogDescription>
							</DialogHeader>

							<Form {...form}>
								<form
									onSubmit={form.handleSubmit(onSubmit)}
									className="space-y-4"
								>
									{/* Name */}
									<FormField
										control={form.control}
										name="name"
										render={({ field }) => (
											<FormItem>
												<FormLabel>
													Full Name <span className="text-destructive">*</span>
												</FormLabel>
												<FormControl>
													<Input placeholder="John Smith" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									{/* Email */}
									<FormField
										control={form.control}
										name="email"
										render={({ field }) => (
											<FormItem>
												<FormLabel>
													Email Address{" "}
													<span className="text-destructive">*</span>
												</FormLabel>
												<FormControl>
													<Input
														type="email"
														placeholder="john@email.com"
														{...field}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									{/* Phone */}
									<FormField
										control={form.control}
										name="phone"
										render={({ field }) => (
											<FormItem>
												<FormLabel>
													Phone Number{" "}
													<span className="text-destructive">*</span>
												</FormLabel>
												<FormControl>
													<Input placeholder="+65 9123 4567" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									{/* Source */}
									<FormField
										control={form.control}
										name="source"
										render={({ field }) => (
											<FormItem>
												<FormLabel>
													Source <span className="text-destructive">*</span>
												</FormLabel>
												<Select
													onValueChange={field.onChange}
													defaultValue={field.value}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select source" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="Website">Website</SelectItem>
														<SelectItem value="Social Media">
															Social Media
														</SelectItem>
														<SelectItem value="Referral">Referral</SelectItem>
														<SelectItem value="Walk-in">Walk-in</SelectItem>
														<SelectItem value="Other">Other</SelectItem>
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>

									{/* Type and Property - Side by Side */}
									<div className="grid grid-cols-2 gap-4">
										<FormField
											control={form.control}
											name="type"
											render={({ field }) => (
												<FormItem>
													<FormLabel>
														Type <span className="text-destructive">*</span>
													</FormLabel>
													<Select
														onValueChange={field.onChange}
														defaultValue={field.value}
													>
														<FormControl>
															<SelectTrigger>
																<SelectValue placeholder="Select type" />
															</SelectTrigger>
														</FormControl>
														<SelectContent>
															<SelectItem value="tenant">Tenant</SelectItem>
															<SelectItem value="buyer">Buyer</SelectItem>
														</SelectContent>
													</Select>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={form.control}
											name="property"
											render={({ field }) => (
												<FormItem>
													<FormLabel>
														Property <span className="text-destructive">*</span>
													</FormLabel>
													<FormControl>
														<Input
															{...field}
															placeholder="Enter property name (e.g., Breeze Hill, Marina Bay Residences)"
														/>
													</FormControl>
													<FormDescription>
														Enter the property name. Tags can be used to
														categorize properties in the database.
													</FormDescription>
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>

									{/* Developer Project (admin-managed) */}
									<FormField
										control={form.control}
										name="projectId"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Developer Project</FormLabel>
												<Select
													onValueChange={(value) =>
														field.onChange(
															value === "__none__" ? undefined : value,
														)
													}
													value={field.value ?? "__none__"}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select developer project (optional)" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="__none__">None</SelectItem>
														{(projectsData || []).map(
															(p: { id: string; name: string }) => (
																<SelectItem key={p.id} value={p.id}>
																	{p.name}
																</SelectItem>
															),
														)}
													</SelectContent>
												</Select>
												<FormDescription>
													Optional: choose a developer project defined by admin.
													For agent-defined project names, use the Property
													field or tags.
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>

									{/* Status */}
									<FormField
										control={form.control}
										name="status"
										render={({ field }) => (
											<FormItem>
												<FormLabel>
													Status <span className="text-destructive">*</span>
												</FormLabel>
												<Select
													onValueChange={field.onChange}
													defaultValue={field.value}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select status" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="active">Active</SelectItem>
														<SelectItem value="inactive">Inactive</SelectItem>
														<SelectItem value="pending">Pending</SelectItem>
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>

									{/* Tags */}
									<FormField
										control={form.control}
										name="tagIds"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Tags</FormLabel>
												<FormControl>
													<TagSelector
														value={field.value || []}
														onChange={field.onChange}
														placeholder="Select tags..."
													/>
												</FormControl>
												<FormMessage />
												<p className="text-muted-foreground text-xs">
													Select tags from the master list to categorize this
													prospect by project.
												</p>
											</FormItem>
										)}
									/>

									<DialogFooter>
										<Button
											type="button"
											variant="outline"
											onClick={() => setIsAddDialogOpen(false)}
											disabled={createProspectMutation.isPending}
										>
											Cancel
										</Button>
										<Button
											type="submit"
											disabled={createProspectMutation.isPending}
											className="bg-green-600 hover:bg-green-700"
										>
											{createProspectMutation.isPending ? (
												<>
													<RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
													Adding...
												</>
											) : (
												<>
													<RiAddLine className="mr-2 h-4 w-4" />
													Add Prospect
												</>
											)}
										</Button>
									</DialogFooter>
								</form>
							</Form>
						</DialogContent>
					</Dialog>

					{/* View Prospect Dialog */}
					<Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
						<DialogContent className="sm:max-w-[600px]">
							<DialogHeader>
								<DialogTitle className="flex items-center gap-2">
									<RiUserLine className="size-5" />
									Prospect Details
								</DialogTitle>
								<DialogDescription>
									View complete information about this prospect.
								</DialogDescription>
							</DialogHeader>

							{selectedProspect && (
								<div className="space-y-6 py-4">
									{/* Name Section */}
									<div className="space-y-2" style={{ marginBottom: "15px" }}>
										<div className="flex items-center gap-2 font-medium text-muted-foreground text-sm">
											<RiUserLine className="size-4" />
											Full Name
										</div>
										<div className="font-semibold text-base">
											{selectedProspect.name}
										</div>
									</div>

									{/* Contact Information */}
									<div className="space-y-3" style={{ marginBottom: "15px" }}>
										<div className="font-medium text-muted-foreground text-sm">
											Contact Information
										</div>
										<div className="space-y-3 rounded-lg border bg-muted/30 p-4">
											<div className="flex items-center gap-3">
												<RiMailLine className="size-4 text-muted-foreground" />
												<div className="flex-1">
													<div className="text-muted-foreground text-xs">
														Email
													</div>
													<div className="font-medium text-sm">
														{selectedProspect.email}
													</div>
												</div>
											</div>
											<div className="flex items-center gap-3">
												<RiPhoneLine className="size-4 text-muted-foreground" />
												<div className="flex-1">
													<div className="text-muted-foreground text-xs">
														Phone
													</div>
													<div className="font-medium text-sm">
														{selectedProspect.phone}
													</div>
												</div>
											</div>
										</div>
									</div>

									{/* Prospect Details */}
									<div className="space-y-3" style={{ marginBottom: "15px" }}>
										<div className="font-medium text-muted-foreground text-sm">
											Prospect Details
										</div>
										<div className="space-y-3 rounded-lg border bg-muted/30 p-4">
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2 text-muted-foreground text-sm">
													<RiMapPinLine className="size-4" />
													Source
												</div>
												<div className="font-medium text-sm">
													{selectedProspect.source}
												</div>
											</div>
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2 text-muted-foreground text-sm">
													<RiPriceTagLine className="size-4" />
													Type
												</div>
												<Badge variant="outline" className="capitalize">
													{selectedProspect.type === "tenant"
														? "Tenant"
														: "Owner"}
												</Badge>
											</div>
											{(selectedProspect.tagNames &&
												selectedProspect.tagNames.length > 0) ||
											selectedProspect.tags?.trim() ? (
												<div className="flex items-center justify-between">
													<div className="flex items-center gap-2 text-muted-foreground text-sm">
														<RiPriceTagLine className="size-4" />
														Tags
													</div>
													<div className="flex flex-wrap gap-2">
														{selectedProspect.tagNames &&
														selectedProspect.tagNames.length > 0
															? selectedProspect.tagNames.map((tag, idx) => (
																	<Badge
																		key={idx}
																		variant="secondary"
																		className="text-xs"
																	>
																		{tag}
																	</Badge>
																))
															: selectedProspect.tags
																? selectedProspect.tags
																		.split(",")
																		.map((tag, idx) => (
																			<Badge
																				key={idx}
																				variant="secondary"
																				className="text-xs"
																			>
																				{tag.trim()}
																			</Badge>
																		))
																: null}
													</div>
												</div>
											) : null}
											{selectedProspect.agentName && (
												<div className="flex items-center justify-between">
													<div className="flex items-center gap-2 text-muted-foreground text-sm">
														<RiUserLine className="size-4" />
														Owner
													</div>
													<div className="font-medium text-sm">
														{selectedProspect.agentName}
													</div>
												</div>
											)}
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2 text-muted-foreground text-sm">
													<RiPriceTagLine className="size-4" />
													Status
												</div>
												<Badge
													variant="outline"
													className={`capitalize ${
														selectedProspect.status === "active"
															? "border-green-500 text-green-700 dark:text-green-400"
															: selectedProspect.status === "pending"
																? "border-yellow-500 text-yellow-700 dark:text-yellow-400"
																: "border-gray-500 text-gray-700 dark:text-gray-400"
													}`}
												>
													{selectedProspect.status}
												</Badge>
											</div>
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2 text-muted-foreground text-sm">
													<RiHomeLine className="size-4" />
													Property
												</div>
												<div className="font-medium text-sm">
													{selectedProspect.property || "Not specified"}
												</div>
											</div>
											{selectedProspect.projectName && (
												<div className="flex items-center justify-between">
													<div className="flex items-center gap-2 text-muted-foreground text-sm">
														<RiHomeLine className="size-4" />
														Developer Project
													</div>
													<div className="font-medium text-sm">
														{selectedProspect.projectName}
													</div>
												</div>
											)}
										</div>
									</div>

									{/* Contact History */}
									{(selectedProspect.lastContact ||
										selectedProspect.nextContact) && (
										<div className="space-y-3">
											<div className="font-medium text-muted-foreground text-sm">
												Contact History
											</div>
											<div className="space-y-2 rounded-lg border bg-muted/30 p-4">
												{selectedProspect.lastContact && (
													<div className="flex items-center gap-3">
														<RiCalendarLine className="size-4 text-muted-foreground" />
														<div className="flex-1">
															<div className="text-muted-foreground text-xs">
																Last Contact
															</div>
															<div className="font-medium text-sm">
																{formatContactDate(
																	selectedProspect.lastContact,
																)}
															</div>
														</div>
													</div>
												)}
												{selectedProspect.nextContact && (
													<div className="flex items-center gap-3">
														<RiCalendarLine className="size-4 text-muted-foreground" />
														<div className="flex-1">
															<div className="text-muted-foreground text-xs">
																Next Contact
															</div>
															<div className="font-medium text-sm">
																{formatContactDate(
																	selectedProspect.nextContact,
																)}
															</div>
														</div>
													</div>
												)}
											</div>
										</div>
									)}

									{/* Notes Timeline */}
									<div className="space-y-3">
										<div className="font-medium text-muted-foreground text-sm">
											Notes & Timeline
										</div>
										<div
											className="max-h-64 space-y-3 overflow-y-auto rounded-lg border bg-muted/30 p-4"
											style={{ height: "100px" }}
										>
											{notes.length === 0 ? (
												<div className="py-4 text-center text-muted-foreground text-sm">
													No notes yet. Add a note to track interactions.
												</div>
											) : (
												notes.map((note) => {
													const noteDate = new Date(note.createdAt);
													// Format date with GMT timezone (e.g., "Dec 23, 2025 04:45 PM (GMT +08)")
													const formattedDate = noteDate.toLocaleString(
														"en-US",
														{
															month: "short",
															day: "numeric",
															year: "numeric",
															hour: "2-digit",
															minute: "2-digit",
															hour12: true,
														},
													);
													// Get GMT offset
													const gmtOffset = -noteDate.getTimezoneOffset() / 60;
													const gmtSign = gmtOffset >= 0 ? "+" : "";
													const gmtString = `(GMT ${gmtSign}${gmtOffset.toString().padStart(2, "0")})`;

													return (
														<div
															key={note.id}
															className="space-y-1 border-b pb-3 last:border-0 last:pb-0"
														>
															<div className="text-foreground text-sm">
																{note.content}
															</div>
															<div className="flex items-center gap-2 text-muted-foreground text-xs">
																<span>
																	{formattedDate} {gmtString}
																</span>
																{note.agentName && (
																	<>
																		<span>•</span>
																		<span>Created by: {note.agentName}</span>
																	</>
																)}
															</div>
														</div>
													);
												})
											)}
										</div>
										{/* Add Note Form */}
										<div className="flex gap-2">
											<Input
												placeholder="Add a note..."
												value={newNoteContent}
												onChange={(e) => setNewNoteContent(e.target.value)}
												onKeyDown={(e) => {
													if (e.key === "Enter" && !e.shiftKey) {
														e.preventDefault();
														handleAddNote();
													}
												}}
											/>
											<Button
												size="sm"
												onClick={handleAddNote}
												disabled={
													!newNoteContent.trim() || addNoteMutation.isPending
												}
											>
												{addNoteMutation.isPending ? (
													<RiLoader4Line className="h-4 w-4 animate-spin" />
												) : (
													"Add"
												)}
											</Button>
										</div>
									</div>
								</div>
							)}

							<DialogFooter>
								<Button
									variant="outline"
									onClick={() => setIsViewDialogOpen(false)}
								>
									Close
								</Button>
								<Button
									onClick={() => {
										if (selectedProspect) {
											handleMessage(selectedProspect);
											setIsViewDialogOpen(false);
										}
									}}
									className="bg-green-600 hover:bg-green-700"
								>
									<RiMessageLine className="mr-2 h-4 w-4" />
									Send Message
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>

					{/* Stage Transition Prompt Dialog */}
					<Dialog open={isStagePromptOpen} onOpenChange={setIsStagePromptOpen}>
						<DialogContent className="sm:max-w-[400px]">
							<DialogHeader>
								<DialogTitle className="flex items-center gap-2">
									<RiAlertLine className="size-5 text-blue-600 dark:text-blue-400" />
									Update Stage?
								</DialogTitle>
								<DialogDescription>{stagePromptMessage}</DialogDescription>
							</DialogHeader>
							{stagePromptProspect && (
								<div className="py-2">
									<div className="text-muted-foreground text-sm">
										Prospect:{" "}
										<span className="font-semibold text-foreground">
											{stagePromptProspect.name}
										</span>
									</div>
									<div className="mt-1 text-muted-foreground text-sm">
										Current:{" "}
										<span className="font-semibold text-foreground capitalize">
											{stagePromptProspect.stage.replace(/_/g, " ")}
										</span>
									</div>
									{stagePromptTargetStage && (
										<div className="mt-1 text-muted-foreground text-sm">
											New:{" "}
											<span className="font-semibold text-foreground capitalize">
												{stagePromptTargetStage.replace(/_/g, " ")}
											</span>
										</div>
									)}
								</div>
							)}
							<DialogFooter>
								<Button
									variant="outline"
									onClick={handleStagePromptCancel}
									disabled={updateStageMutation.isPending}
								>
									Cancel
								</Button>
								<Button
									onClick={handleStagePromptConfirm}
									disabled={updateStageMutation.isPending}
									className="bg-blue-600 hover:bg-blue-700"
								>
									{updateStageMutation.isPending ? (
										<>
											<RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
											Updating...
										</>
									) : (
										"Yes, Move"
									)}
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>

					{/* Delete Confirmation Dialog */}
					<Dialog
						open={isDeleteDialogOpen}
						onOpenChange={setIsDeleteDialogOpen}
					>
						<DialogContent className="sm:max-w-[500px]">
							<DialogHeader>
								<DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
									<RiAlertLine className="size-5" />
									Delete Prospect
								</DialogTitle>
								<DialogDescription>
									Are you sure you want to delete this prospect? This action
									cannot be undone.
								</DialogDescription>
							</DialogHeader>

							{prospectToDelete && (
								<div className="py-4">
									<div className="rounded-lg border bg-muted/30 p-4">
										<div className="space-y-2">
											<div className="flex items-center gap-2">
												<RiUserLine className="size-4 text-muted-foreground" />
												<span className="font-medium">
													{prospectToDelete.name}
												</span>
											</div>
											<div className="flex items-center gap-2 text-muted-foreground text-sm">
												<RiMailLine className="size-4" />
												<span>{prospectToDelete.email}</span>
											</div>
											<div className="flex items-center gap-2 text-muted-foreground text-sm">
												<RiPhoneLine className="size-4" />
												<span>{prospectToDelete.phone}</span>
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
										setProspectToDelete(null);
									}}
									disabled={deleteProspectMutation.isPending}
								>
									Cancel
								</Button>
								<Button
									variant="destructive"
									onClick={handleDeleteConfirm}
									disabled={deleteProspectMutation.isPending}
									className="bg-red-600 hover:bg-red-700"
								>
									{deleteProspectMutation.isPending ? (
										<>
											<RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
											Deleting...
										</>
									) : (
										<>
											<RiDeleteBinLine className="mr-2 h-4 w-4" />
											Delete Prospect
										</>
									)}
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>

					{/* Search and Filters */}
					<div className="flex items-center gap-3">
						<div className="relative flex-1">
							<RiSearchLine className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
							<Input
								placeholder="Search prospects..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-9"
							/>
						</div>
						<Select value={typeFilter} onValueChange={setTypeFilter}>
							<SelectTrigger className="w-32">
								<SelectValue placeholder="Type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All</SelectItem>
								<SelectItem value="tenant">Tenant</SelectItem>
								<SelectItem value="buyer">Buyer</SelectItem>
							</SelectContent>
						</Select>
						<Input
							type="text"
							placeholder="Search by property..."
							value={propertyFilter === "all" ? "" : propertyFilter}
							onChange={(e) => {
								const value = e.target.value.trim();
								setPropertyFilter(value || "all");
							}}
							className="w-48"
						/>
						<Select value={statusFilter} onValueChange={setStatusFilter}>
							<SelectTrigger className="w-36">
								<SelectValue placeholder="Status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">Status: All</SelectItem>
								<SelectItem value="active">Status: Active</SelectItem>
								<SelectItem value="inactive">Status: Inactive</SelectItem>
								<SelectItem value="pending">Status: Pending</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Prospects View - Kanban or List */}
					{viewMode === "kanban" ? (
						// Kanban Board View
						<div className="flex flex-col gap-4">
							{isLoadingProspects ? (
								<div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
									{Array.from({ length: 5 }).map((_, i) => (
										<div key={i} className="rounded-lg border bg-muted/30 p-3">
											<Skeleton className="mb-3 h-5 w-3/4" />
											<div className="space-y-2">
												{Array.from({ length: 2 }).map((_, j) => (
													<div
														key={j}
														className="rounded-md border bg-card p-3 shadow-sm"
													>
														<Skeleton className="mb-2 h-4 w-full" />
														<Skeleton className="h-3 w-3/4" />
														<div className="mt-2 flex gap-1">
															<Skeleton className="h-5 w-14 rounded-full" />
														</div>
													</div>
												))}
											</div>
										</div>
									))}
								</div>
							) : prospectsError ? (
								<div className="py-12 text-center">
									<div className="mb-2 text-red-500">
										Error loading prospects
									</div>
									<div className="text-muted-foreground text-sm">
										{prospectsError.message}
									</div>
									<Button
										variant="outline"
										size="sm"
										onClick={() => refetchProspects()}
										className="mt-4"
									>
										Retry
									</Button>
								</div>
							) : (
								<KanbanBoard
									prospects={prospects}
									onView={handleView}
									onMessage={handleMessage}
									onStageChange={handleStageChange}
									onClaimLead={handleClaimLead}
								/>
							)}
						</div>
					) : (
						// List View
						<div className="flex flex-col gap-3">
							{isLoadingProspects ? (
								<div className="flex flex-col gap-3">
									{Array.from({ length: 5 }).map((_, i) => (
										<Card key={i}>
											<CardContent className="p-4">
												<div className="flex items-start justify-between">
													<div className="flex-1 space-y-3">
														{/* Name */}
														<div className="flex items-center gap-2">
															<Skeleton className="h-4 w-4 rounded" />
															<Skeleton className="h-4 w-36" />
														</div>
														{/* Contact */}
														<div className="flex flex-wrap gap-4">
															<Skeleton className="h-3.5 w-40" />
															<Skeleton className="h-3.5 w-32" />
														</div>
														{/* Badges */}
														<div className="flex gap-2">
															<Skeleton className="h-5 w-16 rounded-full" />
															<Skeleton className="h-5 w-24 rounded-full" />
														</div>
														{/* Details row */}
														<div className="flex gap-4">
															<Skeleton className="h-3.5 w-32" />
															<Skeleton className="h-5 w-20 rounded-full" />
														</div>
													</div>
													<div className="ml-4 flex gap-2">
														<Skeleton className="h-8 w-8 rounded-md" />
														<Skeleton className="h-8 w-8 rounded-md" />
													</div>
												</div>
											</CardContent>
										</Card>
									))}
								</div>
							) : prospectsError ? (
								<div className="col-span-full py-12 text-center">
									<div className="mb-2 text-red-500">
										Error loading prospects
									</div>
									<div className="text-muted-foreground text-sm">
										{prospectsError.message}
									</div>
									<Button
										variant="outline"
										size="sm"
										onClick={() => refetchProspects()}
										className="mt-4"
									>
										Retry
									</Button>
								</div>
							) : prospects.length === 0 ? (
								<div className="col-span-full py-12 text-center text-muted-foreground">
									No prospects found. Click "Add Prospect" to get started.
								</div>
							) : (
								prospects.map((prospect) => (
									<Card key={prospect.id}>
										<CardContent className="p-4">
											<div className="flex items-start justify-between">
												<div className="flex-1 space-y-3">
													{/* Name */}
													<div className="flex items-center gap-2">
														<RiUserLine className="size-4 text-muted-foreground" />
														<span className="font-medium">{prospect.name}</span>
													</div>

													{/* Contact Info */}
													<div className="flex flex-wrap items-center gap-4 text-muted-foreground text-sm">
														<div className="flex items-center gap-2">
															<RiMailLine className="size-4" />
															<span>{prospect.email}</span>
														</div>
														<div className="flex items-center gap-2">
															<RiPhoneLine className="size-4" />
															<span>{prospect.phone}</span>
														</div>
													</div>

													{/* Tags */}
													{(prospect.tagNames &&
														prospect.tagNames.length > 0) ||
													prospect.tags?.trim() ? (
														<div className="flex flex-wrap items-center gap-2">
															{prospect.tagNames && prospect.tagNames.length > 0
																? prospect.tagNames.map((tag, idx) => (
																		<Badge
																			key={idx}
																			variant="secondary"
																			className="text-xs"
																		>
																			{tag}
																		</Badge>
																	))
																: prospect.tags
																	? prospect.tags.split(",").map((tag, idx) => (
																			<Badge
																				key={idx}
																				variant="secondary"
																				className="text-xs"
																			>
																				{tag.trim()}
																			</Badge>
																		))
																	: null}
														</div>
													) : null}

													{/* Details */}
													<div className="flex flex-wrap items-center gap-4 text-sm">
														<div className="flex items-center gap-2">
															<RiMapPinLine className="size-4 text-muted-foreground" />
															<span className="text-muted-foreground">
																Source: {prospect.source}
															</span>
														</div>
														<div className="flex items-center gap-2">
															<RiPriceTagLine className="size-4 text-muted-foreground" />
															<Badge variant="outline" className="capitalize">
																{prospect.type === "tenant"
																	? "Tenant"
																	: "Owner"}{" "}
																| {prospect.status}
															</Badge>
														</div>
														<div className="flex items-center gap-2">
															<RiHomeLine className="size-4 text-muted-foreground" />
															<span className="text-muted-foreground">
																Property: {prospect.property || "Not specified"}
															</span>
														</div>
														{prospect.projectName && (
															<div className="flex items-center gap-2">
																<RiHomeLine className="size-4 text-muted-foreground" />
																<span className="text-muted-foreground">
																	Project: {prospect.projectName}
																</span>
															</div>
														)}
														{prospect.agentName && (
															<div className="flex items-center gap-2">
																<RiUserLine className="size-4 text-muted-foreground" />
																<span className="text-muted-foreground">
																	Owner: {prospect.agentName}
																</span>
															</div>
														)}
														{prospect.lastContact && (
															<div className="flex items-center gap-2">
																<RiCalendarLine className="size-4 text-muted-foreground" />
																<span className="text-muted-foreground">
																	Last:{" "}
																	{formatContactDate(prospect.lastContact)}
																</span>
															</div>
														)}
														{prospect.nextContact && (
															<div className="flex items-center gap-2">
																<RiCalendarLine className="size-4 text-muted-foreground" />
																<span className="text-muted-foreground">
																	Next:{" "}
																	{formatContactDate(prospect.nextContact)}
																</span>
															</div>
														)}
													</div>
												</div>

												{/* Action Buttons */}
												<div className="flex items-center gap-2">
													<Button
														variant="outline"
														size="sm"
														onClick={() => handleMessage(prospect)}
														className="cursor-pointer"
													>
														<RiMessageLine className="mr-2 h-4 w-4" />
														Message
													</Button>
													<Button
														variant="outline"
														size="sm"
														onClick={() => handleView(prospect)}
														style={{ color: "#5858ff" }}
														className="cursor-pointer border-blue-500/50 text-blue-600 hover:bg-blue-500/10 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-500/20 dark:hover:text-blue-300"
													>
														<RiEyeLine className="mr-2 h-4 w-4" />
														View
													</Button>
													<Button
														variant="outline"
														size="sm"
														onClick={() => handleDeleteClick(prospect)}
														className="cursor-pointer border-red-500/50 text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/20 dark:hover:text-red-300"
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
					)}

					{/* Pagination - Only show in List View */}
					{viewMode === "list" && totalPages > 0 && (
						<div className="flex items-center justify-between">
							<div className="text-muted-foreground text-sm">
								Showing {(currentPage - 1) * itemsPerPage + 1}-
								{Math.min(
									currentPage * itemsPerPage,
									prospectsData?.pagination.total || 0,
								)}{" "}
								of {prospectsData?.pagination.total || 0} prospects
							</div>
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() =>
										setCurrentPage((prev) => Math.max(1, prev - 1))
									}
									disabled={currentPage === 1}
								>
									&lt; Prev
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={() =>
										setCurrentPage((prev) => Math.min(totalPages, prev + 1))
									}
									disabled={currentPage === totalPages}
								>
									Next &gt;
								</Button>
							</div>
						</div>
					)}
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
