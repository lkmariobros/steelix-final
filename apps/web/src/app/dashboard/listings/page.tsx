"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { HeaderActions } from "@/components/header-actions";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/sidebar";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { LoadingScreen } from "@/components/ui/loading-spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useRedirectUnauthenticated } from "@/hooks/use-redirect-unauthenticated";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import {
	RiAddLine,
	RiBuildingLine,
	RiDashboardLine,
	RiLoader4Line,
	RiMore2Line,
	RiSearchLine,
} from "@remixicon/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function ListingsPage() {
	const { data: session, isPending } = authClient.useSession();
	useRedirectUnauthenticated(session, isPending);

	const [search, setSearch] = useState("");
	const [status, setStatus] = useState<"active" | "all" | "draft" | "under_offer" | "closed" | "archived">("active");
	const [listingType, setListingType] = useState<"all" | "sale" | "rent">("all");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [title, setTitle] = useState("");
	const [price, setPrice] = useState("");
	const [city, setCity] = useState("");
	const [createType, setCreateType] = useState<"sale" | "rent">("sale");
	const [propertyType, setPropertyType] = useState<"landed" | "condo" | "apartment" | "commercial" | "industrial" | "other">("other");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [detailsId, setDetailsId] = useState<string | null>(null);
	const [editDescription, setEditDescription] = useState("");
	const [editState, setEditState] = useState("");
	const [editAddressLine1, setEditAddressLine1] = useState("");
	const [editPostcode, setEditPostcode] = useState("");
	const [editBedrooms, setEditBedrooms] = useState("");
	const [editBathrooms, setEditBathrooms] = useState("");
	const [editBuiltUpSqft, setEditBuiltUpSqft] = useState("");
	const [referralShareType, setReferralShareType] = useState<"percentage" | "fixed">("percentage");
	const [referralShareValue, setReferralShareValue] = useState("");

	const { data, isLoading, refetch } = trpc.listings.list.useQuery(
		{ search: search || undefined, status, listingType, page: 1, limit: 50 },
		{ enabled: !!session }
	);
	const createMutation = trpc.listings.create.useMutation({
		onSuccess: () => {
			toast.success("Listing created");
			setIsCreateOpen(false);
			setTitle("");
			setPrice("");
			setCity("");
			refetch();
		},
		onError: (e) => toast.error(e.message || "Failed to create listing"),
	});
	const updateMutation = trpc.listings.update.useMutation({
		onSuccess: () => {
			toast.success("Listing updated");
			setEditingId(null);
			refetch();
		},
		onError: (e) => toast.error(e.message || "Failed to update listing"),
	});
	const archiveMutation = trpc.listings.archive.useMutation({
		onSuccess: () => {
			toast.success("Listing status updated");
			refetch();
		},
		onError: (e) => toast.error(e.message || "Failed to archive listing"),
	});
	const referralMutation = trpc.listings.setReferralRule.useMutation({
		onSuccess: () => {
			toast.success("Referral rule updated");
			refetch();
		},
		onError: (e) => toast.error(e.message || "Failed to save referral rule"),
	});
	const linkedTransactionsQuery = trpc.listings.linkedTransactions.useQuery(
		{ listingId: detailsId || "" },
		{ enabled: !!detailsId },
	);
	const listingDetailsQuery = trpc.listings.getById.useQuery(
		{ id: editingId || "" },
		{ enabled: !!editingId },
	);

	const selectedListing = (data?.listings || []).find((x) => x.id === editingId) || null;

	const openEdit = (listing: NonNullable<typeof data>["listings"][number]) => {
		setEditingId(listing.id);
		setTitle(listing.title);
		setPrice(String(listing.price));
		setCity(listing.city || "");
		setCreateType(listing.listingType);
		setPropertyType(listing.propertyType);
		setEditDescription(listing.description || "");
		setEditState(listing.state || "");
		setEditAddressLine1(listing.addressLine1 || "");
		setEditPostcode(listing.postcode || "");
		setEditBedrooms(listing.bedrooms === null ? "" : String(listing.bedrooms));
		setEditBathrooms(listing.bathrooms === null ? "" : String(listing.bathrooms));
		setEditBuiltUpSqft(listing.builtUpSqft === null ? "" : String(listing.builtUpSqft));
	};

	useEffect(() => {
		if (!listingDetailsQuery.data?.referralRule) {
			setReferralShareType("percentage");
			setReferralShareValue("");
			return;
		}
		setReferralShareType(listingDetailsQuery.data.referralRule.shareType);
		setReferralShareValue(String(listingDetailsQuery.data.referralRule.shareValue));
	}, [listingDetailsQuery.data]);

	if (isPending) return <LoadingScreen text="Loading..." />;
	if (!session) return <LoadingScreen text="Redirecting..." />;

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset className="overflow-hidden px-4 md:px-6 lg:px-8">
				<header className="flex h-16 shrink-0 items-center gap-2 border-b">
					<div className="flex flex-1 items-center gap-2 px-3">
						<SidebarTrigger className="-ms-4" />
						<Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
						<Breadcrumb>
							<BreadcrumbList>
								<BreadcrumbItem className="hidden md:block">
									<BreadcrumbLink href="/dashboard">
										<RiDashboardLine size={22} aria-hidden />
										<span className="sr-only">Dashboard</span>
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator className="hidden md:block" />
								<BreadcrumbItem>
									<BreadcrumbPage className="flex items-center gap-2">
										<RiBuildingLine size={18} />
										Listings
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
					<div className="flex flex-wrap items-center gap-2">
						<div className="relative min-w-[260px] flex-1">
							<RiSearchLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search listings..." className="pl-9" />
						</div>
						<Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
							<SelectTrigger className="w-40">
								<SelectValue placeholder="Status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="active">Active</SelectItem>
								<SelectItem value="draft">Draft</SelectItem>
								<SelectItem value="under_offer">Under Offer</SelectItem>
								<SelectItem value="closed">Closed</SelectItem>
								<SelectItem value="archived">Archived</SelectItem>
								<SelectItem value="all">All</SelectItem>
							</SelectContent>
						</Select>
						<Select value={listingType} onValueChange={(v) => setListingType(v as typeof listingType)}>
							<SelectTrigger className="w-36">
								<SelectValue placeholder="Type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="sale">Sale</SelectItem>
								<SelectItem value="rent">Rent</SelectItem>
								<SelectItem value="all">All</SelectItem>
							</SelectContent>
						</Select>
						<Button onClick={() => setIsCreateOpen(true)} className="bg-green-600 hover:bg-green-700">
							<RiAddLine className="mr-2 h-4 w-4" />
							Add Listing
						</Button>
					</div>

					<div className="rounded-lg border">
						<div className="grid grid-cols-12 border-b px-4 py-2 text-muted-foreground text-xs uppercase tracking-wide">
							<div className="col-span-4">Title</div>
							<div className="col-span-2">Type</div>
							<div className="col-span-2">Status</div>
							<div className="col-span-2">City</div>
							<div className="col-span-1 text-right">Price</div>
							<div className="col-span-1 text-right">Actions</div>
						</div>
						{isLoading ? (
							<div className="p-6 text-sm text-muted-foreground">Loading listings...</div>
						) : (data?.listings?.length || 0) === 0 ? (
							<div className="p-6 text-sm text-muted-foreground">No listings found.</div>
						) : (
							data?.listings.map((row) => (
								<div key={row.id} className="grid grid-cols-12 items-center border-b px-4 py-3 text-sm last:border-b-0">
									<div className="col-span-4 font-medium">{row.title}</div>
									<div className="col-span-2 capitalize">{row.listingType}</div>
									<div className="col-span-2">
										<Badge variant={row.status === "active" ? "default" : "secondary"} className="capitalize">
											{row.status.replace("_", " ")}
										</Badge>
									</div>
									<div className="col-span-2">{row.city || "-"}</div>
									<div className="col-span-1 text-right">{Number(row.price).toLocaleString()}</div>
									<div className="col-span-1 text-right">
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button variant="ghost" size="icon">
													<RiMore2Line className="h-4 w-4" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem onClick={() => openEdit(row)}>Edit listing</DropdownMenuItem>
												<DropdownMenuItem onClick={() => setDetailsId(row.id)}>View details</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() =>
														archiveMutation.mutate({
															id: row.id,
															archived: row.status !== "archived",
														})
													}
												>
													{row.status === "archived" ? "Unarchive" : "Archive"}
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
								</div>
							))
						)}
					</div>
				</div>
			</SidebarInset>

			<Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
				<DialogContent className="sm:max-w-[480px]">
					<DialogHeader>
						<DialogTitle>Create Listing</DialogTitle>
						<DialogDescription>Add a new internal listing for agents.</DialogDescription>
					</DialogHeader>
					<div className="space-y-3">
						<Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
						<div className="grid grid-cols-2 gap-2">
							<Select value={createType} onValueChange={(v) => setCreateType(v as "sale" | "rent")}>
								<SelectTrigger><SelectValue placeholder="Listing Type" /></SelectTrigger>
								<SelectContent>
									<SelectItem value="sale">Sale</SelectItem>
									<SelectItem value="rent">Rent</SelectItem>
								</SelectContent>
							</Select>
							<Select
								value={propertyType}
								onValueChange={(v) => setPropertyType(v as typeof propertyType)}
							>
								<SelectTrigger><SelectValue placeholder="Property Type" /></SelectTrigger>
								<SelectContent>
									<SelectItem value="landed">Landed</SelectItem>
									<SelectItem value="condo">Condo</SelectItem>
									<SelectItem value="apartment">Apartment</SelectItem>
									<SelectItem value="commercial">Commercial</SelectItem>
									<SelectItem value="industrial">Industrial</SelectItem>
									<SelectItem value="other">Other</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<Input placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} />
						<Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
						<Button
							onClick={() =>
								createMutation.mutate({
									title: title.trim(),
									listingType: createType,
									propertyType,
									price: Number(price),
									city: city.trim() || undefined,
									status: "active",
								})
							}
							disabled={!title.trim() || !price || Number.isNaN(Number(price)) || createMutation.isPending}
						>
							{createMutation.isPending ? (
								<>
									<RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
									Creating...
								</>
							) : (
								"Create"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<Dialog open={!!editingId} onOpenChange={(open) => !open && setEditingId(null)}>
				<DialogContent className="sm:max-w-[620px]">
					<DialogHeader>
						<DialogTitle>Edit Listing</DialogTitle>
						<DialogDescription>Update listing details and referral setup.</DialogDescription>
					</DialogHeader>
					<div className="grid grid-cols-2 gap-3">
						<Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="col-span-2" />
						<Select value={createType} onValueChange={(v) => setCreateType(v as "sale" | "rent")}>
							<SelectTrigger><SelectValue placeholder="Listing Type" /></SelectTrigger>
							<SelectContent>
								<SelectItem value="sale">Sale</SelectItem>
								<SelectItem value="rent">Rent</SelectItem>
							</SelectContent>
						</Select>
						<Select value={propertyType} onValueChange={(v) => setPropertyType(v as typeof propertyType)}>
							<SelectTrigger><SelectValue placeholder="Property Type" /></SelectTrigger>
							<SelectContent>
								<SelectItem value="landed">Landed</SelectItem>
								<SelectItem value="condo">Condo</SelectItem>
								<SelectItem value="apartment">Apartment</SelectItem>
								<SelectItem value="commercial">Commercial</SelectItem>
								<SelectItem value="industrial">Industrial</SelectItem>
								<SelectItem value="other">Other</SelectItem>
							</SelectContent>
						</Select>
						<Input placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} />
						<Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
						<Input placeholder="State" value={editState} onChange={(e) => setEditState(e.target.value)} />
						<Input placeholder="Postcode" value={editPostcode} onChange={(e) => setEditPostcode(e.target.value)} />
						<Input placeholder="Bedrooms" value={editBedrooms} onChange={(e) => setEditBedrooms(e.target.value)} />
						<Input placeholder="Bathrooms" value={editBathrooms} onChange={(e) => setEditBathrooms(e.target.value)} />
						<Input placeholder="Built-up sqft" value={editBuiltUpSqft} onChange={(e) => setEditBuiltUpSqft(e.target.value)} />
						<Input
							placeholder="Address line 1"
							value={editAddressLine1}
							onChange={(e) => setEditAddressLine1(e.target.value)}
							className="col-span-2"
						/>
						<Textarea
							placeholder="Description"
							value={editDescription}
							onChange={(e) => setEditDescription(e.target.value)}
							className="col-span-2"
						/>
						<div className="col-span-2 rounded-md border p-3">
							<p className="mb-2 font-medium text-sm">Referral Rule</p>
							<div className="grid grid-cols-2 gap-2">
								<Select value={referralShareType} onValueChange={(v) => setReferralShareType(v as "percentage" | "fixed")}>
									<SelectTrigger><SelectValue placeholder="Share Type" /></SelectTrigger>
									<SelectContent>
										<SelectItem value="percentage">Percentage</SelectItem>
										<SelectItem value="fixed">Fixed</SelectItem>
									</SelectContent>
								</Select>
								<Input
									placeholder={referralShareType === "percentage" ? "Share %" : "Fixed amount"}
									value={referralShareValue}
									onChange={(e) => setReferralShareValue(e.target.value)}
								/>
							</div>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
						<Button
							variant="outline"
							onClick={() =>
								selectedListing &&
								referralMutation.mutate({
									listingId: selectedListing.id,
									shareType: referralShareType,
									shareValue: Number(referralShareValue),
								})
							}
							disabled={!selectedListing || !referralShareValue || Number.isNaN(Number(referralShareValue))}
						>
							Save Referral Rule
						</Button>
						<Button
							onClick={() =>
								selectedListing &&
								updateMutation.mutate({
									id: selectedListing.id,
									title: title.trim(),
									listingType: createType,
									propertyType,
									price: Number(price),
									city: city.trim() || undefined,
									state: editState.trim() || undefined,
									addressLine1: editAddressLine1.trim() || undefined,
									postcode: editPostcode.trim() || undefined,
									description: editDescription.trim() || undefined,
									bedrooms: editBedrooms ? Number(editBedrooms) : undefined,
									bathrooms: editBathrooms ? Number(editBathrooms) : undefined,
									builtUpSqft: editBuiltUpSqft ? Number(editBuiltUpSqft) : undefined,
								})
							}
							disabled={!selectedListing || !title.trim() || !price || Number.isNaN(Number(price)) || updateMutation.isPending}
						>
							{updateMutation.isPending ? "Saving..." : "Save Listing"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<Dialog open={!!detailsId} onOpenChange={(open) => !open && setDetailsId(null)}>
				<DialogContent className="sm:max-w-[680px]">
					<DialogHeader>
						<DialogTitle>Linked Transactions</DialogTitle>
						<DialogDescription>Transactions currently linked to this listing.</DialogDescription>
					</DialogHeader>
					{linkedTransactionsQuery.isLoading ? (
						<p className="text-sm text-muted-foreground">Loading linked transactions...</p>
					) : (linkedTransactionsQuery.data?.transactions.length || 0) === 0 ? (
						<p className="text-sm text-muted-foreground">No linked transactions yet.</p>
					) : (
						<div className="space-y-2">
							{linkedTransactionsQuery.data?.transactions.map((txn) => (
								<div key={txn.id} className="rounded-md border p-3">
									<div className="flex items-center justify-between">
										<p className="font-medium text-sm">{txn.id.slice(0, 8)}...</p>
										<Badge className="capitalize" variant="secondary">
											{(txn.status || "draft").replace("_", " ")}
										</Badge>
									</div>
									<p className="text-muted-foreground text-xs">
										Client: {txn.clientData?.name || "N/A"} | Updated: {new Date(txn.updatedAt).toLocaleString()}
									</p>
								</div>
							))}
						</div>
					)}
				</DialogContent>
			</Dialog>
		</SidebarProvider>
	);
}

