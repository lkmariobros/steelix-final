"use client";

import { useEffect, useState } from "react";
import type React from "react";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";
import type { Lead } from "./lead-models";
import {
	LEAD_TYPE_OPTIONS,
	PIPELINE_STAGES,
	STATUS_OPTIONS,
	TYPE_OPTIONS,
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
import { RiErrorWarningLine, RiLoader4Line } from "@remixicon/react";

export function EditLeadDialog({
	lead,
	open,
	onClose,
	agents,
	onSuccess,
}: {
	lead: Lead | null;
	open: boolean;
	onClose: () => void;
	agents: Array<{
		agentId: string;
		agentName: string | null;
		agentEmail: string;
	}>;
	onSuccess: () => void;
}) {
	const [form, setForm] = useState({
		name: "",
		email: "",
		phone: "",
		source: "",
		type: "buyer" as "tenant" | "buyer",
		property: "",
		status: "active" as "active" | "inactive" | "pending",
		stage: "new_lead",
		leadType: "personal" as "personal" | "company",
		agentId: "",
	});

	// Debounced values for duplicate check
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

	const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(debouncedEmail);
	const isValidPhone = debouncedPhone.length >= 8;

	// excludeId = this lead's own ID — so its own email/phone don't flag as duplicate
	const { data: dupeCheck, isFetching: dupeChecking } =
		trpc.adminLeads.checkDuplicate.useQuery(
			{
				email: debouncedEmail,
				phone: debouncedPhone,
				excludeId: lead?.id,
			},
			{ enabled: !!lead?.id && isValidEmail && isValidPhone, staleTime: 3000 },
		);

	const hasDuplicate = !!(dupeCheck?.emailTaken || dupeCheck?.phoneTaken);

	const updateMutation = trpc.adminLeads.update.useMutation({
		onSuccess: () => {
			toast.success("Lead updated successfully");
			onSuccess();
			onClose();
		},
		onError: (e) => toast.error(e.message),
	});

	// Pre-populate form only when the dialog opens or a different lead is selected
	useEffect(() => {
		if (open && lead) {
			setForm({
				name: lead.name,
				email: lead.email,
				phone: lead.phone,
				source: lead.source,
				type: lead.type,
				property: lead.property,
				status: lead.status,
				stage: lead.stage,
				leadType: lead.leadType,
				agentId: lead.agentId ?? "__unassigned__",
			});
			// Seed debounced values immediately so the check runs on open
			setDebouncedEmail(lead.email.trim());
			setDebouncedPhone(lead.phone.trim());
		}
	}, [open, lead]);

	if (!lead) return null;

	const f =
		(k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
			setForm((p) => ({ ...p, [k]: e.target.value }));

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Edit Lead</DialogTitle>
					<DialogDescription>
						Update lead information — changes apply immediately.
					</DialogDescription>
				</DialogHeader>
				<div className="grid grid-cols-2 gap-4 py-2">
					<div className="space-y-1.5">
						<Label htmlFor="edit-name">Name</Label>
						<Input id="edit-name" value={form.name} onChange={f("name")} />
					</div>
					{/* Email with duplicate check */}
					<div className="space-y-1.5">
						<Label htmlFor="edit-email">Email</Label>
						<div className="relative">
							<Input
								id="edit-email"
								value={form.email}
								onChange={f("email")}
								className={
									dupeCheck?.emailTaken
										? "border-destructive pr-8 focus-visible:ring-destructive"
										: ""
								}
							/>
							{dupeChecking && isValidEmail && (
								<RiLoader4Line className="absolute top-2.5 right-2.5 size-4 animate-spin text-muted-foreground" />
							)}
						</div>
						{dupeCheck?.emailTaken && (
							<DupeError name={dupeCheck.emailConflictName} />
						)}
					</div>
					{/* Phone with duplicate check */}
					<div className="space-y-1.5">
						<Label htmlFor="edit-phone">Phone</Label>
						<div className="relative">
							<Input
								id="edit-phone"
								value={form.phone}
								onChange={f("phone")}
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
						<Label htmlFor="edit-source">Source</Label>
						<Input
							id="edit-source"
							value={form.source}
							onChange={f("source")}
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="edit-property">Property</Label>
						<Input
							id="edit-property"
							value={form.property}
							onChange={f("property")}
						/>
					</div>
					<div className="space-y-1.5">
						<Label>Type</Label>
						<Select
							value={form.type}
							onValueChange={(v) =>
								setForm((p) => ({ ...p, type: v as "tenant" | "buyer" }))
							}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{TYPE_OPTIONS.map((o) => (
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
									status: v as "active" | "inactive" | "pending",
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
						<Label>Stage</Label>
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
						<Label>Assigned Agent</Label>
						<Select
							value={form.agentId || "__unassigned__"}
							onValueChange={(v) =>
								setForm((p) => ({ ...p, agentId: v }))
							}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__unassigned__">— Unassigned —</SelectItem>
								{agents.map((a) => (
									<SelectItem key={a.agentId} value={a.agentId}>
										{a.agentName ?? a.agentEmail}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				{/* Summary banner when duplicates detected */}
				{hasDuplicate && (
					<div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-destructive text-sm">
						<RiErrorWarningLine className="mt-0.5 size-4 shrink-0" />
						<span>
							Cannot save — the{" "}
							{[
								dupeCheck?.emailTaken && "email",
								dupeCheck?.phoneTaken && "phone number",
							]
								.filter(Boolean)
								.join(" and ")}{" "}
							already belong to another lead.
						</span>
					</div>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={updateMutation.isPending || hasDuplicate || dupeChecking}
						onClick={() =>
							updateMutation.mutate({
								id: lead.id,
								...form,
								agentId:
									form.agentId === "__unassigned__"
										? undefined
										: form.agentId || undefined,
								stage: form.stage as PipelineStageValue,
							})
						}
					>
						{updateMutation.isPending && (
							<RiLoader4Line className="mr-1 size-4 animate-spin" />
						)}
						Save Changes
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

