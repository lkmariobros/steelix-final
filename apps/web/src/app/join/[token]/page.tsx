"use client";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { BRAND_LOGO_SRC, BRAND_NAME } from "@/lib/brand";
import { trpc } from "@/utils/trpc";
import { RiLoader4Line } from "@remixicon/react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RecruitmentFormFields } from "@/features/erecruitment/recruitment-form-fields";
import {
	EMPTY_RECRUITMENT_FORM,
	type RecruitmentDocKey,
	type RecruitmentFormState,
	type RecruitmentUploadedDoc,
} from "@/features/erecruitment/types";
import { readFileAsBase64 } from "@/features/erecruitment/utils";

export default function JoinRecruitmentPage() {
	const params = useParams<{ token: string }>();
	const token = params.token;

	const [submitted, setSubmitted] = useState(false);
	const [acceptedPolicy, setAcceptedPolicy] = useState(false);
	const [acceptedNda, setAcceptedNda] = useState(false);
	const [documents, setDocuments] = useState<
		Partial<Record<RecruitmentDocKey, RecruitmentUploadedDoc>>
	>({});
	const [form, setForm] = useState<RecruitmentFormState>(EMPTY_RECRUITMENT_FORM);

	const linkQuery = trpc.erecruitment.getLinkByToken.useQuery(
		{ token },
		{ enabled: !!token },
	);

	useEffect(() => {
		if (!linkQuery.data) return;
		setForm((prev) => ({
			...prev,
			fullName: prev.fullName || linkQuery.data.inviteeName || "",
			email: prev.email || linkQuery.data.inviteeEmail || "",
		}));
	}, [linkQuery.data]);

	const uploadMutation = trpc.erecruitment.uploadDocument.useMutation();
	const submitMutation = trpc.erecruitment.submitApplication.useMutation({
		onSuccess: () => {
			setSubmitted(true);
			toast.success("Application submitted successfully");
		},
		onError: (e) => toast.error(e.message),
	});

	const setField = (key: keyof RecruitmentFormState, value: string) => {
		setForm((prev) => ({ ...prev, [key]: value }));
	};

	const handleUpload = async (key: RecruitmentDocKey, file: File | null) => {
		if (!file || !token) return;
		try {
			const base64Data = await readFileAsBase64(file);
			const uploaded = await uploadMutation.mutateAsync({
				token,
				category: key,
				fileName: file.name,
				fileType: file.type || "application/octet-stream",
				fileSize: file.size,
				base64Data,
			});
			setDocuments((prev) => ({ ...prev, [key]: uploaded }));
			toast.success(`${file.name} uploaded`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Upload failed");
		}
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!acceptedPolicy || !acceptedNda) {
			toast.error("Please accept company policy and NDA");
			return;
		}
		if (!documents.icFront || !documents.icBack || !documents.registrationFeeReceipt) {
			toast.error("Please upload IC front, IC back, and registration fee receipt");
			return;
		}

		submitMutation.mutate({
			token,
			...form,
			documents,
			acceptedCompanyPolicy: true,
			acceptedNda: true,
		});
	};

	if (linkQuery.isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center p-6">
				<RiLoader4Line className="size-8 animate-spin text-primary" />
			</div>
		);
	}

	if (!linkQuery.data || linkQuery.data.expired) {
		return (
			<div className="flex min-h-screen items-center justify-center p-6">
				<Card className="w-full max-w-md">
					<CardHeader>
						<CardTitle>Link unavailable</CardTitle>
						<CardDescription>
							This recruitment link is invalid, expired, or already used. Please contact your recruiter for a new link.
						</CardDescription>
					</CardHeader>
				</Card>
			</div>
		);
	}

	if (submitted) {
		return (
			<div className="flex min-h-screen items-center justify-center p-6">
				<Card className="w-full max-w-md text-center">
					<CardHeader>
						<CardTitle>Application submitted</CardTitle>
						<CardDescription>
							Thank you. Your application has been sent to admin for review and approval.
						</CardDescription>
					</CardHeader>
				</Card>
			</div>
		);
	}

	const link = linkQuery.data;

	return (
		<div className="min-h-screen bg-muted/30 py-8">
			<div className="mx-auto w-full max-w-3xl space-y-6 px-4">
				<div className="text-center">
					<img
						src={BRAND_LOGO_SRC}
						width={48}
						height={48}
						alt={`${BRAND_NAME} logo`}
						className="mx-auto mb-3 size-12 rounded-full object-cover"
					/>
					<h1 className="font-bold text-2xl">{BRAND_NAME} eRecruitment</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Recruited by <span className="font-medium text-foreground">{link.recruiterName}</span>
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-6">
					<RecruitmentFormFields
						form={form}
						onFieldChange={setField}
						documents={documents}
						onDocumentSelect={(key, file) => void handleUpload(key, file)}
						acceptedPolicy={acceptedPolicy}
						onAcceptedPolicyChange={setAcceptedPolicy}
						acceptedNda={acceptedNda}
						onAcceptedNdaChange={setAcceptedNda}
					/>

					<Button type="submit" className="w-full" disabled={submitMutation.isPending}>
						{submitMutation.isPending ? "Submitting..." : "Submit application"}
					</Button>
				</form>
			</div>
		</div>
	);
}
