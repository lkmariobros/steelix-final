"use client";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { trpc } from "@/utils/trpc";
import { RiLoader4Line, RiTeamLine } from "@remixicon/react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type DocKey = "icFront" | "icBack" | "registrationFeeReceipt";

type UploadedDoc = {
	fileName: string;
	fileType: string;
	url?: string;
	storagePath?: string;
	dataUrl?: string;
	uploadedAt: string;
};

const COMPANY_POLICY = `Steelix Company Policies

1. All agents must comply with agency regulations and professional conduct standards.
2. Client information must be kept confidential at all times.
3. Commission claims must be supported by valid documentation.
4. Agents must complete mandatory training within the probation period.
5. Misrepresentation of property or commission terms is strictly prohibited.`;

const NDA_TEXT = `Non-Disclosure Agreement (NDA)

By joining Steelix, you agree not to disclose confidential business information, client data, commission structures, internal systems, or proprietary sales materials to any third party without written approval from management. This obligation continues after your association with the agency ends.`;

async function readFileAsBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(new Error("Failed to read file"));
		reader.readAsDataURL(file);
	});
}

export default function JoinRecruitmentPage() {
	const params = useParams<{ token: string }>();
	const token = params.token;

	const [submitted, setSubmitted] = useState(false);
	const [acceptedPolicy, setAcceptedPolicy] = useState(false);
	const [acceptedNda, setAcceptedNda] = useState(false);
	const [documents, setDocuments] = useState<Partial<Record<DocKey, UploadedDoc>>>({});

	const [form, setForm] = useState({
		fullName: "",
		nickName: "",
		nric: "",
		email: "",
		registrationFee: "",
		paymentMethod: "",
		address: "",
		contactNo: "",
		maritalStatus: "",
		emergencyName: "",
		emergencyContactNo: "",
		emergencyRelationship: "",
		bankName: "",
		bankAccountNo: "",
		bankAccountName: "",
		incomeTaxNo: "",
	});

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

	const setField = (key: keyof typeof form, value: string) => {
		setForm((prev) => ({ ...prev, [key]: value }));
	};

	const handleUpload = async (key: DocKey, file: File | null) => {
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
					<div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10">
						<RiTeamLine className="size-6 text-primary" />
					</div>
					<h1 className="font-bold text-2xl">Steelix eRecruitment</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Recruited by <span className="font-medium text-foreground">{link.recruiterName}</span>
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Personal details</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-4 sm:grid-cols-2">
							<Field label="Full name *" value={form.fullName} onChange={(v) => setField("fullName", v)} />
							<Field label="Nick name" value={form.nickName} onChange={(v) => setField("nickName", v)} />
							<Field label="NRIC *" value={form.nric} onChange={(v) => setField("nric", v)} />
							<Field label="Email *" type="email" value={form.email} onChange={(v) => setField("email", v)} />
							<Field label="Registration fee (RM)" value={form.registrationFee} onChange={(v) => setField("registrationFee", v)} />
							<div className="space-y-2">
								<Label>Payment method</Label>
								<Select value={form.paymentMethod} onValueChange={(v) => setField("paymentMethod", v)}>
									<SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
									<SelectContent>
										<SelectItem value="cash">Cash</SelectItem>
										<SelectItem value="bank_transfer">Bank transfer</SelectItem>
										<SelectItem value="fpx">FPX</SelectItem>
										<SelectItem value="credit_card">Credit card</SelectItem>
										<SelectItem value="other">Other</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader><CardTitle>Contact</CardTitle></CardHeader>
						<CardContent className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2 sm:col-span-2">
								<Label>Address</Label>
								<Textarea value={form.address} onChange={(e) => setField("address", e.target.value)} rows={2} />
							</div>
							<Field label="Contact no. *" value={form.contactNo} onChange={(v) => setField("contactNo", v)} />
							<div className="space-y-2">
								<Label>Marital status</Label>
								<Select value={form.maritalStatus} onValueChange={(v) => setField("maritalStatus", v)}>
									<SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
									<SelectContent>
										<SelectItem value="single">Single</SelectItem>
										<SelectItem value="married">Married</SelectItem>
										<SelectItem value="divorced">Divorced</SelectItem>
										<SelectItem value="widowed">Widowed</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader><CardTitle>Emergency contact</CardTitle></CardHeader>
						<CardContent className="grid gap-4 sm:grid-cols-3">
							<Field label="Name" value={form.emergencyName} onChange={(v) => setField("emergencyName", v)} />
							<Field label="Contact no." value={form.emergencyContactNo} onChange={(v) => setField("emergencyContactNo", v)} />
							<Field label="Relationship" value={form.emergencyRelationship} onChange={(v) => setField("emergencyRelationship", v)} />
						</CardContent>
					</Card>

					<Card>
						<CardHeader><CardTitle>Bank info</CardTitle></CardHeader>
						<CardContent className="grid gap-4 sm:grid-cols-2">
							<Field label="Bank name" value={form.bankName} onChange={(v) => setField("bankName", v)} />
							<Field label="Account number" value={form.bankAccountNo} onChange={(v) => setField("bankAccountNo", v)} />
							<Field label="Bank account name" value={form.bankAccountName} onChange={(v) => setField("bankAccountName", v)} />
							<Field label="Income tax no." value={form.incomeTaxNo} onChange={(v) => setField("incomeTaxNo", v)} />
						</CardContent>
					</Card>

					<Card>
						<CardHeader><CardTitle>Uploads</CardTitle></CardHeader>
						<CardContent className="grid gap-4 sm:grid-cols-3">
							<UploadField label="IC front *" uploaded={documents.icFront?.fileName} onFile={(f) => void handleUpload("icFront", f)} />
							<UploadField label="IC back *" uploaded={documents.icBack?.fileName} onFile={(f) => void handleUpload("icBack", f)} />
							<UploadField label="Registration fee receipt *" uploaded={documents.registrationFeeReceipt?.fileName} onFile={(f) => void handleUpload("registrationFeeReceipt", f)} />
						</CardContent>
					</Card>

					<Card>
						<CardHeader><CardTitle>Agreements</CardTitle></CardHeader>
						<CardContent className="space-y-4">
							<div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{COMPANY_POLICY}</div>
							<label className="flex items-start gap-2">
								<Checkbox checked={acceptedPolicy} onCheckedChange={(v) => setAcceptedPolicy(v === true)} />
								<span>I have read and accept the company policies</span>
							</label>
							<div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{NDA_TEXT}</div>
							<label className="flex items-start gap-2">
								<Checkbox checked={acceptedNda} onCheckedChange={(v) => setAcceptedNda(v === true)} />
								<span>I have read and accept the Non-Disclosure Agreement</span>
							</label>
						</CardContent>
					</Card>

					<Button type="submit" className="w-full" disabled={submitMutation.isPending}>
						{submitMutation.isPending ? "Submitting..." : "Submit application"}
					</Button>
				</form>
			</div>
		</div>
	);
}

function Field({
	label,
	value,
	onChange,
	type = "text",
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	type?: string;
}) {
	return (
		<div className="space-y-2">
			<Label>{label}</Label>
			<Input
				type={type}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				required={label.includes("*")}
			/>
		</div>
	);
}

function UploadField({
	label,
	uploaded,
	onFile,
}: {
	label: string;
	uploaded?: string;
	onFile: (file: File | null) => void;
}) {
	return (
		<div className="space-y-2">
			<Label>{label}</Label>
			<Input
				type="file"
				accept="image/*,.pdf"
				onChange={(e) => onFile(e.target.files?.[0] ?? null)}
			/>
			{uploaded ? (
				<p className="text-muted-foreground text-xs">Uploaded: {uploaded}</p>
			) : null}
		</div>
	);
}
