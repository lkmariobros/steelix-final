"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/utils/trpc";
import {
	AGENT_TIER_CONFIG,
	type AgentTier,
	TIER_COLORS,
} from "@/lib/agent-tier-config";
import { TierBadge } from "./tier-badge";
import { normalizeMalaysianPhone, readFileAsBase64 } from "@/features/erecruitment/utils";
import type {
	RecruitmentDocKey,
	RecruitmentUploadedDoc,
} from "@/features/erecruitment/types";
import { RiEditLine, RiExternalLinkLine, RiSaveLine } from "@remixicon/react";

type OnboardingDocuments = Partial<
	Record<RecruitmentDocKey, RecruitmentUploadedDoc>
>;

type AgentProfile = {
	id: string;
	name: string;
	email: string;
	phone?: string | null;
	branch?: string | null;
	nickName?: string | null;
	nric?: string | null;
	registrationFee?: string | null;
	paymentMethod?: string | null;
	address?: string | null;
	maritalStatus?: string | null;
	emergencyName?: string | null;
	emergencyContactNo?: string | null;
	emergencyRelationship?: string | null;
	bankName?: string | null;
	bankAccountNo?: string | null;
	bankAccountName?: string | null;
	incomeTaxNo?: string | null;
	agentCode?: string | null;
	agentTier?: string | null;
	companyCommissionSplit?: number | null;
	createdAt?: string | Date | null;
	onboardingDocuments?: OnboardingDocuments | null;
};

const PAYMENT_LABELS: Record<string, string> = {
	cash: "Cash",
	bank_transfer: "Bank transfer",
	fpx: "FPX",
	credit_card: "Credit card",
	other: "Other",
};

const MARITAL_LABELS: Record<string, string> = {
	single: "Single",
	married: "Married",
	divorced: "Divorced",
	widowed: "Widowed",
};

function displayValue(value?: string | null) {
	return value?.trim() ? value : "—";
}

function openDocument(doc?: RecruitmentUploadedDoc) {
	const target = doc?.url || doc?.dataUrl;
	if (target) {
		window.open(target, "_blank", "noopener,noreferrer");
	}
}

type AgentProfilePanelProps = {
	agent: AgentProfile;
	recruiterName?: string | null;
	onManage?: () => void;
	onUpdated?: () => void;
};

export function AgentProfilePanel({
	agent,
	recruiterName,
	onManage,
	onUpdated,
}: AgentProfilePanelProps) {
	const utils = trpc.useUtils();
	const [isEditing, setIsEditing] = useState(false);
	const [form, setForm] = useState(buildFormState(agent));
	const [documents, setDocuments] = useState<OnboardingDocuments>(
		agent.onboardingDocuments ?? {},
	);

	useEffect(() => {
		setForm(buildFormState(agent));
		setDocuments(agent.onboardingDocuments ?? {});
	}, [agent]);

	const updateMutation = trpc.agents.update.useMutation({
		onSuccess: () => {
			toast.success("Agent profile updated");
			setIsEditing(false);
			void utils.agents.getById.invalidate({ id: agent.id });
			void utils.agents.list.invalidate();
			onUpdated?.();
		},
		onError: (e) => toast.error(e.message || "Failed to update agent"),
	});

	const setField = (key: keyof typeof form, value: string) => {
		setForm((prev) => ({ ...prev, [key]: value }));
	};

	const handleDocumentSelect = async (key: RecruitmentDocKey, file: File | null) => {
		if (!file) return;
		try {
			const base64Data = await readFileAsBase64(file);
			setDocuments((prev) => ({
				...prev,
				[key]: {
					fileName: file.name,
					fileType: file.type || "application/octet-stream",
					dataUrl: base64Data,
					uploadedAt: new Date().toISOString(),
				},
			}));
			toast.success(`${file.name} ready to save`);
		} catch {
			toast.error("Failed to read file");
		}
	};

	const handleSave = () => {
		const phone = normalizeMalaysianPhone(form.contactNo);
		if (form.contactNo.trim() && (!phone || !/^\+60\d{8,11}$/.test(phone))) {
			toast.error("Contact no. must be a valid Malaysian number");
			return;
		}

		const changedDocs = (["icFront", "icBack", "registrationFeeReceipt"] as const)
			.filter((key) => documents[key]?.dataUrl)
			.reduce<OnboardingDocuments>((acc, key) => {
				const doc = documents[key];
				if (doc) acc[key] = doc;
				return acc;
			}, {});

		updateMutation.mutate({
			id: agent.id,
			name: form.fullName.trim(),
			nickName: form.nickName.trim() || undefined,
			nric: form.nric.trim() || undefined,
			email: form.email.trim(),
			phone: phone || undefined,
			address: form.address.trim() || undefined,
			maritalStatus: form.maritalStatus || undefined,
			emergencyName: form.emergencyName.trim() || undefined,
			emergencyContactNo: form.emergencyContactNo.trim() || undefined,
			emergencyRelationship: form.emergencyRelationship.trim() || undefined,
			bankName: form.bankName.trim() || undefined,
			bankAccountNo: form.bankAccountNo.trim() || undefined,
			bankAccountName: form.bankAccountName.trim() || undefined,
			incomeTaxNo: form.incomeTaxNo.trim() || undefined,
			registrationFee: form.registrationFee.trim() || undefined,
			paymentMethod: form.paymentMethod || undefined,
			branch: form.branch.trim() || undefined,
			agentCode: form.agentCode.trim() || undefined,
			agentTier: form.agentTier as AgentTier,
			documents:
				Object.keys(changedDocs).length > 0
					? changedDocs
					: undefined,
		});
	};

	const currentTier = (agent.agentTier || "advisor") as AgentTier;
	const tierColors = TIER_COLORS[currentTier];

	return (
		<div className="space-y-4">
			<Card className={`border-2 ${tierColors.border}`}>
				<CardContent className="pt-5">
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div className="flex items-start gap-4">
							<div
								className={`flex h-14 w-14 items-center justify-center rounded-full ${tierColors.bg}`}
							>
								<span className="text-2xl">{tierColors.icon}</span>
							</div>
							<div>
								<div className="mb-2 flex flex-wrap items-center gap-2">
									<h2 className="font-bold text-xl">{agent.name}</h2>
									<TierBadge tier={currentTier} animated />
								</div>
								<p className="text-muted-foreground text-sm">{agent.email}</p>
							</div>
						</div>
						<div className="flex flex-wrap gap-2">
							{onManage ? (
								<Button onClick={onManage} variant="outline" size="sm">
									Manage Tier
								</Button>
							) : null}
							{isEditing ? (
								<>
									<Button
										variant="outline"
										size="sm"
										onClick={() => {
											setIsEditing(false);
											setForm(buildFormState(agent));
											setDocuments(agent.onboardingDocuments ?? {});
										}}
									>
										Cancel
									</Button>
									<Button
										size="sm"
										disabled={updateMutation.isPending}
										onClick={handleSave}
									>
										<RiSaveLine className="mr-1 size-4" />
										{updateMutation.isPending ? "Saving..." : "Save"}
									</Button>
								</>
							) : (
								<Button size="sm" onClick={() => setIsEditing(true)}>
									<RiEditLine className="mr-1 size-4" />
									Edit profile
								</Button>
							)}
						</div>
					</div>
				</CardContent>
			</Card>

			<div className="grid gap-4 xl:grid-cols-2">
				<Section title="General info">
					<InfoGrid>
						<InfoField
							label="Agent code"
							value={displayValue(agent.agentCode)}
							editValue={form.agentCode}
							isEditing={isEditing}
							onChange={(v) => setField("agentCode", v)}
						/>
						<InfoField label="Recruit by" value={displayValue(recruiterName)} />
						<InfoField
							label="Joined date"
							value={
								agent.createdAt
									? new Date(agent.createdAt).toLocaleDateString()
									: "—"
							}
						/>
						{isEditing ? (
							<div className="space-y-2">
								<Label>Commission tier</Label>
								<Select
									value={form.agentTier}
									onValueChange={(v) => setField("agentTier", v)}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{Object.entries(AGENT_TIER_CONFIG).map(([tier, cfg]) => (
											<SelectItem key={tier} value={tier}>
												{cfg.displayName} ({cfg.commissionSplit}%)
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						) : (
							<InfoField
								label="Commission tier"
								value={`${AGENT_TIER_CONFIG[currentTier].displayName} (${AGENT_TIER_CONFIG[currentTier].commissionSplit}%)`}
							/>
						)}
					</InfoGrid>
				</Section>

				<Section title="Personal details">
					<InfoGrid>
						<InfoField
							label="Full name"
							value={displayValue(agent.name)}
							editValue={form.fullName}
							isEditing={isEditing}
							onChange={(v) => setField("fullName", v)}
						/>
						<InfoField
							label="Nick name"
							value={displayValue(agent.nickName)}
							editValue={form.nickName}
							isEditing={isEditing}
							onChange={(v) => setField("nickName", v)}
						/>
						<InfoField
							label="NRIC"
							value={displayValue(agent.nric)}
							editValue={form.nric}
							isEditing={isEditing}
							onChange={(v) => setField("nric", v)}
						/>
						<InfoField
							label="Email"
							value={displayValue(agent.email)}
							editValue={form.email}
							isEditing={isEditing}
							onChange={(v) => setField("email", v)}
						/>
						<InfoField
							label="Address"
							value={displayValue(agent.address)}
							editValue={form.address}
							isEditing={isEditing}
							onChange={(v) => setField("address", v)}
							multiline
						/>
						<InfoField
							label="Contact number"
							value={displayValue(agent.phone)}
							editValue={form.contactNo}
							isEditing={isEditing}
							onChange={(v) => setField("contactNo", v)}
						/>
						{isEditing ? (
							<div className="space-y-2">
								<Label>Marital status</Label>
								<Select
									value={form.maritalStatus}
									onValueChange={(v) => setField("maritalStatus", v)}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select status" />
									</SelectTrigger>
									<SelectContent>
										{Object.entries(MARITAL_LABELS).map(([value, label]) => (
											<SelectItem key={value} value={value}>
												{label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						) : (
							<InfoField
								label="Marital status"
								value={
									agent.maritalStatus
										? MARITAL_LABELS[agent.maritalStatus] ?? agent.maritalStatus
										: "—"
								}
							/>
						)}
						<InfoField
							label="Registration fee (RM)"
							value={displayValue(agent.registrationFee)}
							editValue={form.registrationFee}
							isEditing={isEditing}
							onChange={(v) => setField("registrationFee", v)}
						/>
						{isEditing ? (
							<div className="space-y-2">
								<Label>Payment method</Label>
								<Select
									value={form.paymentMethod}
									onValueChange={(v) => setField("paymentMethod", v)}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select method" />
									</SelectTrigger>
									<SelectContent>
										{Object.entries(PAYMENT_LABELS).map(([value, label]) => (
											<SelectItem key={value} value={value}>
												{label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						) : (
							<InfoField
								label="Payment method"
								value={
									agent.paymentMethod
										? PAYMENT_LABELS[agent.paymentMethod] ?? agent.paymentMethod
										: "—"
								}
							/>
						)}
						<InfoField
							label="Branch"
							value={displayValue(agent.branch)}
							editValue={form.branch}
							isEditing={isEditing}
							onChange={(v) => setField("branch", v)}
						/>
					</InfoGrid>
				</Section>

				<Section title="Emergency contact">
					<InfoGrid columns={3}>
						<InfoField
							label="Name"
							value={displayValue(agent.emergencyName)}
							editValue={form.emergencyName}
							isEditing={isEditing}
							onChange={(v) => setField("emergencyName", v)}
						/>
						<InfoField
							label="Contact"
							value={displayValue(agent.emergencyContactNo)}
							editValue={form.emergencyContactNo}
							isEditing={isEditing}
							onChange={(v) => setField("emergencyContactNo", v)}
						/>
						<InfoField
							label="Relationship"
							value={displayValue(agent.emergencyRelationship)}
							editValue={form.emergencyRelationship}
							isEditing={isEditing}
							onChange={(v) => setField("emergencyRelationship", v)}
						/>
					</InfoGrid>
				</Section>

				<Section title="Bank info">
					<InfoGrid>
						<InfoField
							label="Bank name"
							value={displayValue(agent.bankName)}
							editValue={form.bankName}
							isEditing={isEditing}
							onChange={(v) => setField("bankName", v)}
						/>
						<InfoField
							label="Account number"
							value={displayValue(agent.bankAccountNo)}
							editValue={form.bankAccountNo}
							isEditing={isEditing}
							onChange={(v) => setField("bankAccountNo", v)}
						/>
						<InfoField
							label="Bank account name"
							value={displayValue(agent.bankAccountName)}
							editValue={form.bankAccountName}
							isEditing={isEditing}
							onChange={(v) => setField("bankAccountName", v)}
						/>
						<InfoField
							label="Income tax no."
							value={displayValue(agent.incomeTaxNo)}
							editValue={form.incomeTaxNo}
							isEditing={isEditing}
							onChange={(v) => setField("incomeTaxNo", v)}
						/>
					</InfoGrid>
				</Section>

				<Section title="Documents" className="xl:col-span-2">
					<div className="grid gap-4 sm:grid-cols-3">
						<DocumentItem
							label="IC front"
							doc={documents.icFront}
							isEditing={isEditing}
							onFile={(file) => void handleDocumentSelect("icFront", file)}
						/>
						<DocumentItem
							label="IC back"
							doc={documents.icBack}
							isEditing={isEditing}
							onFile={(file) => void handleDocumentSelect("icBack", file)}
						/>
						<DocumentItem
							label="Registration payslip"
							doc={documents.registrationFeeReceipt}
							isEditing={isEditing}
							onFile={(file) =>
								void handleDocumentSelect("registrationFeeReceipt", file)
							}
						/>
					</div>
				</Section>
			</div>
		</div>
	);
}

function buildFormState(agent: AgentProfile) {
	return {
		fullName: agent.name ?? "",
		nickName: agent.nickName ?? "",
		nric: agent.nric ?? "",
		email: agent.email ?? "",
		address: agent.address ?? "",
		contactNo: agent.phone ?? "",
		maritalStatus: agent.maritalStatus ?? "",
		emergencyName: agent.emergencyName ?? "",
		emergencyContactNo: agent.emergencyContactNo ?? "",
		emergencyRelationship: agent.emergencyRelationship ?? "",
		bankName: agent.bankName ?? "",
		bankAccountNo: agent.bankAccountNo ?? "",
		bankAccountName: agent.bankAccountName ?? "",
		incomeTaxNo: agent.incomeTaxNo ?? "",
		registrationFee: agent.registrationFee ?? "",
		paymentMethod: agent.paymentMethod ?? "",
		branch: agent.branch ?? "",
		agentCode: agent.agentCode ?? "",
		agentTier: agent.agentTier ?? "advisor",
	};
}

function Section({
	title,
	children,
	className,
}: {
	title: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<Card className={className}>
			<CardHeader className="px-4 py-3">
				<CardTitle className="text-base">{title}</CardTitle>
			</CardHeader>
			<CardContent className="px-4 pb-4">{children}</CardContent>
		</Card>
	);
}

function InfoGrid({
	children,
	columns = 2,
}: {
	children: React.ReactNode;
	columns?: 2 | 3;
}) {
	return (
		<div
			className={
				columns === 3
					? "grid gap-4 sm:grid-cols-3"
					: "grid gap-4 sm:grid-cols-2"
			}
		>
			{children}
		</div>
	);
}

function InfoField({
	label,
	value,
	editValue,
	isEditing,
	onChange,
	multiline,
}: {
	label: string;
	value: string;
	editValue?: string;
	isEditing?: boolean;
	onChange?: (value: string) => void;
	multiline?: boolean;
}) {
	if (isEditing && onChange) {
		return (
			<div className={`space-y-2 ${multiline ? "sm:col-span-2" : ""}`}>
				<Label>{label}</Label>
				{multiline ? (
					<Textarea
						value={editValue ?? ""}
						onChange={(e) => onChange(e.target.value)}
						rows={2}
					/>
				) : (
					<Input value={editValue ?? ""} onChange={(e) => onChange(e.target.value)} />
				)}
			</div>
		);
	}

	return (
		<div className={`space-y-1 ${multiline ? "sm:col-span-2" : ""}`}>
			<p className="text-muted-foreground text-xs">{label}</p>
			<p className="text-sm">{value}</p>
		</div>
	);
}

function DocumentItem({
	label,
	doc,
	isEditing,
	onFile,
}: {
	label: string;
	doc?: RecruitmentUploadedDoc;
	isEditing: boolean;
	onFile: (file: File | null) => void;
}) {
	const hasFile = !!(doc?.url || doc?.dataUrl || doc?.fileName);

	return (
		<div className="space-y-2 rounded-lg border bg-muted/20 p-3">
			<div className="flex items-center justify-between gap-2">
				<p className="font-medium text-sm">{label}</p>
				{hasFile ? <Badge variant="secondary">Uploaded</Badge> : <Badge variant="outline">Missing</Badge>}
			</div>
			{doc?.fileName ? (
				<p className="truncate text-muted-foreground text-xs">{doc.fileName}</p>
			) : null}
			{hasFile ? (
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="w-full"
					onClick={() => openDocument(doc)}
				>
					<RiExternalLinkLine className="mr-1 size-4" />
					View file
				</Button>
			) : (
				<p className="text-muted-foreground text-xs">No file uploaded</p>
			)}
			{isEditing ? (
				<Input
					type="file"
					accept="image/*,.pdf"
					onChange={(e) => onFile(e.target.files?.[0] ?? null)}
				/>
			) : null}
		</div>
	);
}
