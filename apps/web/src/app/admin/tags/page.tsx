"use client";

import { HeaderActions } from "@/components/header-actions";
import { Separator } from "@/components/separator";
import { SidebarTrigger } from "@/components/sidebar";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/tooltip";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { formatDateDMY } from "@/lib/date-format";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import {
	RiAddLine,
	RiDashboardLine,
	RiDeleteBinLine,
	RiEditLine,
	RiFileUploadLine,
	RiLoader4Line,
	RiPriceTag3Line,
	RiRefreshLine,
	RiSearchLine,
} from "@remixicon/react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ImportTagsDialog } from "./_components/import-tags-dialog";

interface Tag {
	id: string;
	name: string;
	createdBy: string;
	createdByName?: string;
	createdAt: Date | string;
	updatedAt: Date | string;
}

const thClass =
	"h-11 bg-muted/50 px-4 font-semibold text-foreground/80 text-xs tracking-wide";
const tdClass = "px-4 py-3.5 align-middle text-sm";
const actionBtnClass =
	"size-8 shrink-0 rounded-full border-0 bg-primary/12 p-0 text-primary shadow-none hover:bg-primary/20 hover:text-primary";
const dangerBtnClass =
	"size-8 shrink-0 rounded-full border-0 bg-rose-500/12 p-0 text-rose-600 shadow-none hover:bg-rose-500/20 hover:text-rose-700 dark:text-rose-400";

export default function AdminTagsPage() {
	const queryClient = useQueryClient();
	const { data: session } = authClient.useSession();
	const [searchQuery, setSearchQuery] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isImportOpen, setIsImportOpen] = useState(false);
	const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
	const [tagName, setTagName] = useState("");
	const itemsPerPage = 20;

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
			enabled: !!session,
			retry: 1,
			staleTime: 30000,
		},
	);

	const tags = tagsData?.tags || [];

	const createTagMutation = trpc.tags.create.useMutation({
		onSuccess: () => {
			toast.success("Category created successfully!");
			setIsAddDialogOpen(false);
			setTagName("");
			queryClient.invalidateQueries({ queryKey: [["tags", "list"]] });
			refetchTags();
		},
		onError: (error) => {
			console.error("Error creating tag:", error);
			toast.error(
				error.message || "Failed to create category. Please try again.",
			);
		},
	});

	const updateTagMutation = trpc.tags.update.useMutation({
		onSuccess: () => {
			toast.success("Category updated successfully!");
			setIsEditDialogOpen(false);
			setSelectedTag(null);
			setTagName("");
			queryClient.invalidateQueries({ queryKey: [["tags", "list"]] });
			refetchTags();
		},
		onError: (error) => {
			console.error("Error updating tag:", error);
			toast.error(
				error.message || "Failed to update category. Please try again.",
			);
		},
	});

	const deleteTagMutation = trpc.tags.delete.useMutation({
		onSuccess: () => {
			toast.success("Category deleted successfully!");
			setIsDeleteDialogOpen(false);
			setSelectedTag(null);
			queryClient.invalidateQueries({ queryKey: [["tags", "list"]] });
			refetchTags();
		},
		onError: (error) => {
			console.error("Error deleting tag:", error);
			toast.error(
				error.message || "Failed to delete category. Please try again.",
			);
		},
	});

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
			toast.error("Category name is required");
			return;
		}
		createTagMutation.mutate({ name: tagName.trim() });
	};

	const handleEditSubmit = () => {
		if (!selectedTag || !tagName.trim()) {
			toast.error("Category name is required");
			return;
		}
		updateTagMutation.mutate({ id: selectedTag.id, name: tagName.trim() });
	};

	const handleDeleteConfirm = () => {
		if (!selectedTag) return;
		deleteTagMutation.mutate({ id: selectedTag.id });
	};

	const formatDate = (date: Date | string) => {
		return formatDateDMY(date);
	};

	return (
		<>
			<header className="sticky top-0 z-40 -mx-4 flex h-16 shrink-0 items-center gap-2 border-border/60 border-b bg-background px-4 backdrop-blur-md supports-backdrop-filter:bg-background/95 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
				<div className="flex flex-1 items-center gap-2 px-1 sm:px-0">
					<SidebarTrigger className="-ms-1 rounded-xl" />
					<Separator
						orientation="vertical"
						className="mr-2 data-[orientation=vertical]:h-4"
					/>
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem className="hidden md:block">
								<BreadcrumbLink href="/admin">
									<RiDashboardLine size={22} aria-hidden="true" />
									<span className="sr-only">Admin</span>
								</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator className="hidden md:block" />
							<BreadcrumbItem>
								<BreadcrumbPage className="flex items-center gap-2 font-medium">
									<span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
										<RiPriceTag3Line size={16} />
									</span>
									Lead Categories
								</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				</div>
				<div className="ml-auto flex gap-2">
					<HeaderActions />
				</div>
			</header>

			<div className="flex flex-1 flex-col gap-5 py-5 lg:gap-6 lg:py-7">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="min-w-0 space-y-1">
						<h1 className="font-bold text-2xl tracking-tight">
							Lead Categories
						</h1>
						<p className="max-w-2xl text-muted-foreground text-sm">
							Define categories used to group leads under the same campaign,
							project, or source — for example &quot;Breeze Hill Lead&quot; or
							&quot;Weekend Inquiry&quot;.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button
							variant="outline"
							className="h-9 gap-1.5 rounded-full border-border/70 bg-card shadow-card"
							onClick={() => setIsImportOpen(true)}
						>
							<RiFileUploadLine className="size-4" />
							Import CSV
						</Button>
						<Button
							className="h-9 gap-1.5 rounded-full px-4"
							onClick={handleAddClick}
						>
							<RiAddLine className="size-4" />
							Create Category
						</Button>
					</div>
				</div>

				<Card className="gap-0 overflow-hidden rounded-3xl border-border/50 py-0 shadow-card">
					<CardHeader className="border-border/40 border-b bg-muted/20 px-5 py-4 sm:px-6">
						<div className="flex flex-wrap items-start justify-between gap-2">
							<div className="space-y-1">
								<CardTitle className="font-semibold text-base">
									Categories
								</CardTitle>
								<CardDescription>
									Master list of lead categories. Assign these when creating or
									editing leads.
								</CardDescription>
							</div>
							{tagsData?.pagination.total != null ? (
								<span className="inline-flex items-center rounded-full bg-primary/12 px-2.5 py-1 font-medium text-[11px] text-primary">
									{tagsData.pagination.total} total
								</span>
							) : null}
						</div>
					</CardHeader>
					<CardContent className="p-4 sm:p-5">
						<div className="mb-5 flex flex-wrap items-center gap-2.5">
							<div className="relative min-w-[200px] flex-1">
								<RiSearchLine className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
								<Input
									placeholder="Search categories..."
									value={searchQuery}
									onChange={(e) => {
										setSearchQuery(e.target.value);
										setCurrentPage(1);
									}}
									className="h-10 rounded-xl border-border/70 bg-muted/30 pl-9 shadow-none focus-visible:bg-background"
								/>
							</div>
							<Button
								variant="outline"
								size="sm"
								className="h-10 gap-1.5 rounded-full border-border/70 bg-card shadow-card"
								onClick={() => refetchTags()}
								disabled={isLoadingTags}
							>
								<RiRefreshLine
									className={cn(
										"size-4",
										isLoadingTags ? "animate-spin" : "",
									)}
								/>
								Refresh
							</Button>
						</div>

						{isLoadingTags ? (
							<div className="overflow-hidden rounded-2xl border border-border/60">
								<Table>
									<TableHeader>
										<TableRow className="border-border/60 hover:bg-transparent">
											<TableHead className={cn(thClass, "w-12")}>
												<Skeleton className="size-4 rounded" />
											</TableHead>
											<TableHead className={thClass}>
												<Skeleton className="h-3.5 w-24" />
											</TableHead>
											<TableHead className={thClass}>
												<Skeleton className="h-3.5 w-20" />
											</TableHead>
											<TableHead className={thClass}>
												<Skeleton className="h-3.5 w-20" />
											</TableHead>
											<TableHead className={cn(thClass, "text-center")}>
												<Skeleton className="mx-auto h-3.5 w-14" />
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{[
											"sk-1",
											"sk-2",
											"sk-3",
											"sk-4",
											"sk-5",
											"sk-6",
											"sk-7",
											"sk-8",
										].map((id) => (
											<TableRow
												key={id}
												className="border-border/50 hover:bg-transparent"
											>
												<TableCell className={tdClass}>
													<Skeleton className="size-4 rounded" />
												</TableCell>
												<TableCell className={tdClass}>
													<Skeleton className="h-4 w-40" />
												</TableCell>
												<TableCell className={tdClass}>
													<Skeleton className="h-3.5 w-24" />
												</TableCell>
												<TableCell className={tdClass}>
													<Skeleton className="h-3.5 w-28" />
												</TableCell>
												<TableCell className={cn(tdClass, "text-center")}>
													<div className="flex items-center justify-center gap-1.5">
														<Skeleton className="size-8 rounded-full" />
														<Skeleton className="size-8 rounded-full" />
													</div>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						) : tagsError ? (
							<div className="rounded-2xl border border-border/60 bg-muted/20 py-12 text-center">
								<p className="mb-1 font-medium text-rose-600 dark:text-rose-400">
									Error loading categories
								</p>
								<p className="text-muted-foreground text-sm">
									{tagsError.message}
								</p>
								<Button
									variant="outline"
									size="sm"
									onClick={() => refetchTags()}
									className="mt-4 rounded-full"
								>
									Retry
								</Button>
							</div>
						) : tags.length === 0 ? (
							<div className="rounded-2xl border border-border/60 bg-muted/15 py-14 text-center">
								<span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
									<RiPriceTag3Line size={28} />
								</span>
								<p className="font-medium text-sm">
									{searchQuery
										? "No categories found matching your search."
										: "No categories yet"}
								</p>
								{!searchQuery ? (
									<>
										<p className="mx-auto mt-1 max-w-sm text-muted-foreground text-sm">
											Click Create Category to get started.
										</p>
										<Button
											className="mt-5 h-9 rounded-full px-4"
											onClick={handleAddClick}
										>
											<RiAddLine className="mr-1.5 size-4" />
											Create Category
										</Button>
									</>
								) : null}
							</div>
						) : (
							<div className="overflow-hidden rounded-2xl border border-border/60">
								<Table>
									<TableHeader>
										<TableRow className="border-border/60 hover:bg-transparent">
											<TableHead className={cn(thClass, "w-12")}>
												<Checkbox aria-label="Select all" />
											</TableHead>
											<TableHead className={thClass}>Category Name</TableHead>
											<TableHead className={thClass}>Created On</TableHead>
											<TableHead className={thClass}>Created By</TableHead>
											<TableHead className={cn(thClass, "text-center")}>
												Actions
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{tags.map((tag) => (
											<TableRow
												key={tag.id}
												className="border-border/50 hover:bg-muted/35"
											>
												<TableCell className={tdClass}>
													<Checkbox aria-label={`Select ${tag.name}`} />
												</TableCell>
												<TableCell className={tdClass}>
													<div className="flex items-center gap-2.5">
														<span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
															<RiPriceTag3Line size={14} />
														</span>
														<span className="font-semibold">{tag.name}</span>
													</div>
												</TableCell>
												<TableCell
													className={cn(tdClass, "text-muted-foreground")}
												>
													{formatDate(tag.createdAt)}
												</TableCell>
												<TableCell className={tdClass}>
													{tag.createdByName || "Unknown"}
												</TableCell>
												<TableCell className={cn(tdClass, "text-center")}>
													<div className="flex items-center justify-center gap-1.5">
														<Tooltip>
															<TooltipTrigger asChild>
																<Button
																	variant="ghost"
																	size="icon"
																	className={actionBtnClass}
																	onClick={() => handleEditClick(tag)}
																>
																	<RiEditLine size={15} />
																	<span className="sr-only">Edit</span>
																</Button>
															</TooltipTrigger>
															<TooltipContent>Edit</TooltipContent>
														</Tooltip>
														<Tooltip>
															<TooltipTrigger asChild>
																<Button
																	variant="ghost"
																	size="icon"
																	className={dangerBtnClass}
																	onClick={() => handleDeleteClick(tag)}
																>
																	<RiDeleteBinLine size={15} />
																	<span className="sr-only">Delete</span>
																</Button>
															</TooltipTrigger>
															<TooltipContent>Delete</TooltipContent>
														</Tooltip>
													</div>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						)}

						{tagsData && tagsData.pagination.totalPages > 1 && (
							<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-border/60 border-t pt-3 text-muted-foreground text-sm">
								<span>
									Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
									{Math.min(
										currentPage * itemsPerPage,
										tagsData.pagination.total,
									)}{" "}
									of {tagsData.pagination.total} entries
								</span>
								<div className="flex gap-2">
									<Button
										variant="outline"
										size="sm"
										className="h-8 rounded-full"
										onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
										disabled={currentPage === 1}
									>
										Previous
									</Button>
									<Button
										variant="outline"
										size="sm"
										className="h-8 rounded-full"
										onClick={() =>
											setCurrentPage((p) =>
												Math.min(tagsData.pagination.totalPages, p + 1),
											)
										}
										disabled={
											currentPage === tagsData.pagination.totalPages
										}
									>
										Next
									</Button>
								</div>
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			<Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
				<DialogContent className="gap-0 overflow-hidden rounded-3xl border-border/60 p-0 sm:max-w-[480px]">
					<DialogHeader className="border-border/50 border-b px-6 py-5">
						<DialogTitle className="flex items-center gap-2.5 text-base">
							<span className="flex size-9 items-center justify-center rounded-2xl bg-primary/12 text-primary">
								<RiPriceTag3Line size={18} />
							</span>
							Create New Category
						</DialogTitle>
						<DialogDescription className="pt-1">
							Add a category to the master list. Agents can assign it to leads
							to group them under the same campaign or project.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-2 px-6 py-5">
						<Label htmlFor="add-tag-name">
							Category Name <span className="text-destructive">*</span>
						</Label>
						<Input
							id="add-tag-name"
							placeholder="e.g., Breeze Hill Lead"
							value={tagName}
							onChange={(e) => setTagName(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleAddSubmit();
							}}
							className="h-10 rounded-xl border-border/70"
						/>
						<p className="text-muted-foreground text-xs">
							Use a clear name so agents can group related leads together.
						</p>
					</div>
					<DialogFooter className="border-border/50 border-t bg-muted/20 px-6 py-4">
						<Button
							variant="outline"
							className="rounded-full"
							onClick={() => {
								setIsAddDialogOpen(false);
								setTagName("");
							}}
							disabled={createTagMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							className="rounded-full px-5"
							onClick={handleAddSubmit}
							disabled={createTagMutation.isPending || !tagName.trim()}
						>
							{createTagMutation.isPending ? (
								<>
									<RiLoader4Line className="mr-2 size-4 animate-spin" />
									Creating...
								</>
							) : (
								<>
									<RiAddLine className="mr-2 size-4" />
									Create Category
								</>
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
				<DialogContent className="gap-0 overflow-hidden rounded-3xl border-border/60 p-0 sm:max-w-[480px]">
					<DialogHeader className="border-border/50 border-b px-6 py-5">
						<DialogTitle className="flex items-center gap-2.5 text-base">
							<span className="flex size-9 items-center justify-center rounded-2xl bg-primary/12 text-primary">
								<RiEditLine size={18} />
							</span>
							Edit Category
						</DialogTitle>
						<DialogDescription className="pt-1">
							Rename this category. All leads using it will show the new name.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-2 px-6 py-5">
						<Label htmlFor="edit-tag-name">
							Category Name <span className="text-destructive">*</span>
						</Label>
						<Input
							id="edit-tag-name"
							placeholder="e.g., Breeze Hill Lead"
							value={tagName}
							onChange={(e) => setTagName(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleEditSubmit();
							}}
							className="h-10 rounded-xl border-border/70"
						/>
					</div>
					<DialogFooter className="border-border/50 border-t bg-muted/20 px-6 py-4">
						<Button
							variant="outline"
							className="rounded-full"
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
							className="rounded-full px-5"
							onClick={handleEditSubmit}
							disabled={updateTagMutation.isPending || !tagName.trim()}
						>
							{updateTagMutation.isPending ? (
								<>
									<RiLoader4Line className="mr-2 size-4 animate-spin" />
									Updating...
								</>
							) : (
								<>
									<RiEditLine className="mr-2 size-4" />
									Update Category
								</>
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<ImportTagsDialog
				open={isImportOpen}
				onOpenChange={setIsImportOpen}
				onImported={() => refetchTags()}
			/>

			<Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
				<DialogContent className="gap-0 overflow-hidden rounded-3xl border-border/60 p-0 sm:max-w-[480px]">
					<DialogHeader className="border-border/50 border-b px-6 py-5">
						<DialogTitle className="flex items-center gap-2.5 text-base text-rose-600 dark:text-rose-400">
							<span className="flex size-9 items-center justify-center rounded-2xl bg-rose-500/12 text-rose-600 dark:text-rose-400">
								<RiDeleteBinLine size={18} />
							</span>
							Delete Category
						</DialogTitle>
						<DialogDescription className="pt-1">
							Are you sure you want to delete this category? It will be removed
							from all leads that use it. This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					{selectedTag && (
						<div className="px-6 py-5">
							<div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
								<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
									Category Name
								</p>
								<p className="mt-1 font-semibold text-base">
									{selectedTag.name}
								</p>
								<p className="mt-2 text-muted-foreground text-sm">
									Created: {formatDate(selectedTag.createdAt)} by{" "}
									{selectedTag.createdByName || "Unknown"}
								</p>
							</div>
						</div>
					)}
					<DialogFooter className="border-border/50 border-t bg-muted/20 px-6 py-4">
						<Button
							variant="outline"
							className="rounded-full"
							onClick={() => {
								setIsDeleteDialogOpen(false);
								setSelectedTag(null);
							}}
							disabled={deleteTagMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							className="rounded-full px-5"
							onClick={handleDeleteConfirm}
							disabled={deleteTagMutation.isPending}
						>
							{deleteTagMutation.isPending ? (
								<>
									<RiLoader4Line className="mr-2 size-4 animate-spin" />
									Deleting...
								</>
							) : (
								<>
									<RiDeleteBinLine className="mr-2 size-4" />
									Delete Category
								</>
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
