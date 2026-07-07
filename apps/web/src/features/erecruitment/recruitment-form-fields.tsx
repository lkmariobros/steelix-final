"use client";

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
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { COMPANY_POLICY, NDA_TEXT } from "./constants";
import type {
	RecruitmentDocKey,
	RecruitmentFormState,
	RecruitmentUploadedDoc,
} from "./types";

type RecruitmentFormFieldsProps = {
	form: RecruitmentFormState;
	onFieldChange: (key: keyof RecruitmentFormState, value: string) => void;
	documents: Partial<Record<RecruitmentDocKey, RecruitmentUploadedDoc>>;
	onDocumentSelect: (key: RecruitmentDocKey, file: File | null) => void;
	acceptedPolicy: boolean;
	onAcceptedPolicyChange: (value: boolean) => void;
	acceptedNda: boolean;
	onAcceptedNdaChange: (value: boolean) => void;
	layout?: "page" | "modal";
	children?: React.ReactNode;
};

export function RecruitmentFormFields({
	form,
	onFieldChange,
	documents,
	onDocumentSelect,
	acceptedPolicy,
	onAcceptedPolicyChange,
	acceptedNda,
	onAcceptedNdaChange,
	layout = "page",
	children,
}: RecruitmentFormFieldsProps) {
	const isModal = layout === "modal";
	const sectionClass = isModal ? "border-border/80 bg-card/50 shadow-sm" : "";
	const gridClass = isModal
		? "grid gap-4 xl:grid-cols-2"
		: "space-y-6";

	return (
		<div className={gridClass}>
			<Card className={sectionClass}>
				<CardHeader className={isModal ? "px-4 py-3" : undefined}>
					<CardTitle className={isModal ? "text-base" : undefined}>
						Personal details
					</CardTitle>
				</CardHeader>
				<CardContent className={cn("grid gap-4 sm:grid-cols-2", isModal && "px-4 pb-4")}>
					<Field
						label="Full name *"
						value={form.fullName}
						onChange={(v) => onFieldChange("fullName", v)}
					/>
					<Field
						label="Nick name"
						value={form.nickName}
						onChange={(v) => onFieldChange("nickName", v)}
					/>
					<Field
						label="NRIC *"
						value={form.nric}
						onChange={(v) => onFieldChange("nric", v)}
					/>
					<Field
						label="Email *"
						type="email"
						value={form.email}
						onChange={(v) => onFieldChange("email", v)}
					/>
					<Field
						label="Registration fee (RM)"
						value={form.registrationFee}
						onChange={(v) => onFieldChange("registrationFee", v)}
					/>
					<div className="space-y-2">
						<Label>Payment method</Label>
						<Select
							value={form.paymentMethod}
							onValueChange={(v) => onFieldChange("paymentMethod", v)}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select method" />
							</SelectTrigger>
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

			<Card className={sectionClass}>
				<CardHeader className={isModal ? "px-4 py-3" : undefined}>
					<CardTitle className={isModal ? "text-base" : undefined}>Contact</CardTitle>
				</CardHeader>
				<CardContent className={cn("grid gap-4 sm:grid-cols-2", isModal && "px-4 pb-4")}>
					<div className="space-y-2 sm:col-span-2">
						<Label>Address</Label>
						<Textarea
							value={form.address}
							onChange={(e) => onFieldChange("address", e.target.value)}
							rows={2}
						/>
					</div>
					<Field
						label="Contact no. *"
						value={form.contactNo}
						onChange={(v) => onFieldChange("contactNo", v)}
					/>
					<div className="space-y-2">
						<Label>Marital status</Label>
						<Select
							value={form.maritalStatus}
							onValueChange={(v) => onFieldChange("maritalStatus", v)}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select status" />
							</SelectTrigger>
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

			<Card className={sectionClass}>
				<CardHeader className={isModal ? "px-4 py-3" : undefined}>
					<CardTitle className={isModal ? "text-base" : undefined}>
						Emergency contact
					</CardTitle>
				</CardHeader>
				<CardContent
					className={cn(
						"grid gap-4",
						isModal ? "px-4 pb-4 sm:grid-cols-3" : "sm:grid-cols-3",
					)}
				>
					<Field
						label="Name"
						value={form.emergencyName}
						onChange={(v) => onFieldChange("emergencyName", v)}
					/>
					<Field
						label="Contact no."
						value={form.emergencyContactNo}
						onChange={(v) => onFieldChange("emergencyContactNo", v)}
					/>
					<Field
						label="Relationship"
						value={form.emergencyRelationship}
						onChange={(v) => onFieldChange("emergencyRelationship", v)}
					/>
				</CardContent>
			</Card>

			<Card className={sectionClass}>
				<CardHeader className={isModal ? "px-4 py-3" : undefined}>
					<CardTitle className={isModal ? "text-base" : undefined}>Bank info</CardTitle>
				</CardHeader>
				<CardContent className={cn("grid gap-4 sm:grid-cols-2", isModal && "px-4 pb-4")}>
					<Field
						label="Bank name"
						value={form.bankName}
						onChange={(v) => onFieldChange("bankName", v)}
					/>
					<Field
						label="Account number"
						value={form.bankAccountNo}
						onChange={(v) => onFieldChange("bankAccountNo", v)}
					/>
					<Field
						label="Bank account name"
						value={form.bankAccountName}
						onChange={(v) => onFieldChange("bankAccountName", v)}
					/>
					<Field
						label="Income tax no."
						value={form.incomeTaxNo}
						onChange={(v) => onFieldChange("incomeTaxNo", v)}
					/>
				</CardContent>
			</Card>

			<Card className={cn(sectionClass, isModal && "xl:col-span-2")}>
				<CardHeader className={isModal ? "px-4 py-3" : undefined}>
					<CardTitle className={isModal ? "text-base" : undefined}>Uploads</CardTitle>
				</CardHeader>
				<CardContent
					className={cn(
						"grid gap-4 sm:grid-cols-3",
						isModal && "px-4 pb-4",
					)}
				>
					<UploadField
						label="IC front *"
						uploaded={documents.icFront?.fileName}
						onFile={(f) => onDocumentSelect("icFront", f)}
					/>
					<UploadField
						label="IC back *"
						uploaded={documents.icBack?.fileName}
						onFile={(f) => onDocumentSelect("icBack", f)}
					/>
					<UploadField
						label="Registration fee receipt *"
						uploaded={documents.registrationFeeReceipt?.fileName}
						onFile={(f) => onDocumentSelect("registrationFeeReceipt", f)}
					/>
				</CardContent>
			</Card>

			<Card className={cn(sectionClass, isModal && "xl:col-span-2")}>
				<CardHeader className={isModal ? "px-4 py-3" : undefined}>
					<CardTitle className={isModal ? "text-base" : undefined}>Agreements</CardTitle>
				</CardHeader>
				<CardContent
					className={cn(
						"space-y-4",
						isModal && "px-4 pb-4 xl:grid xl:grid-cols-2 xl:gap-6 xl:space-y-0",
					)}
				>
					<div className="space-y-4">
						<div
							className={cn(
								"rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap",
								isModal && "max-h-28 overflow-y-auto",
							)}
						>
							{COMPANY_POLICY}
						</div>
						<label className="flex items-start gap-2">
							<Checkbox
								checked={acceptedPolicy}
								onCheckedChange={(v) => onAcceptedPolicyChange(v === true)}
							/>
							<span className="text-sm">
								I have read and accept the company policies
							</span>
						</label>
					</div>
					<div className="space-y-4">
						<div
							className={cn(
								"rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap",
								isModal && "max-h-28 overflow-y-auto",
							)}
						>
							{NDA_TEXT}
						</div>
						<label className="flex items-start gap-2">
							<Checkbox
								checked={acceptedNda}
								onCheckedChange={(v) => onAcceptedNdaChange(v === true)}
							/>
							<span className="text-sm">
								I have read and accept the Non-Disclosure Agreement
							</span>
						</label>
					</div>
				</CardContent>
			</Card>

			{children ? (
				<div className={cn(isModal && "xl:col-span-2")}>{children}</div>
			) : null}
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
