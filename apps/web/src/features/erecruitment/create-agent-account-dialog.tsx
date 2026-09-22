"use client";

import { useState } from "react";
import { toast } from "sonner";
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
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { trpc } from "@/utils/trpc";
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
	const [role, setRole] = useState<"agent" | "team_lead" | "admin">("agent");
	const [uploadingDoc, setUploadingDoc] = useState<RecruitmentDocKey | null>(
		null,
	);

	const uploadSessionMutation =
		trpc.agents.createOnboardingUploadSession.useMutation();
	const createAgentMutation = trpc.agents.create.useMutation({
		onSuccess: () => {
			toast.success("Agent account created");
			resetForm();
			onOpenChange(false);
			onSuccess?.();
		},
		onError: (e) => toast.error(uploadErrorMessage(e)),
	});

	const resetForm = () => {
		setForm(EMPTY_RECRUITMENT_FORM);
		setDocuments({});
		setAcceptedPolicy(false);
		setAcceptedNda(false);
		setPassword("");
		setBranch("");
		setRole("agent");
		setUploadingDoc(null);
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
		!uploadingDoc;

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
								<div className="space-y-2 lg:col-span-3">
									<Label>Temporary password *</Label>
									<Input
										type="password"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										minLength={8}
									/>
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
