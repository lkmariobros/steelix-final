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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LoadingScreen } from "@/components/ui/loading-spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useRedirectUnauthenticated } from "@/hooks/use-redirect-unauthenticated";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { RiAddLine, RiBuildingLine, RiDashboardLine, RiLoader4Line, RiSearchLine } from "@remixicon/react";
import { useState } from "react";
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
							<div className="col-span-2 text-right">Price</div>
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
									<div className="col-span-2 capitalize">{row.status.replace("_", " ")}</div>
									<div className="col-span-2">{row.city || "-"}</div>
									<div className="col-span-2 text-right">{Number(row.price).toLocaleString()}</div>
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
		</SidebarProvider>
	);
}

