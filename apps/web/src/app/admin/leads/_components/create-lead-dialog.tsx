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
import { RiAddLine, RiErrorWarningLine, RiLoader4Line } from "@remixicon/react";

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
		type: "buyer" as "tenant" | "buyer",
		property: "",
		status: "active" as "active" | "inactive" | "pending",
		stage: "new_lead",
		leadType: "personal" as "personal" | "company",
		agentId: "",
	};

	const [form, setForm] = useState(emptyForm);
	// Debounced values used for the duplicate query (500 ms delay)
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

	const { data: dupeCheck, isFetching: dupeChecking } =
		trpc.adminLeads.checkDuplicate.useQuery(
			{ email: debouncedEmail, phone: debouncedPhone },
			{ enabled: isValidEmail && isValidPhone, staleTime: 3000 },
		);

	const hasDuplicate = !!(dupeCheck?.emailTaken || dupeCheck?.phoneTaken);

	const createMutation = trpc.adminLeads.create.useMutation({
		onSuccess: () => {
			toast.success("Lead created successfully");
			setForm(emptyForm);
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
		setDebouncedEmail("");
		setDebouncedPhone("");
	};

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
						Add a new lead to the system and optionally assign it to an agent.
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
					{/* Email with duplicate check */}
					<div className="space-y-1.5">
						<Label htmlFor="create-email">Email *</Label>
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
						<Label htmlFor="create-source">Source *</Label>
						<Input
							id="create-source"
							value={form.source}
							onChange={f("source")}
							placeholder="e.g. Website, Social Media"
						/>
					</div>
					<div className="col-span-2 space-y-1.5">
						<Label htmlFor="create-property">Property Interest *</Label>
						<Input
							id="create-property"
							value={form.property}
							onChange={f("property")}
							placeholder="Property name or description"
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
						<Label>Assign to Agent</Label>
						<Select
							value={form.agentId || "__unassigned__"}
							onValueChange={(v) => setForm((p) => ({ ...p, agentId: v }))}
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
							This lead cannot be saved — the{" "}
							{[
								dupeCheck?.emailTaken && "email",
								dupeCheck?.phoneTaken && "phone number",
							]
								.filter(Boolean)
								.join(" and ")}{" "}
							already exist in the system.
						</span>
					</div>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={handleClose}>
						Cancel
					</Button>
					<Button
						disabled={
							createMutation.isPending ||
							hasDuplicate ||
							dupeChecking ||
							!form.name ||
							!form.email ||
							!form.phone ||
							!form.source ||
							!form.property
						}
						onClick={() =>
							createMutation.mutate({
								...form,
								agentId:
									form.agentId === "__unassigned__"
										? undefined
										: form.agentId || undefined,
								stage: form.stage as PipelineStageValue,
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

