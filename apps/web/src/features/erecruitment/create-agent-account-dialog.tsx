"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { formatAgentPickerLabel } from "@/lib/agent-display";
import { parseDateInputValue, toDateInputValue } from "@/lib/date-format";
import { trpc } from "@/utils/trpc";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { RiSearchLine } from "@remixicon/react";
import { RecruitmentFormFields } from "./recruitment-form-fields";
import { BRANCH_OPTIONS } from "./constants";
import {
	EMPTY_RECRUITMENT_FORM,
	type RecruitmentDocKey,
	type RecruitmentFormState,
	type RecruitmentUploadedDoc,
} from "./types";
import { normalizeMalaysianPhone } from "./utils";

const ONBOARDING_MAX_FILE_BYTES = 10 * 1024 * 1024;

type CreateAgentAccountDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	isSuperAdmin: boolean;
	onSuccess?: () => void;
};

function uploadErrorMessage(error: unknown): string {
	const msg =
		error instanceof Error
			? error.message
			: typeof error === "string"
				? error
				: "Upload failed";
	if (
		/Request Entity Too Large/i.test(msg) ||
		/Unexpected token ['"]?R['"]?/i.test(msg) ||
		(/not valid JSON/i.test(msg) && /Request En/i.test(msg))
	) {
		return "Upload rejected: file too large for the API proxy. Re-select the file to use direct upload.";
	}
	return msg;
}

export function CreateAgentAccountDialog({
	open,
	onOpenChange,
	isSuperAdmin,
	onSuccess,
}: CreateAgentAccountDialogProps) {
	const [form, setForm] = useState<RecruitmentFormState>(EMPTY_RECRUITMENT_FORM);
	const [documents, setDocuments] = useState<
		Partial<Record<RecruitmentDocKey, RecruitmentUploadedDoc>>
	>({});
	const [acceptedPolicy, setAcceptedPolicy] = useState(false);
	const [acceptedNda, setAcceptedNda] = useState(false);
	const [password, setPassword] = useState("");
	const [branch, setBranch] = useState("");
	const [joinedDate, setJoinedDate] = useState(() =>
		toDateInputValue(new Date()),
	);
	const [recruitedById, setRecruitedById] = useState("");
	const [recruiterLabel, setRecruiterLabel] = useState<string | null>(null);
	const [recruiterSearch, setRecruiterSearch] = useState("");
	const [recruiterPickerOpen, setRecruiterPickerOpen] = useState(false);
	const debouncedRecruiterSearch = useDebouncedValue(recruiterSearch, 300);
	const [role, setRole] = useState<"agent" | "team_lead" | "admin">("agent");
	const [uploadingDoc, setUploadingDoc] = useState<RecruitmentDocKey | null>(
		null,
	);
	const [agentCode, setAgentCode] = useState("");
	const [agentCodeTouched, setAgentCodeTouched] = useState(false);
	const [allowSharedEmail, setAllowSharedEmail] = useState(false);

	const nextAgentCodeQuery = trpc.agents.previewNextAgentCode.useQuery(
		undefined,
		{ enabled: open },
	);
	useEffect(() => {
		if (open && !agentCodeTouched && nextAgentCodeQuery.data?.agentCode) {
			setAgentCode(nextAgentCodeQuery.data.agentCode);
		}
	}, [open, agentCodeTouched, nextAgentCodeQuery.data?.agentCode]);

	const debouncedEmail = useDebouncedValue(form.email.trim(), 400);
	const debouncedNric = useDebouncedValue(form.nric.trim(), 400);
	const debouncedAgentCode = useDebouncedValue(agentCode.trim(), 400);
	const conflictCheckEmail = debouncedEmail.includes("@")
		? debouncedEmail
		: undefined;
	const conflictCheckNric =
		debouncedNric.replace(/[^0-9a-z]/gi, "").length >= 6
			? debouncedNric
			: undefined;
	const conflictsQuery = trpc.agents.checkAccountConflicts.useQuery(
		{
			email: conflictCheckEmail,
			nric: conflictCheckNric,
			agentCode: debouncedAgentCode || undefined,
		},
		{
			enabled:
				open &&
				Boolean(conflictCheckEmail || conflictCheckNric || debouncedAgentCode),
		},
	);
	const conflicts = conflictsQuery.data;
	const existingAccounts = conflicts?.matches ?? [];
	const differentPersonAccount = existingAccounts.find((a) => a.differentNric);
	const activeExistingAccounts = existingAccounts.filter((a) => a.isActive);
	const blockedByOneActiveRule = Boolean(
		conflicts?.oneActiveAccountPerAgent && activeExistingAccounts.length > 0,
	);
	const agentCodeTakenBy = conflicts?.agentCodeTakenBy ?? null;
	const needsSharedConfirm = existingAccounts.length > 0;

	useEffect(() => {
		if (!needsSharedConfirm) setAllowSharedEmail(false);
	}, [needsSharedConfirm]);

	const { data: recruiterData, isLoading: recruitersLoading } =
		trpc.agents.list.useQuery(
			{
				limit: 20,
				offset: 0,
				role: "agent",
				isActive: true,
				searchQuery: debouncedRecruiterSearch.trim() || undefined,
				sortBy: "name",
				sortOrder: "asc",
			},
			{ enabled: open && recruiterPickerOpen && !recruitedById },
		);
	const recruiterCandidates = recruiterData?.agents ?? [];

	const utils = trpc.useUtils();
	const uploadSessionMutation =
		trpc.agents.createOnboardingUploadSession.useMutation();
	const createAgentMutation = trpc.agents.create.useMutation({
		onSuccess: (created) => {
			toast.success(
				created?.agentCode
					? `Agent account created (${created.agentCode})`
					: "Agent account created",
			);
			resetForm();
			onOpenChange(false);
			void utils.agents.previewNextAgentCode.invalidate();
			void utils.agents.checkAccountConflicts.invalidate();
			onSuccess?.();
		},
		onError: (e) => {
			toast.error(uploadErrorMessage(e));
			void utils.agents.checkAccountConflicts.invalidate();
		},
	});

	const resetForm = () => {
		setForm(EMPTY_RECRUITMENT_FORM);
		setDocuments({});
		setAcceptedPolicy(false);
		setAcceptedNda(false);
		setPassword("");
		setBranch("");
		setJoinedDate(toDateInputValue(new Date()));
		setRecruitedById("");
		setRecruiterLabel(null);
		setRecruiterSearch("");
		setRecruiterPickerOpen(false);
		setRole("agent");
		setUploadingDoc(null);
		setAgentCode("");
		setAgentCodeTouched(false);
		setAllowSharedEmail(false);
	};

	const setField = (key: keyof RecruitmentFormState, value: string) => {
		setForm((prev) => ({ ...prev, [key]: value }));
	};

	const handleDocumentSelect = async (
		key: RecruitmentDocKey,
		file: File | null,
	) => {
		if (!file) return;
		if (file.size > ONBOARDING_MAX_FILE_BYTES) {
			toast.error("Each file must be under 10MB");
			return;
		}

		const fileType = file.type || "application/octet-stream";
		setUploadingDoc(key);
		try {
			const session = await uploadSessionMutation.mutateAsync({
				category: key,
				fileName: file.name,
				fileType,
				fileSize: file.size,
			});

			const res = await fetch(session.signedUrl, {
				method: "PUT",
				body: file,
				headers: { "Content-Type": fileType },
			});
			if (!res.ok) {
				const detail = await res.text().catch(() => "");
				throw new Error(
					detail
						? `Direct upload failed (${res.status}): ${detail.slice(0, 120)}`
						: `Direct upload failed (${res.status})`,
				);
			}

			setDocuments((prev) => ({
				...prev,
				[key]: {
					fileName: file.name,
					fileType,
					storagePath: session.storagePath,
					uploadedAt: new Date().toISOString(),
				},
			}));
			toast.success(`${file.name} uploaded`);
		} catch (e) {
			toast.error(uploadErrorMessage(e));
		} finally {
			setUploadingDoc(null);
		}
	};

	const canSubmit =
		form.fullName.trim() &&
		form.nric.trim() &&
		form.email.trim() &&
		form.contactNo.trim() &&
		password.length >= 8 &&
		acceptedPolicy &&
		acceptedNda &&
		documents.icFront?.storagePath &&
		documents.icBack?.storagePath &&
		documents.registrationFeeReceipt?.storagePath &&
		!uploadingDoc &&
		!agentCodeTakenBy &&
		!differentPersonAccount &&
		!blockedByOneActiveRule &&
		(!needsSharedConfirm || allowSharedEmail);

	const handleCreate = () => {
		if (!acceptedPolicy || !acceptedNda) {
			toast.error("Please accept company policy and NDA");
			return;
		}
		if (
			!documents.icFront?.storagePath ||
			!documents.icBack?.storagePath ||
			!documents.registrationFeeReceipt?.storagePath
		) {
			toast.error("Please upload IC front, IC back, and registration fee receipt");
			return;
		}

		const phone = normalizeMalaysianPhone(form.contactNo);
		if (!phone || !/^\+60\d{8,11}$/.test(phone)) {
			toast.error("Contact no. must be a valid Malaysian number");
			return;
		}

		createAgentMutation.mutate({
			fullName: form.fullName.trim(),
			nickName: form.nickName.trim() || undefined,
			nric: form.nric.trim(),
			email: form.email.trim(),
			registrationFee: form.registrationFee.trim() || undefined,
			paymentMethod: form.paymentMethod || undefined,
			address: form.address.trim() || undefined,
			contactNo: phone,
			maritalStatus: form.maritalStatus || undefined,
			emergencyName: form.emergencyName.trim() || undefined,
			emergencyContactNo: form.emergencyContactNo.trim() || undefined,
			emergencyRelationship: form.emergencyRelationship.trim() || undefined,
			bankName: form.bankName.trim() || undefined,
			bankAccountNo: form.bankAccountNo.trim() || undefined,
			bankAccountName: form.bankAccountName.trim() || undefined,
			incomeTaxNo: form.incomeTaxNo.trim() || undefined,
			documents: {
				icFront: {
					fileName: documents.icFront.fileName,
					fileType: documents.icFront.fileType,
					storagePath: documents.icFront.storagePath,
					uploadedAt: documents.icFront.uploadedAt,
				},
				icBack: {
					fileName: documents.icBack.fileName,
					fileType: documents.icBack.fileType,
					storagePath: documents.icBack.storagePath,
					uploadedAt: documents.icBack.uploadedAt,
				},
				registrationFeeReceipt: {
					fileName: documents.registrationFeeReceipt.fileName,
					fileType: documents.registrationFeeReceipt.fileType,
					storagePath: documents.registrationFeeReceipt.storagePath,
					uploadedAt: documents.registrationFeeReceipt.uploadedAt,
				},
			},
			acceptedCompanyPolicy: true,
			acceptedNda: true,
			password,
			branch: branch.trim() || undefined,
			joinedDate: parseDateInputValue(joinedDate),
			recruitedBy: recruitedById || undefined,
			agentCode: agentCode.trim().toUpperCase() || undefined,
			allowSharedEmail: needsSharedConfirm ? allowSharedEmail : undefined,
			role: isSuperAdmin ? role : "agent",
		});
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) resetForm();
				onOpenChange(next);
			}}
		>
			<DialogContent className="flex max-h-[96vh] w-[min(96vw,76rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden border-border/80 bg-background p-0 shadow-2xl sm:max-w-6xl">
				<DialogHeader className="shrink-0 border-b bg-muted/20 px-8 py-5">
					<DialogTitle className="text-xl">Create agent account</DialogTitle>
					<DialogDescription>
						Complete the same onboarding form used for eRecruitment. Each
						document uploads directly (max 10MB each).
					</DialogDescription>
				</DialogHeader>

				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-8 py-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
					<RecruitmentFormFields
						layout="modal"
						form={form}
						onFieldChange={setField}
						documents={documents}
						onDocumentSelect={(key, file) => void handleDocumentSelect(key, file)}
						acceptedPolicy={acceptedPolicy}
						onAcceptedPolicyChange={setAcceptedPolicy}
						acceptedNda={acceptedNda}
						onAcceptedNdaChange={setAcceptedNda}
					>
						<Card className="border-border/80 bg-card/50 shadow-sm">
							<CardHeader className="px-4 py-3">
								<CardTitle className="text-base">Account setup</CardTitle>
							</CardHeader>
							<CardContent className="grid gap-4 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-3">
								{needsSharedConfirm ? (
									<div
										className={
											differentPersonAccount || blockedByOneActiveRule
												? "space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm sm:col-span-2 lg:col-span-3"
												: "space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950 text-sm sm:col-span-2 lg:col-span-3 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
										}
									>
										<p className="font-medium">
											This email or NRIC already has an account:
										</p>
										<ul className="list-disc space-y-0.5 pl-5">
											{existingAccounts.map((account) => (
												<li key={account.id}>
													{account.label}
													<span className="text-muted-foreground">
														{" "}
														— {account.isActive ? "Active" : "Inactive"}
														{account.matchedByEmail && account.matchedByNric
															? ", same email & NRIC"
															: account.matchedByEmail
																? ", same email"
																: ", same NRIC"}
													</span>
												</li>
											))}
										</ul>
										{differentPersonAccount ? (
											<p className="font-medium text-destructive">
												This email belongs to {differentPersonAccount.label},
												whose NRIC is different. Please use a different email.
											</p>
										) : blockedByOneActiveRule ? (
											<p className="font-medium text-destructive">
												"One active account per agent" is on. Deactivate the
												existing account first, or turn the rule off in Agent
												Management.
											</p>
										) : (
											<label
												htmlFor="allow-shared-email"
												className="flex cursor-pointer items-start gap-2 pt-1"
											>
												<Checkbox
													id="allow-shared-email"
													checked={allowSharedEmail}
													onCheckedChange={(v) => setAllowSharedEmail(Boolean(v))}
													className="mt-0.5"
												/>
												<span>
													<span className="font-medium">
														Create separate account for this agent
													</span>
													<span className="block text-xs opacity-80">
														Same person, new account. When an email has more than
														one account, the agent signs in with their Agent ID.
													</span>
												</span>
											</label>
										)}
									</div>
								) : null}
								<div className="space-y-2 lg:col-span-2">
									<Label>Temporary password *</Label>
									<Input
										type="password"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										minLength={8}
									/>
								</div>
								<div className="space-y-2">
									<Label>Agent ID</Label>
									<Input
										value={agentCode}
										onChange={(e) => {
											setAgentCodeTouched(true);
											setAgentCode(e.target.value.toUpperCase());
										}}
										placeholder={
											nextAgentCodeQuery.data?.agentCode ?? "DT00001"
										}
										className="font-mono"
										maxLength={32}
										aria-invalid={Boolean(agentCodeTakenBy)}
									/>
									{agentCodeTakenBy ? (
										<p className="text-destructive text-xs">
											Already used by {agentCodeTakenBy}
										</p>
									) : (
										<p className="text-muted-foreground text-xs">
											Next available ID. Type an old ID if needed.
										</p>
									)}
								</div>
								<div className="space-y-2">
									<Label>Branch</Label>
									<Select
										value={branch || undefined}
										onValueChange={setBranch}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select branch" />
										</SelectTrigger>
										<SelectContent>
											{BRANCH_OPTIONS.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label>Joined Date</Label>
									<Input
										type="date"
										value={joinedDate}
										max={toDateInputValue(new Date())}
										onChange={(e) => setJoinedDate(e.target.value)}
									/>
								</div>
								<div className="space-y-2">
									<Label>Recruit By</Label>
									{recruitedById && recruiterLabel ? (
										<div className="flex h-9 items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 text-sm">
											<span className="truncate">{recruiterLabel}</span>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-7 px-2"
												onClick={() => {
													setRecruitedById("");
													setRecruiterLabel(null);
													setRecruiterSearch("");
													setRecruiterPickerOpen(true);
												}}
											>
												Change
											</Button>
										</div>
									) : (
										<div className="relative">
											<RiSearchLine className="-translate-y-1/2 absolute top-1/2 left-2.5 size-4 text-muted-foreground" />
											<Input
												className="pl-8"
												placeholder="Search name, nickname, code…"
												value={recruiterSearch}
												onChange={(e) => {
													setRecruiterSearch(e.target.value);
													setRecruiterPickerOpen(true);
												}}
												onFocus={() => setRecruiterPickerOpen(true)}
												onBlur={() => setRecruiterPickerOpen(false)}
											/>
											{recruiterPickerOpen ? (
												<ul className="absolute z-20 mt-1 max-h-48 w-full space-y-0.5 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
													{recruitersLoading ? (
														<li className="px-2 py-1.5 text-muted-foreground text-sm">
															Loading agents…
														</li>
													) : recruiterCandidates.length === 0 ? (
														<li className="px-2 py-1.5 text-muted-foreground text-sm">
															No agents found
														</li>
													) : (
														recruiterCandidates.map((row) => {
															const label = formatAgentPickerLabel({
																name: row.agent.name,
																nickName: row.agent.nickName,
																agentCode: row.agent.agentCode,
																email: row.agent.email,
															});
															return (
																<li key={row.agent.id}>
																	<button
																		type="button"
																		className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
																		onMouseDown={(e) => e.preventDefault()}
																		onClick={() => {
																			setRecruitedById(row.agent.id);
																			setRecruiterLabel(label);
																			setRecruiterSearch("");
																			setRecruiterPickerOpen(false);
																		}}
																	>
																		{label}
																	</button>
																</li>
															);
														})
													)}
												</ul>
											) : null}
										</div>
									)}
								</div>
								{isSuperAdmin ? (
									<div className="space-y-2">
										<Label>Account role</Label>
										<Select
											value={role}
											onValueChange={(value) =>
												setRole(value as "agent" | "team_lead" | "admin")
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="agent">Agent</SelectItem>
												<SelectItem value="team_lead">Team Lead</SelectItem>
												<SelectItem value="admin">Admin</SelectItem>
											</SelectContent>
										</Select>
									</div>
								) : null}
							</CardContent>
						</Card>
					</RecruitmentFormFields>
				</div>

				<DialogFooter className="shrink-0 border-t bg-muted/20 px-8 py-5">
					{agentCodeTakenBy ||
					differentPersonAccount ||
					blockedByOneActiveRule ||
					(needsSharedConfirm && !allowSharedEmail) ? (
						<p className="mr-auto self-center text-amber-700 text-xs dark:text-amber-300">
							{agentCodeTakenBy
								? "Agent ID is already in use — see Account setup."
								: "Existing account found — see Account setup below."}
						</p>
					) : null}
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						disabled={
							createAgentMutation.isPending ||
							uploadSessionMutation.isPending ||
							!!uploadingDoc ||
							!canSubmit
						}
						onClick={handleCreate}
					>
						{uploadingDoc
							? "Uploading document…"
							: createAgentMutation.isPending
								? "Creating..."
								: "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
