"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { HeaderActions } from "@/components/header-actions";
import { Separator } from "@/components/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/sidebar";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/table";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingScreen } from "@/components/ui/loading-spinner";
import { useRedirectUnauthenticated } from "@/hooks/use-redirect-unauthenticated";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { RiArrowLeftLine, RiDashboardLine } from "@remixicon/react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

export default function ClaimSchedulesPage() {
	const { data: session, isPending } = authClient.useSession();
	useRedirectUnauthenticated(session, isPending);

	const list = trpc.commissionPayouts.claimSchedulesList.useQuery(
		{},
		{
			enabled: !!session,
		},
	);

	const [projectName, setProjectName] = useState("");
	const [stage, setStage] = useState("");
	const [pct, setPct] = useState("50");
	const [sortOrder, setSortOrder] = useState("0");

	const upsert = trpc.commissionPayouts.claimScheduleUpsert.useMutation({
		onSuccess: () => {
			toast.success("Saved");
			setStage("");
			void list.refetch();
		},
		onError: (e) => toast.error(e.message),
	});

	const del = trpc.commissionPayouts.claimScheduleDelete.useMutation({
		onSuccess: () => {
			toast.success("Deleted");
			void list.refetch();
		},
		onError: (e) => toast.error(e.message),
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
						<Separator orientation="vertical" className="mr-2 h-4" />
						<Breadcrumb>
							<BreadcrumbList>
								<BreadcrumbItem>
									<BreadcrumbLink href="/admin">
										<RiDashboardLine size={22} aria-hidden />
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator />
								<BreadcrumbItem>
									<BreadcrumbLink href="/admin/commissions">Commissions</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator />
								<BreadcrumbItem>
									<BreadcrumbPage>Claim schedules</BreadcrumbPage>
								</BreadcrumbItem>
							</BreadcrumbList>
						</Breadcrumb>
					</div>
					<HeaderActions />
				</header>

				<div className="flex flex-col gap-4 py-6">
					<Button variant="ghost" className="w-fit gap-2" asChild>
						<Link href="/admin/commissions">
							<RiArrowLeftLine className="size-4" />
							Back
						</Link>
					</Button>

					<h1 className="font-semibold text-2xl">Project claim schedules</h1>
					<p className="text-muted-foreground text-sm max-w-2xl">
						Define stages and % payable per project. New commission payouts copy the first stage
						(sorted by order) onto the payout row for visibility.
					</p>

					<Card>
						<CardContent className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-5">
							<div className="lg:col-span-2">
								<Label>Project name</Label>
								<Input
									value={projectName}
									onChange={(e) => setProjectName(e.target.value)}
									placeholder="Must match commission scheme project name"
								/>
							</div>
							<div className="lg:col-span-2">
								<Label>Claim stage</Label>
								<Input
									value={stage}
									onChange={(e) => setStage(e.target.value)}
									placeholder="e.g. Booking / SPA signed"
								/>
							</div>
							<div>
								<Label>% payable</Label>
								<Input
									type="number"
									min={0}
									max={100}
									step={0.01}
									value={pct}
									onChange={(e) => setPct(e.target.value)}
								/>
							</div>
							<div>
								<Label>Sort order</Label>
								<Input
									type="number"
									value={sortOrder}
									onChange={(e) => setSortOrder(e.target.value)}
								/>
							</div>
							<div className="flex items-end">
								<Button
									disabled={upsert.isPending || !projectName.trim() || !stage.trim()}
									onClick={() =>
										upsert.mutate({
											projectName: projectName.trim(),
											claimStage: stage.trim(),
											percentPayable: Number.parseFloat(pct),
											sortOrder: Number.parseInt(sortOrder, 10) || 0,
										})
									}
								>
									Add row
								</Button>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardContent className="pt-4">
							<div className="rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Project</TableHead>
											<TableHead>Stage</TableHead>
											<TableHead className="text-right">%</TableHead>
											<TableHead className="text-right">Order</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{(list.data ?? []).length === 0 ? (
											<TableRow>
												<TableCell colSpan={5} className="text-center text-muted-foreground">
													No schedules yet.
												</TableCell>
											</TableRow>
										) : (
											(list.data ?? []).map((r) => (
												<TableRow key={r.id}>
													<TableCell>{r.projectName}</TableCell>
													<TableCell>{r.claimStage}</TableCell>
													<TableCell className="text-right">{r.percentPayable}%</TableCell>
													<TableCell className="text-right">{r.sortOrder}</TableCell>
													<TableCell className="text-right">
														<Button
															variant="ghost"
															size="sm"
															className="text-destructive"
															onClick={() => del.mutate({ id: r.id })}
														>
															Delete
														</Button>
													</TableCell>
												</TableRow>
											))
										)}
									</TableBody>
								</Table>
							</div>
						</CardContent>
					</Card>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
