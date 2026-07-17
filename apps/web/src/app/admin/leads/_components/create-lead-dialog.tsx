"use client";

import { useEffect, useState } from "react";
import type React from "react";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";
import {
	LEAD_SOURCE_OPTIONS,
	LEAD_TYPE_OPTIONS,
	PIPELINE_STAGES,
	STATUS_OPTIONS,
	type PipelineStageValue,
} from "./lead-constants";
import { DupeError } from "./dupe-error";
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
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { TagSelector } from "@/components/tag-selector";
import { RiAddLine, RiErrorWarningLine, RiLoader4Line } from "@remixicon/react";

/** Hidden DB defaults — Type / Property Interest removed from create UI. */
const DEFAULT_TYPE = "buyer" as const;
const DEFAULT_PROPERTY = "—";

export function CreateLeadDialog({
	open,
	onClose,
	agents,
	onSuccess,
}: {
	open: boolean;
	onClose: () => void;
	agents: Array<{
		agentId: string;
		agentName: string | null;
		agentEmail: string;
	}>;
	onSuccess: () => void;
}) {
	const emptyForm = {
		name: "",
		email: "",
		phone: "",
		source: "",
		status: "active" as "active" | "inactive",
		stage: "new_lead",
		leadType: "personal" as "personal" | "company",
		agentId: "",
	};

	const [form, setForm] = useState(emptyForm);
	const [tagIds, setTagIds] = useState<string[]>([]);
	const [debouncedEmail, setDebouncedEmail] = useState("");
	const [debouncedPhone, setDebouncedPhone] = useState("");

	useEffect(() => {
		const t = setTimeout(() => setDebouncedEmail(form.email.trim()), 500);
		return () => clearTimeout(t);
	}, [form.email]);

	useEffect(() => {
		const t = setTimeout(() => setDebouncedPhone(form.phone.trim()), 500);
		return () => clearTimeout(t);
	}, [form.phone]);

	const isValidEmail =
		debouncedEmail.length === 0 ||
		/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(debouncedEmail);
	const isValidPhone = debouncedPhone.length >= 8;

	const { data: dupeCheck, isFetching: dupeChecking } =
		trpc.adminLeads.checkDuplicate.useQuery(
			{ email: debouncedEmail, phone: debouncedPhone },
			{ enabled: isValidPhone && isValidEmail, staleTime: 3000 },
		);

	const hasBlockingDuplicate = !!dupeCheck?.emailTaken;

	const createMutation = trpc.adminLeads.create.useMutation({
		onSuccess: () => {
			if (dupeCheck?.phoneTaken) {
				toast.warning(
					"Phone number already exists. Lead was still saved as requested.",
				);
			}
			toast.success("Lead created successfully");
			setForm(emptyForm);
			setTagIds([]);
			setDebouncedEmail("");
			setDebouncedPhone("");
			onSuccess();
			onClose();
		},
		onError: (e) => toast.error(e.message),
	});

	const f =
		(k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
			setForm((p) => ({ ...p, [k]: e.target.value }));

	const handleClose = () => {
		onClose();
		setForm(emptyForm);
		setTagIds([]);
		setDebouncedEmail("");
		setDebouncedPhone("");
	};

	const canSubmit =
		!!form.name.trim() &&
		!!form.phone.trim() &&
		!!form.source &&
		!!form.agentId &&
		!hasBlockingDuplicate &&
		!dupeChecking &&
		!createMutation.isPending;

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				if (!v) handleClose();
			}}
		>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Create New Lead</DialogTitle>
					<DialogDescription>
						Add a new lead and assign it to an agent.
					</DialogDescription>
				</DialogHeader>
				<div className="grid grid-cols-2 gap-4 py-2">
					<div className="space-y-1.5">
						<Label htmlFor="create-name">Name *</Label>
						<Input
							id="create-name"
							value={form.name}
							onChange={f("name")}
							placeholder="Full name"
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="create-phone">Phone *</Label>
						<div className="relative">
							<Input
								id="create-phone"
								value={form.phone}
								onChange={f("phone")}
								placeholder="+60 12-345 6789"
								className={
									dupeCheck?.phoneTaken
										? "border-destructive pr-8 focus-visible:ring-destructive"
										: ""
								}
							/>
							{dupeChecking && isValidPhone && (
								<RiLoader4Line className="absolute top-2.5 right-2.5 size-4 animate-spin text-muted-foreground" />
							)}
						</div>
						{dupeCheck?.phoneTaken && (
							<DupeError name={dupeCheck.phoneConflictName} />
						)}
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="create-email">Email</Label>
						<div className="relative">
							<Input
								id="create-email"
								value={form.email}
								onChange={f("email")}
								placeholder="email@example.com"
								className={
									dupeCheck?.emailTaken
										? "border-destructive pr-8 focus-visible:ring-destructive"
										: ""
								}
							/>
							{dupeChecking && isValidEmail && debouncedEmail.length > 0 && (
								<RiLoader4Line className="absolute top-2.5 right-2.5 size-4 animate-spin text-muted-foreground" />
							)}
						</div>
						{dupeCheck?.emailTaken && (
							<DupeError name={dupeCheck.emailConflictName} />
						)}
					</div>
					<div className="space-y-1.5">
						<Label>Source *</Label>
						<Select
							value={form.source || undefined}
							onValueChange={(v) => setForm((p) => ({ ...p, source: v }))}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select source" />
							</SelectTrigger>
							<SelectContent>
								{LEAD_SOURCE_OPTIONS.map((o) => (
									<SelectItem key={o.value} value={o.value}>
										{o.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-1.5">
						<Label>Lead Type</Label>
						<Select
							value={form.leadType}
							onValueChange={(v) =>
								setForm((p) => ({
									...p,
									leadType: v as "personal" | "company",
								}))
							}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{LEAD_TYPE_OPTIONS.map((o) => (
									<SelectItem key={o.value} value={o.value}>
										{o.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-1.5">
						<Label>Status</Label>
						<Select
							value={form.status}
							onValueChange={(v) =>
								setForm((p) => ({
									...p,
									status: v as "active" | "inactive",
								}))
							}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{STATUS_OPTIONS.map((o) => (
									<SelectItem key={o.value} value={o.value}>
										{o.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-1.5">
						<Label>Pipeline Stage</Label>
						<Select
							value={form.stage}
							onValueChange={(v) => setForm((p) => ({ ...p, stage: v }))}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{PIPELINE_STAGES.map((s) => (
									<SelectItem key={s.value} value={s.value}>
										{s.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-1.5">
						<Label>Assign to Agent *</Label>
						<Select
							value={form.agentId || undefined}
							onValueChange={(v) => setForm((p) => ({ ...p, agentId: v }))}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select agent" />
							</SelectTrigger>
							<SelectContent>
								{agents.map((a) => (
									<SelectItem key={a.agentId} value={a.agentId}>
										{a.agentName ?? a.agentEmail}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="col-span-2 space-y-1.5">
						<Label>Categories</Label>
						<p className="text-muted-foreground text-xs">
							Optional — group this lead with others under the same category.
						</p>
						<TagSelector value={tagIds} onChange={setTagIds} />
					</div>
				</div>

				{(dupeCheck?.emailTaken || dupeCheck?.phoneTaken) && (
					<div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-destructive text-sm">
						<RiErrorWarningLine className="mt-0.5 size-4 shrink-0" />
						<span>
							{dupeCheck?.emailTaken
								? "This lead cannot be saved because the email already exists."
								: "This phone number already exists. Saving is still allowed."}
						</span>
					</div>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={handleClose}>
						Cancel
					</Button>
					<Button
						disabled={!canSubmit}
						onClick={() =>
							createMutation.mutate({
								name: form.name.trim(),
								email: form.email.trim(),
								phone: form.phone.trim(),
								source: form.source,
								type: DEFAULT_TYPE,
								property: DEFAULT_PROPERTY,
								status: form.status,
								stage: form.stage as PipelineStageValue,
								leadType: form.leadType,
								agentId: form.agentId,
								tagIds: tagIds.length > 0 ? tagIds : undefined,
							})
						}
					>
						{createMutation.isPending ? (
							<RiLoader4Line className="mr-1 size-4 animate-spin" />
						) : (
							<RiAddLine size={16} className="mr-1" />
						)}
						Create Lead
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
