"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { KanbanBoard, type PipelineStage } from "@/components/crm-kanban-board";
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
import { Card, CardContent } from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Textarea } from "@/components/ui/textarea";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/tooltip";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	RiAddLine,
	RiAlertLine,
	RiFileDownloadLine,
	RiFileUploadLine,
	RiCalendarLine,
	RiDashboardLine,
	RiDeleteBinLine,
	RiEyeLine,
	RiHomeLine,
	RiLinksLine,
	RiLoader4Line,
	RiMailLine,
	RiMapPinLine,
	RiPencilLine,
	RiPhoneLine,
	RiPriceTagLine,
	RiSearchLine,
	RiUserLine,
} from "@remixicon/react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRedirectUnauthenticated } from "@/hooks/use-redirect-unauthenticated";
import { useCallback, useMemo, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ImportLeadsDialog } from "./_components/import-leads-dialog";
import type { AgentCrmImportMode } from "./_components/import-leads-dialog";
import {
	formatFollowUpStagePrompt,
	getNextFollowUpStage,
	PIPELINE_STAGE_VALUES,
	PIPELINE_STAGES,
} from "@/app/admin/leads/_components/lead-constants";
import { StageBadge } from "@/app/admin/leads/_components/lead-ui";
import { LeadContactInfoCard } from "@/app/admin/leads/_components/lead-contact-info-card";
import {
	exportProspectsToCsv,
	exportProspectsToExcelHtml,
	prospectsToExportRows,
	type CrmExportProspect,
} from "./_utils/crm-export";
import { LeadTasksCard } from "@/app/admin/leads/_components/lead-tasks-card";
import { TodayTasksWidget } from "@/app/admin/leads/_components/today-tasks-widget";
import { TagSelector } from "@/components/tag-selector";

// Pipeline stages for Kanban board
type LeadType = "personal" | "company";

// Prospect interface matching database schema
// Dates come as strings from API and are converted when needed
interface Prospect {
	id: string;
	name: string;
	email: string | null;
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
	agentEmail?: string | null;
	followerIds?: string[];
	followerNames?: string[];
	isFollower?: boolean;
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
	updatedAt: Date | string;
}

// Form validation schema
const prospectFormSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters"),
	email: z.string().email("Please enter a valid email address"),
	phone: z.string().trim().min(1, "Phone number is required"),
	source: z.string().min(1, "Please select a source"),
	type: z.enum(["tenant", "buyer"], {
		required_error: "Please select a type",
	}),
	property: z.string().min(1, "Property name is required"),
	projectId: z.string().uuid().optional(),
	status: z.enum(["active", "inactive"], {
		required_error: "Please select a status",
	}),
	stage: z.enum(PIPELINE_STAGE_VALUES).default("new_lead").optional(),
	leadType: z.enum(["personal", "company"]).default("personal").optional(),
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
	const queryClient = useQueryClient();
	const trpcUtils = trpc.useUtils();
	const { data: session, isPending } = authClient.useSession();
	useRedirectUnauthenticated(session?.user?.id, isPending);
	const [activeTab, setActiveTab] = useState<LeadsTab>("my"); // My Leads | Company Leads
	const [viewMode, setViewMode] = useState<ViewMode>("kanban");
	const [searchQuery, setSearchQuery] = useState("");
	const [stageFilter, setStageFilter] = useState<PipelineStage | "all">("all");
	const [categoryFilter, setCategoryFilter] = useState<string>("all"); // tagId
	const [agentFilter, setAgentFilter] = useState<string>("all");
	const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
	const [currentPage, setCurrentPage] = useState(1);
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
	const [isStagePromptOpen, setIsStagePromptOpen] = useState(false);
	const [stagePromptProspect, setStagePromptProspect] =
		useState<Prospect | null>(null);
	const [stagePromptMessage, setStagePromptMessage] = useState("");
	const [stagePromptTargetStage, setStagePromptTargetStage] =
		useState<PipelineStage | null>(null);
	const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(
		null,
	);
	const [isImportOpen, setIsImportOpen] = useState(false);
	const [isExporting, setIsExporting] = useState(false);
	const itemsPerPage = 10;

	// Projects (admin-managed developer projects) for dropdown selection
	const { data: projectsData } = trpc.crm.projectsList.useQuery(undefined, {
		enabled: !!session,
		staleTime: 60_000,
	});
	const { data: tagsData } = trpc.tags.list.useQuery(
		{ page: 1, limit: 100 },
		{ enabled: !!session, staleTime: 30_000 },
	);
	const { data: followerAgents = [] } = trpc.crm.agentsForFollowers.useQuery(
		undefined,
		{ enabled: !!session, staleTime: 60_000 },
	);

	// Fetch prospects with tRPC - only when session is available
	const {
		data: prospectsData,
		isLoading: isLoadingProspects,
		error: prospectsError,
		refetch: refetchProspects,
	} = trpc.crm.list.useQuery(
		{
			search: searchQuery || undefined,
			stage: stageFilter === "all" ? undefined : stageFilter,
			tagId: categoryFilter === "all" ? undefined : categoryFilter,
			status: statusFilter === "all" ? undefined : statusFilter,
			filterAgentId:
				agentFilter === "all"
					? undefined
					: agentFilter === "__unassigned__"
						? ("__unassigned__" as const)
						: agentFilter,
			leadType:
				activeTab === "company" ? ("company" as const) : ("personal" as const),
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

	const importMode: AgentCrmImportMode =
		activeTab === "company" ? "company_unclaimed" : "personal_assigned";

	const exportListParams = useMemo(
		() => ({
			search: searchQuery || undefined,
			stage: stageFilter === "all" ? undefined : stageFilter,
			tagId: categoryFilter === "all" ? undefined : categoryFilter,
			status: statusFilter === "all" ? undefined : statusFilter,
			filterAgentId:
				agentFilter === "all"
					? undefined
					: agentFilter === "__unassigned__"
						? ("__unassigned__" as const)
						: agentFilter,
			leadType:
				activeTab === "company" ? ("company" as const) : ("personal" as const),
			page: 1,
			limit: 5000,
			forExport: true as const,
		}),
		[
			searchQuery,
			stageFilter,
			categoryFilter,
			statusFilter,
			agentFilter,
			activeTab,
		],
	);

	const handleExportProspects = useCallback(
		async (format: "csv" | "excel") => {
			if (isExporting || !session) return;
			setIsExporting(true);
			try {
				const data = await trpcUtils.crm.list.fetch(exportListParams);
				const rows = prospectsToExportRows(
					data.prospects as CrmExportProspect[],
				);
				if (rows.length === 0) {
					toast.error("No prospects to export for the current filters.");
					return;
				}
				const baseName =
					activeTab === "company"
						? "crm_company_leads_export"
						: "crm_my_leads_export";
				if (format === "csv") exportProspectsToCsv(rows, baseName);
				else exportProspectsToExcelHtml(rows, baseName);
				if (data.pagination.total > 5000) {
					toast.message("Export limit", {
						description:
							"Only the first 5,000 matching rows were exported. Narrow filters and export again if needed.",
					});
				}
			} catch (e) {
				toast.error(e instanceof Error ? e.message : "Export failed");
			} finally {
				setIsExporting(false);
			}
		},
		[activeTab, exportListParams, isExporting, session, trpcUtils],
	);

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

	const handleCall = (prospect: Prospect) => {
		// TODO: Initiate call
		console.log("Call prospect:", prospect);

		const nextStage = getNextFollowUpStage(prospect.stage);
		if (nextStage) {
			setStagePromptProspect(prospect);
			setStagePromptMessage(formatFollowUpStagePrompt(nextStage));
			setStagePromptTargetStage(nextStage);
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

	const handleViewLeadById = async (leadId: string) => {
		const lead = prospects.find((p) => p.id === leadId);
		if (lead) {
			handleView(lead);
			return;
		}
		try {
			const data = await trpcUtils.crm.get.fetch({ id: leadId });
			handleView(data.prospect as Prospect);
		} catch {
			toast.error("Could not open this lead. It may not be in your current list.");
		}
	};

	const [ownerAgentId, setOwnerAgentId] = useState<string>("");
	const [categoryTagIds, setCategoryTagIds] = useState<string[]>([]);
	const [detailStage, setDetailStage] = useState<PipelineStage | "">("");
	const [newNoteContent, setNewNoteContent] = useState("");
	const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
	const [editingNoteContent, setEditingNoteContent] = useState("");
	const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(
		null,
	);
	const [notesPage, setNotesPage] = useState(1);
	const NOTES_PER_PAGE = 5;

	// Fetch fresh prospect detail when view dialog is open
	const { data: prospectDetailData } = trpc.crm.get.useQuery(
		{ id: selectedProspect?.id || "" },
		{
			enabled: !!selectedProspect?.id && isViewDialogOpen,
			staleTime: 0,
		},
	);

	const activeProspect = (prospectDetailData?.prospect ??
		selectedProspect) as Prospect | null;

	useEffect(() => {
		setNotesPage(1);
	}, [selectedProspect?.id, isViewDialogOpen]);

	const canManageTasksForSelected =
		Boolean(activeProspect) &&
		(activeProspect?.agentId === session?.user?.id ||
			activeProspect?.isFollower === true);

	const isOwnerOfSelected =
		Boolean(activeProspect) &&
		activeProspect?.agentId === session?.user?.id;

	const canEditCategoriesForSelected = isOwnerOfSelected;
	const canEditOwnerForSelected = isOwnerOfSelected;

	const canEditStageForSelected = canManageTasksForSelected;

	useEffect(() => {
		const current = prospectDetailData?.prospect ?? selectedProspect;
		setOwnerAgentId(current?.agentId ?? "");
	}, [prospectDetailData?.prospect, selectedProspect?.id, selectedProspect?.agentId]);

	useEffect(() => {
		const current = prospectDetailData?.prospect ?? selectedProspect;
		setCategoryTagIds(current?.tagIds ?? []);
	}, [prospectDetailData?.prospect, selectedProspect?.id, selectedProspect?.tagIds]);

	useEffect(() => {
		const current = prospectDetailData?.prospect ?? selectedProspect;
		setDetailStage((current?.stage as PipelineStage | undefined) ?? "");
	}, [prospectDetailData?.prospect, selectedProspect?.id, selectedProspect?.stage]);

	const setOwnerMutation = trpc.crm.setOwner.useMutation({
		onSuccess: () => {
			toast.success("Lead owner updated");
			void trpcUtils.crm.get.invalidate({ id: activeProspect?.id });
			refetchProspects();
		},
		onError: (error) => toast.error(error.message),
	});

	const setCategoriesMutation = trpc.crm.setCategories.useMutation({
		onSuccess: (result) => {
			toast.success("Categories updated");
			if (selectedProspect) {
				setSelectedProspect({
					...selectedProspect,
					tagIds: result.tagIds,
					tagNames: result.tagNames,
				});
			}
			refetchProspects();
		},
		onError: (error) => toast.error(error.message),
	});

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

	// Edit note mutation
	const updateNoteMutation = trpc.crm.updateNote.useMutation({
		onSuccess: () => {
			toast.success("Note updated");
			refetchNotes();
			setEditingNoteId(null);
			setEditingNoteContent("");
		},
		onError: (error) => toast.error(error.message || "Failed to update note"),
	});

	const handleStartEditNote = (note: ProspectNote) => {
		setEditingNoteId(note.id);
		setEditingNoteContent(note.content);
	};

	const handleCancelEditNote = () => {
		setEditingNoteId(null);
		setEditingNoteContent("");
	};

	const handleSaveEditNote = () => {
		if (!editingNoteId || !editingNoteContent.trim()) return;
		updateNoteMutation.mutate({
			id: editingNoteId,
			content: editingNoteContent.trim(),
		});
	};

	// Delete note mutation
	const deleteNoteMutation = trpc.crm.deleteNote.useMutation({
		onSuccess: () => {
			toast.success("Note deleted");
			refetchNotes();
			setConfirmDeleteNoteId(null);
		},
		onError: (error) => toast.error(error.message || "Failed to delete note"),
	});

	const handleLink = (prospect: Prospect) => {
		// TODO: Link to transaction
		console.log("Link prospect:", prospect);
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

	const handleDetailStageSave = () => {
		if (!activeProspect || !detailStage || detailStage === activeProspect.stage) {
			return;
		}
		updateStageMutation.mutate(
			{ id: activeProspect.id, stage: detailStage },
			{
				onSuccess: () => {
					toast.success("Lead stage updated");
					void trpcUtils.crm.get.invalidate({ id: activeProspect.id });
					setSelectedProspect((prev) =>
						prev ? { ...prev, stage: detailStage } : prev,
					);
				},
			},
		);
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

	// Authentication check
	if (isPending) {
		return <LoadingScreen text="Loading..." />;
	}

	if (!session) {
		return <LoadingScreen text="Redirecting..." />;
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
					<div className="flex flex-col gap-2">
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
							<div className="flex flex-wrap items-center gap-2 sm:gap-3">
							<div className="inline-flex items-center overflow-hidden rounded-md border border-border/80 bg-muted/30">
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											type="button"
											size="icon"
											variant="ghost"
											className="h-8 w-8 rounded-none p-0 text-muted-foreground hover:text-foreground"
											disabled={isLoadingProspects}
											aria-label="Import prospects from CSV"
											onClick={() => setIsImportOpen(true)}
										>
											<RiFileUploadLine size={16} aria-hidden />
										</Button>
									</TooltipTrigger>
									<TooltipContent>Import CSV</TooltipContent>
								</Tooltip>
								<div className="h-5 w-px bg-border" />
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<span
											className={
												isLoadingProspects || isExporting
													? "pointer-events-none inline-flex opacity-50"
													: "inline-flex"
											}
										>
											<Tooltip>
												<TooltipTrigger asChild>
													<Button
														type="button"
														size="icon"
														variant="ghost"
														className="h-8 w-8 rounded-none p-0 text-muted-foreground hover:text-foreground"
														disabled={isLoadingProspects || isExporting}
														aria-label="Export prospects"
													>
														<RiFileDownloadLine size={16} aria-hidden />
													</Button>
												</TooltipTrigger>
												<TooltipContent>Export CSV or Excel</TooltipContent>
											</Tooltip>
										</span>
									</DropdownMenuTrigger>
									<DropdownMenuContent
										align="end"
										className="w-fit min-w-0 p-0"
									>
										<div className="flex items-center gap-0 p-0">
											<Tooltip>
												<TooltipTrigger asChild>
													<DropdownMenuItem
														disabled={isLoadingProspects || isExporting}
														onSelect={() => {
															void handleExportProspects("csv");
														}}
														className="h-9 w-9 gap-0 !px-0 !py-0 justify-center"
													>
														<FileText size={15} aria-hidden />
													</DropdownMenuItem>
												</TooltipTrigger>
												<TooltipContent>Export CSV</TooltipContent>
											</Tooltip>
											<Tooltip>
												<TooltipTrigger asChild>
													<DropdownMenuItem
														disabled={isLoadingProspects || isExporting}
														onSelect={() => {
															void handleExportProspects("excel");
														}}
														className="h-9 w-9 gap-0 !px-0 !py-0 justify-center"
													>
														<FileSpreadsheet size={15} aria-hidden />
													</DropdownMenuItem>
												</TooltipTrigger>
												<TooltipContent>Export Excel</TooltipContent>
											</Tooltip>
										</div>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
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
									Board View
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
					</div>

					<TodayTasksWidget scope="agent" onViewLead={handleViewLeadById} />

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
														Enter the property or project name the lead is
														interested in.
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
													</SelectContent>
												</Select>
												<FormMessage />
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
						<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
							<DialogHeader className="pr-8">
								<DialogTitle className="flex items-center gap-2">
									<RiUserLine className="size-5" />
									{activeProspect?.name ?? "Lead Detail"}
								</DialogTitle>
								<DialogDescription>
									View complete information about this lead.
								</DialogDescription>
							</DialogHeader>

							{activeProspect && (
								<div className="space-y-6 py-4">
									<LeadContactInfoCard
										lead={{
											status: activeProspect.status,
											email: activeProspect.email,
											phone: activeProspect.phone,
											source: activeProspect.source,
											leadType: activeProspect.leadType,
											tagNames: activeProspect.tagNames,
											tags: activeProspect.tags,
											createdAt: activeProspect.createdAt,
											agentName: activeProspect.agentName,
										}}
										showDescription={false}
										showNotes={false}
									/>

									{/* Lead Detail */}
									<div className="space-y-3" style={{ marginBottom: "15px" }}>
										<div className="font-medium text-muted-foreground text-sm">
											Lead Detail
										</div>
										<div className="space-y-3 rounded-lg border bg-muted/30 p-4">
											<div className="space-y-2">
												<div className="flex items-center gap-2 text-muted-foreground text-sm">
													<RiLinksLine className="size-4" />
													Lead Stage
												</div>
												{canEditStageForSelected ? (
													<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
														<Select
															value={detailStage || activeProspect.stage}
															onValueChange={(v) =>
																setDetailStage(v as PipelineStage)
															}
														>
															<SelectTrigger className="sm:flex-1">
																<SelectValue placeholder="Select stage…" />
															</SelectTrigger>
															<SelectContent>
																{PIPELINE_STAGES.map((s) => (
																	<SelectItem key={s.value} value={s.value}>
																		{s.label}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
														<Button
															size="sm"
															className="shrink-0"
															disabled={
																!detailStage ||
																detailStage === activeProspect.stage ||
																updateStageMutation.isPending
															}
															onClick={handleDetailStageSave}
														>
															{updateStageMutation.isPending ? (
																<RiLoader4Line className="size-4 animate-spin" />
															) : (
																"Update"
															)}
														</Button>
													</div>
												) : (
													<StageBadge stage={activeProspect.stage} />
												)}
											</div>
											<div className="space-y-2">
												<div className="flex items-center gap-2 text-muted-foreground text-sm">
													<RiPriceTagLine className="size-4 shrink-0" />
													Categories
												</div>
												{canEditCategoriesForSelected ? (
													<>
														<TagSelector
															value={categoryTagIds}
															onChange={setCategoryTagIds}
															placeholder="Add categories…"
														/>
														<p className="text-muted-foreground text-xs">
															Choose from admin-defined categories only.
														</p>
														<Button
															size="sm"
															disabled={
																setCategoriesMutation.isPending ||
																JSON.stringify(categoryTagIds) ===
																	JSON.stringify(
																		activeProspect.tagIds ?? [],
																	)
															}
															onClick={() =>
																setCategoriesMutation.mutate({
																	id: activeProspect.id,
																	tagIds: categoryTagIds,
																})
															}
														>
															{setCategoriesMutation.isPending ? (
																<RiLoader4Line className="size-4 animate-spin" />
															) : (
																"Save Categories"
															)}
														</Button>
													</>
												) : activeProspect.tagNames &&
												  activeProspect.tagNames.length > 0 ? (
													<div className="flex flex-wrap gap-1">
														{activeProspect.tagNames.map((tag) => (
															<Badge
																key={tag}
																variant="secondary"
																className="text-xs"
															>
																{tag}
															</Badge>
														))}
													</div>
												) : activeProspect.tags?.trim() ? (
													<div className="flex flex-wrap gap-1">
														{activeProspect.tags
															.split(",")
															.map((tag) => (
																<Badge
																	key={tag.trim()}
																	variant="secondary"
																	className="text-xs"
																>
																	{tag.trim()}
																</Badge>
															))}
													</div>
												) : (
													<span className="text-muted-foreground text-sm">
														—
													</span>
												)}
											</div>
											{activeProspect.agentName && (
												<div className="space-y-2">
													<div className="flex items-center gap-2 text-muted-foreground text-sm">
														<RiUserLine className="size-4" />
														Owner
													</div>
													{canEditOwnerForSelected ? (
														<div className="flex gap-2">
															<Select
																value={ownerAgentId}
																onValueChange={setOwnerAgentId}
															>
																<SelectTrigger className="flex-1">
																	<SelectValue placeholder="Select owner" />
																</SelectTrigger>
																<SelectContent>
																	{followerAgents.map((a) => (
																		<SelectItem key={a.agentId} value={a.agentId}>
																			{a.agentName ?? a.agentEmail}
																		</SelectItem>
																	))}
																</SelectContent>
															</Select>
															<Button
																size="sm"
																disabled={
																	setOwnerMutation.isPending ||
																	!ownerAgentId ||
																	ownerAgentId === activeProspect.agentId
																}
																onClick={() =>
																	setOwnerMutation.mutate({
																		id: activeProspect.id,
																		agentId: ownerAgentId,
																	})
																}
															>
																{setOwnerMutation.isPending ? (
																	<RiLoader4Line className="size-4 animate-spin" />
																) : (
																	"Save"
																)}
															</Button>
														</div>
													) : (
														<div className="font-medium text-sm">
															{activeProspect.agentName}
														</div>
													)}
												</div>
											)}
											<div className="space-y-2">
												<div className="flex items-center gap-2 text-muted-foreground text-sm">
													<RiUserLine className="size-4" />
													Followers
												</div>
												{activeProspect.followerNames &&
												  activeProspect.followerNames.length > 0 ? (
													<div className="flex flex-wrap gap-1">
														{activeProspect.followerNames.map((name) => (
															<Badge key={name} variant="secondary">
																{name}
															</Badge>
														))}
													</div>
												) : (
													<span className="text-muted-foreground text-sm">—</span>
												)}
											</div>
											{activeProspect.projectName && (
												<div className="flex items-center justify-between">
													<div className="flex items-center gap-2 text-muted-foreground text-sm">
														<RiHomeLine className="size-4" />
														Developer Project
													</div>
													<div className="font-medium text-sm">
														{activeProspect.projectName}
													</div>
												</div>
											)}
										</div>
									</div>

									{/* Contact History */}
									{(activeProspect.lastContact ||
										activeProspect.nextContact) && (
										<div className="space-y-3">
											<div className="font-medium text-muted-foreground text-sm">
												Contact History
											</div>
											<div className="space-y-2 rounded-lg border bg-muted/30 p-4">
												{activeProspect.lastContact && (
													<div className="flex items-center gap-3">
														<RiCalendarLine className="size-4 text-muted-foreground" />
														<div className="flex-1">
															<div className="text-muted-foreground text-xs">
																Last Contact
															</div>
															<div className="font-medium text-sm">
																{formatContactDate(
																	activeProspect.lastContact,
																)}
															</div>
														</div>
													</div>
												)}
												{activeProspect.nextContact && (
													<div className="flex items-center gap-3">
														<RiCalendarLine className="size-4 text-muted-foreground" />
														<div className="flex-1">
															<div className="text-muted-foreground text-xs">
																Next Contact
															</div>
															<div className="font-medium text-sm">
																{formatContactDate(
																	activeProspect.nextContact,
																)}
															</div>
														</div>
													</div>
												)}
											</div>
										</div>
									)}

									{canManageTasksForSelected && activeProspect ? (
										<LeadTasksCard leadId={activeProspect.id} />
									) : activeProspect?.leadType === "company" &&
									  !activeProspect.agentId ? (
										<p className="rounded-lg border border-dashed p-4 text-center text-muted-foreground text-sm">
											Claim this company lead to add tasks and follow-ups.
										</p>
									) : null}

									{/* Notes Timeline */}
									<div className="space-y-3">
										<div className="font-medium text-muted-foreground text-sm">
											Notes & Timeline
										</div>
										<div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border bg-muted/30 p-4">
											{notes.length === 0 ? (
												<div className="py-4 text-center text-muted-foreground text-sm">
													No notes yet. Add a note to track interactions.
												</div>
											) : (
												notes
													.slice(
														(notesPage - 1) * NOTES_PER_PAGE,
														notesPage * NOTES_PER_PAGE,
													)
													.map((note) => {
													const noteDate = new Date(
														note.updatedAt ?? note.createdAt,
													);
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
													const gmtOffset = -noteDate.getTimezoneOffset() / 60;
													const gmtSign = gmtOffset >= 0 ? "+" : "";
													const gmtString = `(GMT ${gmtSign}${gmtOffset.toString().padStart(2, "0")})`;
													const wasEdited =
														note.updatedAt &&
														new Date(note.updatedAt).getTime() -
															new Date(note.createdAt).getTime() >
															1000;
													const isOwnNote =
														note.agentId === session?.user?.id;
													const isEditing = editingNoteId === note.id;
													const isConfirmingDelete =
														confirmDeleteNoteId === note.id;

													return (
														<div
															key={note.id}
															className="space-y-1 border-b pb-3 last:border-0 last:pb-0"
														>
															{isEditing ? (
																<div className="space-y-2">
																	<Textarea
																		value={editingNoteContent}
																		onChange={(e) =>
																			setEditingNoteContent(e.target.value)
																		}
																		rows={3}
																		className="resize-none bg-background text-sm"
																		autoFocus
																	/>
																	<div className="flex gap-2">
																		<Button
																			size="sm"
																			className="h-7 px-2 text-xs"
																			onClick={handleSaveEditNote}
																			disabled={
																				!editingNoteContent.trim() ||
																				updateNoteMutation.isPending
																			}
																		>
																			{updateNoteMutation.isPending ? (
																				<RiLoader4Line className="size-3.5 animate-spin" />
																			) : (
																				"Save"
																			)}
																		</Button>
																		<Button
																			size="sm"
																			variant="outline"
																			className="h-7 px-2 text-xs"
																			onClick={handleCancelEditNote}
																		>
																			Cancel
																		</Button>
																	</div>
																</div>
															) : (
																<>
																	<div className="break-words text-foreground text-sm leading-relaxed">
																		{note.content}
																	</div>
																	<div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
																		<span>
																			{formattedDate} {gmtString}
																		</span>
																		{note.agentName && (
																			<>
																				<span>•</span>
																				<span>Created by: {note.agentName}</span>
																			</>
																		)}
																		{wasEdited && (
																			<span className="italic">(edited)</span>
																		)}
																		{isOwnNote && !isConfirmingDelete && (
																			<div className="ml-auto flex items-center gap-2">
																				<button
																					type="button"
																					className="text-muted-foreground hover:text-foreground"
																					title="Edit note"
																					onClick={() =>
																						handleStartEditNote(note)
																					}
																				>
																					<RiPencilLine className="size-3.5" />
																				</button>
																				<button
																					type="button"
																					className="text-muted-foreground hover:text-destructive"
																					title="Delete note"
																					onClick={() =>
																						setConfirmDeleteNoteId(note.id)
																					}
																				>
																					<RiDeleteBinLine className="size-3.5" />
																				</button>
																			</div>
																		)}
																	</div>
																	{isConfirmingDelete && (
																		<div className="flex items-center gap-2 pt-1">
																			<span className="text-muted-foreground text-xs">
																				Delete this note?
																			</span>
																			<Button
																				size="sm"
																				variant="destructive"
																				className="h-6 px-2 text-xs"
																				onClick={() =>
																					deleteNoteMutation.mutate({
																						id: note.id,
																					})
																				}
																				disabled={deleteNoteMutation.isPending}
																			>
																				{deleteNoteMutation.isPending ? (
																					<RiLoader4Line className="size-3.5 animate-spin" />
																				) : (
																					"Delete"
																				)}
																			</Button>
																			<Button
																				size="sm"
																				variant="outline"
																				className="h-6 px-2 text-xs"
																				onClick={() =>
																					setConfirmDeleteNoteId(null)
																				}
																			>
																				Cancel
																			</Button>
																		</div>
																	)}
																</>
															)}
														</div>
													);
												})
											)}
										</div>
										{notes.length > NOTES_PER_PAGE && (
											<div className="flex items-center justify-between">
												<p className="text-muted-foreground text-xs">
													{(notesPage - 1) * NOTES_PER_PAGE + 1}–
													{Math.min(
														notesPage * NOTES_PER_PAGE,
														notes.length,
													)}{" "}
													of {notes.length} notes
												</p>
												<div className="flex items-center gap-1">
													<Button
														variant="outline"
														size="sm"
														className="h-7 px-2 text-xs"
														disabled={notesPage === 1}
														onClick={() =>
															setNotesPage((p) => Math.max(1, p - 1))
														}
													>
														Prev
													</Button>
													<Button
														variant="outline"
														size="sm"
														className="h-7 px-2 text-xs"
														disabled={
															notesPage * NOTES_PER_PAGE >= notes.length
														}
														onClick={() => setNotesPage((p) => p + 1)}
													>
														Next
													</Button>
												</div>
											</div>
										)}
										{/* Add Note Form */}
										<div className="flex items-end gap-2">
											<Textarea
												placeholder="Add a note..."
												value={newNoteContent}
												onChange={(e) => setNewNoteContent(e.target.value)}
												rows={2}
												className="resize-none"
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
						<Select
							value={categoryFilter}
							onValueChange={(v) => {
								setCategoryFilter(v);
								setCurrentPage(1);
							}}
						>
							<SelectTrigger className="w-44">
								<SelectValue placeholder="Category" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Categories</SelectItem>
								{(tagsData?.tags ?? []).map((t) => (
									<SelectItem key={t.id} value={t.id}>
										{t.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Select
							value={agentFilter}
							onValueChange={(v) => {
								setAgentFilter(v);
								setCurrentPage(1);
							}}
						>
							<SelectTrigger className="w-44">
								<RiUserLine className="mr-1.5 size-4 shrink-0 text-muted-foreground" />
								<SelectValue placeholder="Agent" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Agents</SelectItem>
								<SelectItem value="__unassigned__">Unassigned</SelectItem>
								{followerAgents.map((a) => (
									<SelectItem key={a.agentId} value={a.agentId}>
										{a.agentName ?? a.agentEmail}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Select
							value={stageFilter}
							onValueChange={(v) => {
								setStageFilter(v as PipelineStage | "all");
								setCurrentPage(1);
							}}
						>
							<SelectTrigger className="w-44">
								<SelectValue placeholder="Lead Stage" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Stages</SelectItem>
								{PIPELINE_STAGES.map((s) => (
									<SelectItem key={s.value} value={s.value}>
										{s.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Select
							value={statusFilter}
							onValueChange={(v) => {
								setStatusFilter(v as "all" | "active" | "inactive");
								setCurrentPage(1);
							}}
						>
							<SelectTrigger className="w-44">
								<SelectValue placeholder="Status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Status</SelectItem>
								<SelectItem value="active">Active</SelectItem>
								<SelectItem value="inactive">Inactive</SelectItem>
							</SelectContent>
						</Select>

					</div>

					{/* Prospects View - Kanban or List */}
					{viewMode === "kanban" ? (
						// Kanban Board View
						<div className="flex flex-col gap-4">
							{isLoadingProspects ? (
								<div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
									{["sk-kb-1", "sk-kb-2", "sk-kb-3", "sk-kb-4", "sk-kb-5"].map(
										(colId) => (
											<div
												key={colId}
												className="rounded-lg border bg-muted/30 p-3"
											>
												<Skeleton className="mb-3 h-5 w-3/4" />
												<div className="space-y-2">
													{[`${colId}-a`, `${colId}-b`].map((cardId) => (
														<div
															key={cardId}
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
										),
									)}
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
									onStageChange={handleStageChange}
									leadsTab={activeTab}
								/>
							)}
						</div>
					) : (
						// List View
						<div className="flex flex-col gap-3">
							{isLoadingProspects ? (
								<div className="flex flex-col gap-3">
									{["sk-lv-1", "sk-lv-2", "sk-lv-3", "sk-lv-4", "sk-lv-5"].map(
										(id) => (
											<Card key={id}>
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
										),
									)}
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
																? prospect.tagNames.map((tag) => (
																		<Badge
																			key={tag}
																			variant="secondary"
																			className="text-xs"
																		>
																			{tag}
																		</Badge>
																	))
																: prospect.tags
																	? prospect.tags.split(",").map((tag) => (
																			<Badge
																				key={tag.trim()}
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
															<RiLinksLine className="size-4 text-muted-foreground" />
															<span className="text-muted-foreground">
																Lead Stage:
															</span>
															<StageBadge stage={prospect.stage} />
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
														onClick={() => handleView(prospect)}
														className="cursor-pointer border-green-600/60 text-green-600 hover:bg-green-600/10 hover:text-green-700 dark:border-green-500/50 dark:text-green-400 dark:hover:bg-green-600/20 dark:hover:text-green-300"
													>
														<RiEyeLine className="mr-2 h-4 w-4" />
														View
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
				<ImportLeadsDialog
					open={isImportOpen}
					onOpenChange={setIsImportOpen}
					importMode={importMode}
					onImported={() => {
						void queryClient.invalidateQueries({ queryKey: [["crm"]] });
						void refetchProspects();
					}}
				/>
			</SidebarInset>
		</SidebarProvider>
	);
}
