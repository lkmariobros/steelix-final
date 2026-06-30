"use client";

import { HeaderActions } from "@/components/header-actions";
import { Separator } from "@/components/separator";
import { SidebarTrigger } from "@/components/sidebar";
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
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/utils/trpc";
import {
	RiCheckLine,
	RiClipboardLine,
	RiCloseLine,
	RiDashboardLine,
	RiLinkM,
	RiRefreshLine,
	RiTeamLine,
	RiUserAddLine,
} from "@remixicon/react";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";

type ApplicationStatus = "pending_review" | "approved" | "rejected";

const STATUS_LABELS: Record<ApplicationStatus, string> = {
	pending_review: "Pending review",
	approved: "Approved",
	rejected: "Rejected",
};

function formatDate(value: Date | string | null | undefined) {
	if (!value) return "—";
	return new Date(value).toLocaleString();
}

export default function ERecruitmentAdminPage() {
	const [statusFilter, setStatusFilter] = useState<
		ApplicationStatus | "all"
	>("pending_review");
	const [inviteeName, setInviteeName] = useState("");
	const [inviteeEmail, setInviteeEmail] = useState("");
	const [recruiterId, setRecruiterId] = useState("");
	const [generatedUrl, setGeneratedUrl] = useState("");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [rejectReason, setRejectReason] = useState("");
	const [tempPassword, setTempPassword] = useState("");
	const [agentCode, setAgentCode] = useState("");
	const [isRejectOpen, setIsRejectOpen] = useState(false);
	const [isApproveOpen, setIsApproveOpen] = useState(false);

	const utils = trpc.useUtils();

	const listQuery = trpc.erecruitment.listApplications.useQuery({
		status: statusFilter === "all" ? undefined : statusFilter,
		limit: 50,
	});

	const detailQuery = trpc.erecruitment.getApplication.useQuery(
		{ id: selectedId! },
		{ enabled: !!selectedId },
	);

	const nextAgentCodeQuery = trpc.agents.previewNextAgentCode.useQuery(
		undefined,
		{ enabled: isApproveOpen },
	);

	useEffect(() => {
		if (isApproveOpen && nextAgentCodeQuery.data?.agentCode) {
			setAgentCode(nextAgentCodeQuery.data.agentCode);
		}
	}, [isApproveOpen, nextAgentCodeQuery.data?.agentCode]);

	const { data: recruiters } = trpc.agents.list.useQuery({
		limit: 100,
		role: "agent",
		sortBy: "name",
		sortOrder: "asc",
	});

	const createLinkMutation = trpc.erecruitment.createLink.useMutation({
		onSuccess: (link) => {
			const url = `${window.location.origin}/join/${link.token}`;
			setGeneratedUrl(url);
			toast.success("Recruitment link created");
		},
		onError: (e) => toast.error(e.message),
	});

	const approveMutation = trpc.erecruitment.approve.useMutation({
		onSuccess: (result) => {
			toast.success(
				`Agent approved. Temporary password: ${result.temporaryPassword}`,
			);
			setIsApproveOpen(false);
			setSelectedId(null);
			setTempPassword("");
			setAgentCode("");
			void listQuery.refetch();
			void utils.agents.list.invalidate();
		},
		onError: (e) => toast.error(e.message),
	});

	const rejectMutation = trpc.erecruitment.reject.useMutation({
		onSuccess: () => {
			toast.success("Application rejected");
			setIsRejectOpen(false);
			setSelectedId(null);
			setRejectReason("");
			void listQuery.refetch();
		},
		onError: (e) => toast.error(e.message),
	});

	const applications = listQuery.data ?? [];
	const selected = detailQuery.data;

	const recruiterOptions = useMemo(
		() => recruiters?.agents?.map((a) => a.agent) ?? [],
		[recruiters],
	);

	const copyLink = async () => {
		if (!generatedUrl) return;
		await navigator.clipboard.writeText(generatedUrl);
		toast.success("Link copied to clipboard");
	};

	const openDocument = (url?: string, dataUrl?: string) => {
		const target = url || dataUrl;
		if (target) window.open(target, "_blank", "noopener,noreferrer");
	};

	return (
		<>
			<header className="flex h-16 shrink-0 items-center gap-2 border-b">
				<div className="flex flex-1 items-center gap-2 px-3">
					<SidebarTrigger className="-ms-4" />
					<Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
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
									<RiUserAddLine size={20} aria-hidden="true" />
									eRecruitment Approval
								</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				</div>
				<div className="ml-auto flex gap-3">
					<HeaderActions />
				</div>
			</header>

			<div className="flex flex-1 flex-col gap-6 py-6">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">eRecruitment Approval</h1>
					<p className="text-muted-foreground text-sm">
						Generate recruitment links for new joiners, then review and approve submitted applications.
					</p>
				</div>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<RiLinkM className="size-5" />
							Generate recruitment link
						</CardTitle>
						<CardDescription>
							Link includes recruiter name. Optionally pre-fill invitee name and email.
						</CardDescription>
					</CardHeader>
					<CardContent className="grid gap-4 md:grid-cols-2">
						<div className="space-y-2">
							<Label>Invitee name (optional)</Label>
							<Input
								value={inviteeName}
								onChange={(e) => setInviteeName(e.target.value)}
								placeholder="New joiner full name"
							/>
						</div>
						<div className="space-y-2">
							<Label>Invitee email (optional)</Label>
							<Input
								type="email"
								value={inviteeEmail}
								onChange={(e) => setInviteeEmail(e.target.value)}
								placeholder="newjoiner@email.com"
							/>
						</div>
						<div className="space-y-2 md:col-span-2">
							<Label>Recruiter</Label>
							<Select
								value={recruiterId || "__self__"}
								onValueChange={(v) =>
									setRecruiterId(v === "__self__" ? "" : v)
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select recruiter" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="__self__">Use my account as recruiter</SelectItem>
									{recruiterOptions.map((r) => (
										<SelectItem key={r.id} value={r.id}>
											{r.name} ({r.email})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex flex-wrap gap-2 md:col-span-2">
							<Button
								onClick={() =>
									createLinkMutation.mutate({
										inviteeName: inviteeName.trim() || undefined,
										inviteeEmail: inviteeEmail.trim() || undefined,
										recruiterId: recruiterId || undefined,
									})
								}
								disabled={createLinkMutation.isPending}
							>
								Generate link
							</Button>
							{generatedUrl ? (
								<Button variant="outline" onClick={() => void copyLink()}>
									<RiClipboardLine className="mr-1.5 size-4" />
									Copy link
								</Button>
							) : null}
						</div>
						{generatedUrl ? (
							<p className="break-all rounded-md border bg-muted/40 p-3 font-mono text-sm md:col-span-2">
								{generatedUrl}
							</p>
						) : null}
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between gap-4">
						<div>
							<CardTitle>Submitted applications</CardTitle>
							<CardDescription>Review joiner details and approve to create agent accounts</CardDescription>
						</div>
						<div className="flex items-center gap-2">
							<Select
								value={statusFilter}
								onValueChange={(v) =>
									setStatusFilter(v as ApplicationStatus | "all")
								}
							>
								<SelectTrigger className="w-40">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="pending_review">Pending</SelectItem>
									<SelectItem value="approved">Approved</SelectItem>
									<SelectItem value="rejected">Rejected</SelectItem>
									<SelectItem value="all">All</SelectItem>
								</SelectContent>
							</Select>
							<Button
								variant="outline"
								size="icon"
								onClick={() => void listQuery.refetch()}
							>
								<RiRefreshLine className="size-4" />
							</Button>
						</div>
					</CardHeader>
					<CardContent>
						{listQuery.isLoading ? (
							<div className="space-y-3">
								{["sk1", "sk2", "sk3"].map((id) => (
									<Skeleton key={id} className="h-16 w-full" />
								))}
							</div>
						) : applications.length === 0 ? (
							<p className="py-8 text-center text-muted-foreground text-sm">
								No applications found for this filter.
							</p>
						) : (
							<div className="space-y-3">
								{applications.map((app) => (
									<div
										key={app.id}
										className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
									>
										<div>
											<div className="flex flex-wrap items-center gap-2">
												<p className="font-medium">{app.fullName}</p>
												<Badge variant="outline">
													{STATUS_LABELS[app.status as ApplicationStatus]}
												</Badge>
											</div>
											<p className="text-muted-foreground text-sm">
												{app.email} · Recruiter: {app.recruiterName} ·{" "}
												{formatDate(app.createdAt)}
											</p>
										</div>
										<Button
											variant="outline"
											size="sm"
											onClick={() => setSelectedId(app.id)}
										>
											Review
										</Button>
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			<Dialog open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
				<DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Application review</DialogTitle>
						<DialogDescription>
							Verify all details and documents before approving.
						</DialogDescription>
					</DialogHeader>

					{detailQuery.isLoading || !selected ? (
						<Skeleton className="h-40 w-full" />
					) : (
						<div className="space-y-4 text-sm">
							<div className="grid gap-3 sm:grid-cols-2">
								<Info label="Full name" value={selected.fullName} />
								<Info label="Nick name" value={selected.nickName} />
								<Info label="NRIC" value={selected.nric} />
								<Info label="Email" value={selected.email} />
								<Info label="Registration fee" value={selected.registrationFee} />
								<Info label="Payment method" value={selected.paymentMethod} />
								<Info label="Address" value={selected.address} />
								<Info label="Contact no." value={selected.contactNo} />
								<Info label="Marital status" value={selected.maritalStatus} />
								<Info label="Recruiter" value={selected.recruiterName} />
							</div>

							<div className="rounded-md border p-3">
								<p className="mb-2 font-medium">Emergency contact</p>
								<div className="grid gap-2 sm:grid-cols-3">
									<Info label="Name" value={selected.emergencyName} />
									<Info label="Contact" value={selected.emergencyContactNo} />
									<Info label="Relationship" value={selected.emergencyRelationship} />
								</div>
							</div>

							<div className="rounded-md border p-3">
								<p className="mb-2 font-medium">Bank info</p>
								<div className="grid gap-2 sm:grid-cols-2">
									<Info label="Bank name" value={selected.bankName} />
									<Info label="Account no." value={selected.bankAccountNo} />
									<Info label="Account name" value={selected.bankAccountName} />
									<Info label="Income tax no." value={selected.incomeTaxNo} />
								</div>
							</div>

							<div className="rounded-md border p-3">
								<p className="mb-2 font-medium">Uploads</p>
								<div className="flex flex-wrap gap-2">
									<DocButton
										label="IC front"
										file={selected.documents?.icFront}
										onOpen={openDocument}
									/>
									<DocButton
										label="IC back"
										file={selected.documents?.icBack}
										onOpen={openDocument}
									/>
									<DocButton
										label="Fee receipt"
										file={selected.documents?.registrationFeeReceipt}
										onOpen={openDocument}
									/>
								</div>
							</div>

							<div className="rounded-md border p-3">
								<p className="mb-1 font-medium">Agreements</p>
								<p>
									Company policy:{" "}
									{selected.acceptedCompanyPolicy ? "Accepted" : "Not accepted"}
								</p>
								<p>
									NDA: {selected.acceptedNda ? "Accepted" : "Not accepted"}
								</p>
							</div>

							{selected.status === "pending_review" ? (
								<DialogFooter className="gap-2 sm:gap-0">
									<Button
										variant="outline"
										onClick={() => setIsRejectOpen(true)}
									>
										<RiCloseLine className="mr-1 size-4" />
										Reject
									</Button>
									<Button onClick={() => setIsApproveOpen(true)}>
										<RiCheckLine className="mr-1 size-4" />
										Approve & create agent
									</Button>
								</DialogFooter>
							) : null}
						</div>
					)}
				</DialogContent>
			</Dialog>

			<Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Approve application</DialogTitle>
						<DialogDescription>
							This creates an agent account. Leave password blank to auto-generate one.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="space-y-2">
							<Label>Agent code</Label>
							<Input
								value={agentCode}
								onChange={(e) => setAgentCode(e.target.value)}
								placeholder="DT00001"
								className="font-mono"
							/>
							<p className="text-muted-foreground text-xs">
								Preset from the next available code. You can edit before approving.
							</p>
						</div>
						<div className="space-y-2">
							<Label>Temporary password (optional)</Label>
							<Input
								type="password"
								value={tempPassword}
								onChange={(e) => setTempPassword(e.target.value)}
								placeholder="Min 8 characters"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							onClick={() =>
								selectedId &&
								approveMutation.mutate({
									applicationId: selectedId,
									temporaryPassword: tempPassword.trim() || undefined,
									agentCode: agentCode.trim() || undefined,
								})
							}
							disabled={approveMutation.isPending}
						>
							Confirm approval
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Reject application</DialogTitle>
					</DialogHeader>
					<div className="space-y-2">
						<Label>Reason (optional)</Label>
						<Textarea
							value={rejectReason}
							onChange={(e) => setRejectReason(e.target.value)}
							rows={3}
						/>
					</div>
					<DialogFooter>
						<Button
							variant="destructive"
							onClick={() =>
								selectedId &&
								rejectMutation.mutate({
									applicationId: selectedId,
									reason: rejectReason.trim() || undefined,
								})
							}
							disabled={rejectMutation.isPending}
						>
							Reject application
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

function Info({
	label,
	value,
}: {
	label: string;
	value: string | null | undefined;
}) {
	return (
		<div>
			<p className="text-muted-foreground text-xs">{label}</p>
			<p className="font-medium">{value?.trim() ? value : "—"}</p>
		</div>
	);
}

function DocButton({
	label,
	file,
	onOpen,
}: {
	label: string;
	file?: { url?: string; dataUrl?: string; fileName?: string };
	onOpen: (url?: string, dataUrl?: string) => void;
}) {
	const target = file?.url || file?.dataUrl;
	if (!target) {
		return (
			<Button variant="outline" size="sm" disabled>
				{label} (missing)
			</Button>
		);
	}
	return (
		<Button
			variant="outline"
			size="sm"
			onClick={() => onOpen(file?.url, file?.dataUrl)}
		>
			{label}
		</Button>
	);
}
