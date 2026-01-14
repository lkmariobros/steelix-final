"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/separator";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/table";
import UserDropdown from "@/components/user-dropdown";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { useQueryClient } from "@tanstack/react-query";
import {
	RiAddLine,
	RiDashboardLine,
	RiDeleteBinLine,
	RiEditLine,
	RiLoader4Line,
	RiPriceTagLine,
	RiRefreshLine,
	RiSearchLine,
	RiShieldUserLine,
} from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface Tag {
	id: string;
	name: string;
	createdBy: string;
	createdByName?: string;
	createdAt: Date | string;
	updatedAt: Date | string;
}

export default function AdminTagsPage() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { data: session, isPending } = authClient.useSession();
	const [searchQuery, setSearchQuery] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
	const [tagName, setTagName] = useState("");
	const itemsPerPage = 20;

	// Admin role checking
	const { data: roleData, isLoading: isRoleLoading } =
		trpc.admin.checkAdminRole.useQuery(undefined, {
			enabled: !!session,
			retry: false,
		}) as {
			data: { hasAdminAccess: boolean; role: string } | undefined;
			isLoading: boolean;
		};

	// Fetch tags
	const {
		data: tagsData,
		isLoading: isLoadingTags,
		error: tagsError,
		refetch: refetchTags,
	} = trpc.tags.list.useQuery(
		{
			search: searchQuery || undefined,
			page: currentPage,
			limit: itemsPerPage,
		},
		{
			enabled: !!session && !!roleData?.hasAdminAccess,
			retry: 1,
			staleTime: 30000,
		},
	);

	const tags = tagsData?.tags || [];

	// Create tag mutation
	const createTagMutation = trpc.tags.create.useMutation({
		onSuccess: () => {
			toast.success("Tag created successfully!");
			setIsAddDialogOpen(false);
			setTagName("");
			queryClient.invalidateQueries({ queryKey: [["tags", "list"]] });
			refetchTags();
		},
		onError: (error) => {
			console.error("Error creating tag:", error);
			toast.error(error.message || "Failed to create tag. Please try again.");
		},
	});

	// Update tag mutation
	const updateTagMutation = trpc.tags.update.useMutation({
		onSuccess: () => {
			toast.success("Tag updated successfully!");
			setIsEditDialogOpen(false);
			setSelectedTag(null);
			setTagName("");
			queryClient.invalidateQueries({ queryKey: [["tags", "list"]] });
			refetchTags();
		},
		onError: (error) => {
			console.error("Error updating tag:", error);
			toast.error(error.message || "Failed to update tag. Please try again.");
		},
	});

	// Delete tag mutation
	const deleteTagMutation = trpc.tags.delete.useMutation({
		onSuccess: () => {
			toast.success("Tag deleted successfully!");
			setIsDeleteDialogOpen(false);
			setSelectedTag(null);
			queryClient.invalidateQueries({ queryKey: [["tags", "list"]] });
			refetchTags();
		},
		onError: (error) => {
			console.error("Error deleting tag:", error);
			toast.error(error.message || "Failed to delete tag. Please try again.");
		},
	});

	// Handlers
	const handleAddClick = () => {
		setTagName("");
		setIsAddDialogOpen(true);
	};

	const handleEditClick = (tag: Tag) => {
		setSelectedTag(tag);
		setTagName(tag.name);
		setIsEditDialogOpen(true);
	};

	const handleDeleteClick = (tag: Tag) => {
		setSelectedTag(tag);
		setIsDeleteDialogOpen(true);
	};

	const handleAddSubmit = () => {
		if (!tagName.trim()) {
			toast.error("Tag name is required");
			return;
		}
		createTagMutation.mutate({ name: tagName.trim() });
	};

	const handleEditSubmit = () => {
		if (!selectedTag || !tagName.trim()) {
			toast.error("Tag name is required");
			return;
		}
		updateTagMutation.mutate({ id: selectedTag.id, name: tagName.trim() });
	};

	const handleDeleteConfirm = () => {
		if (!selectedTag) return;
		deleteTagMutation.mutate({ id: selectedTag.id });
	};

	// Show loading while checking authentication and role
	if (isPending || isRoleLoading) {
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

	// Access denied if not admin
	if (!roleData || !roleData.hasAdminAccess) {
		return (
			<div className="flex h-screen items-center justify-center">
				<div className="text-center">
					<h1 className="text-2xl font-semibold">Access Denied</h1>
					<p className="mt-2 text-muted-foreground">
						You don't have permission to access this page.
					</p>
					<Button
						onClick={() => router.push("/dashboard")}
						className="mt-4"
					>
						Go to Dashboard
					</Button>
				</div>
			</div>
		);
	}

	const formatDate = (date: Date | string) => {
		const d = typeof date === "string" ? new Date(date) : date;
		return d.toLocaleDateString("en-US", {
			day: "numeric",
			month: "short",
			year: "numeric",
		});
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
										<RiShieldUserLine size={18} />
										Admin
									</BreadcrumbPage>
								</BreadcrumbItem>
								<BreadcrumbSeparator />
								<BreadcrumbItem>
									<BreadcrumbPage className="flex items-center gap-2">
										<RiPriceTagLine size={18} />
										Tags
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
						<div>
							<h1 className="font-semibold text-2xl">Tag Management</h1>
							<p className="text-muted-foreground text-sm mt-1">
								Create and manage labels for contacts that help you organize data and run automations
							</p>
						</div>
						<Button onClick={handleAddClick} className="bg-green-600 hover:bg-green-700">
							<RiAddLine className="mr-2 h-4 w-4" />
							Create Tag
						</Button>
					</div>

					{/* Search and Filters */}
					<Card>
						<CardHeader>
							<CardTitle>Tags</CardTitle>
							<CardDescription>
								Manage the master list of tags that can be assigned to prospects
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="flex items-center gap-4 mb-6">
								<div className="relative flex-1">
									<RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
									<Input
										placeholder="Search tags..."
										value={searchQuery}
										onChange={(e) => {
											setSearchQuery(e.target.value);
											setCurrentPage(1);
										}}
										className="pl-9"
									/>
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={() => refetchTags()}
									disabled={isLoadingTags}
								>
									<RiRefreshLine className={`mr-2 h-4 w-4 ${isLoadingTags ? "animate-spin" : ""}`} />
									Refresh
								</Button>
							</div>

							{/* Tags Table */}
							{isLoadingTags ? (
								<div className="flex items-center justify-center py-12">
									<RiLoader4Line className="h-8 w-8 animate-spin text-muted-foreground" />
								</div>
							) : tagsError ? (
								<div className="text-center py-12">
									<div className="text-red-500 mb-2">Error loading tags</div>
									<div className="text-sm text-muted-foreground">
										{tagsError.message}
									</div>
									<Button
										variant="outline"
										size="sm"
										onClick={() => refetchTags()}
										className="mt-4"
									>
										Retry
									</Button>
								</div>
							) : tags.length === 0 ? (
								<div className="text-center py-12 text-muted-foreground">
									{searchQuery ? "No tags found matching your search." : "No tags yet. Click 'Create Tag' to get started."}
								</div>
							) : (
								<div className="rounded-md border">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead className="w-12">
													<input type="checkbox" className="rounded border-gray-300" />
												</TableHead>
												<TableHead>Tag Name</TableHead>
												<TableHead>Created On</TableHead>
												<TableHead>Created By</TableHead>
												<TableHead className="text-right">Actions</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{tags.map((tag) => (
												<TableRow key={tag.id}>
													<TableCell>
														<input type="checkbox" className="rounded border-gray-300" />
													</TableCell>
													<TableCell className="font-medium">{tag.name}</TableCell>
													<TableCell>{formatDate(tag.createdAt)}</TableCell>
													<TableCell>{tag.createdByName || "Unknown"}</TableCell>
													<TableCell className="text-right">
														<div className="flex items-center justify-end gap-2">
															<Button
																variant="ghost"
																size="sm"
																onClick={() => handleEditClick(tag)}
															>
																<RiEditLine className="h-4 w-4" />
															</Button>
															<Button
																variant="ghost"
																size="sm"
																onClick={() => handleDeleteClick(tag)}
																className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
															>
																<RiDeleteBinLine className="h-4 w-4" />
															</Button>
														</div>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							)}

							{/* Pagination */}
							{tagsData && tagsData.pagination.totalPages > 1 && (
								<div className="flex items-center justify-between mt-4">
									<div className="text-sm text-muted-foreground">
										Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, tagsData.pagination.total)} of {tagsData.pagination.total} tags
									</div>
									<div className="flex items-center gap-2">
										<Button
											variant="outline"
											size="sm"
											onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
											disabled={currentPage === 1}
										>
											Previous
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() => setCurrentPage((p) => Math.min(tagsData.pagination.totalPages, p + 1))}
											disabled={currentPage === tagsData.pagination.totalPages}
										>
											Next
										</Button>
									</div>
								</div>
							)}
						</CardContent>
					</Card>

					{/* Add Tag Dialog */}
					<Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
						<DialogContent className="sm:max-w-[500px]">
							<DialogHeader>
								<DialogTitle className="flex items-center gap-2">
									<RiPriceTagLine className="size-5" />
									Create New Tag
								</DialogTitle>
								<DialogDescription>
									Add a new tag to the master list. This tag will be available for all agents to use.
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-4 py-4">
								<div className="space-y-2">
									<label className="text-sm font-medium">
										Tag Name <span className="text-destructive">*</span>
									</label>
									<Input
										placeholder="e.g., [ads lead] breeze hill"
										value={tagName}
										onChange={(e) => setTagName(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												handleAddSubmit();
											}
										}}
									/>
									<p className="text-xs text-muted-foreground">
										Enter a descriptive tag name that helps categorize prospects by project or source.
									</p>
								</div>
							</div>
							<DialogFooter>
								<Button
									variant="outline"
									onClick={() => {
										setIsAddDialogOpen(false);
										setTagName("");
									}}
									disabled={createTagMutation.isPending}
								>
									Cancel
								</Button>
								<Button
									onClick={handleAddSubmit}
									disabled={createTagMutation.isPending || !tagName.trim()}
									className="bg-green-600 hover:bg-green-700"
								>
									{createTagMutation.isPending ? (
										<>
											<RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
											Creating...
										</>
									) : (
										<>
											<RiAddLine className="mr-2 h-4 w-4" />
											Create Tag
										</>
									)}
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>

					{/* Edit Tag Dialog */}
					<Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
						<DialogContent className="sm:max-w-[500px]">
							<DialogHeader>
								<DialogTitle className="flex items-center gap-2">
									<RiEditLine className="size-5" />
									Edit Tag
								</DialogTitle>
								<DialogDescription>
									Update the tag name. This will update the tag for all prospects using it.
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-4 py-4">
								<div className="space-y-2">
									<label className="text-sm font-medium">
										Tag Name <span className="text-destructive">*</span>
									</label>
									<Input
										placeholder="e.g., [ads lead] breeze hill"
										value={tagName}
										onChange={(e) => setTagName(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												handleEditSubmit();
											}
										}}
									/>
								</div>
							</div>
							<DialogFooter>
								<Button
									variant="outline"
									onClick={() => {
										setIsEditDialogOpen(false);
										setSelectedTag(null);
										setTagName("");
									}}
									disabled={updateTagMutation.isPending}
								>
									Cancel
								</Button>
								<Button
									onClick={handleEditSubmit}
									disabled={updateTagMutation.isPending || !tagName.trim()}
									className="bg-blue-600 hover:bg-blue-700"
								>
									{updateTagMutation.isPending ? (
										<>
											<RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
											Updating...
										</>
									) : (
										<>
											<RiEditLine className="mr-2 h-4 w-4" />
											Update Tag
										</>
									)}
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>

					{/* Delete Tag Dialog */}
					<Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
						<DialogContent className="sm:max-w-[500px]">
							<DialogHeader>
								<DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
									<RiDeleteBinLine className="size-5" />
									Delete Tag
								</DialogTitle>
								<DialogDescription>
									Are you sure you want to delete this tag? This will remove the tag from all prospects that use it. This action cannot be undone.
								</DialogDescription>
							</DialogHeader>
							{selectedTag && (
								<div className="py-4">
									<div className="rounded-lg border bg-muted/30 p-4">
										<div className="space-y-2">
											<div className="text-sm font-medium text-muted-foreground">Tag Name</div>
											<div className="text-base font-semibold">{selectedTag.name}</div>
											<div className="text-sm text-muted-foreground mt-2">
												Created: {formatDate(selectedTag.createdAt)} by {selectedTag.createdByName || "Unknown"}
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
										setSelectedTag(null);
									}}
									disabled={deleteTagMutation.isPending}
								>
									Cancel
								</Button>
								<Button
									onClick={handleDeleteConfirm}
									disabled={deleteTagMutation.isPending}
									className="bg-red-600 hover:bg-red-700"
								>
									{deleteTagMutation.isPending ? (
										<>
											<RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
											Deleting...
										</>
									) : (
										<>
											<RiDeleteBinLine className="mr-2 h-4 w-4" />
											Delete Tag
										</>
									)}
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
