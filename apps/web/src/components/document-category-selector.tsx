import { Button } from "@/components/ui/button";
import {
	Banknote,
	CreditCard,
	File,
	FileText,
	Handshake,
	Home,
	Receipt,
	ScrollText,
	User,
} from "lucide-react";
import type { DocumentCategory } from "@/hooks/use-document-upload";

interface DocumentCategorySelectorProps {
	onSelect: (category: DocumentCategory) => void;
	selectedCategory?: DocumentCategory;
	/** Primary uses transaction; secondary market uses secondary; legacy for older flows */
	variant?: "legacy" | "transaction" | "secondary";
}

export function DocumentCategorySelector({
	onSelect,
	selectedCategory,
	variant = "legacy",
}: DocumentCategorySelectorProps) {
	const transactionCategories = [
		{
			value: "ic_passport" as DocumentCategory,
			label: "IC / Passport",
			icon: User,
			description: "Purchaser identification",
		},
		{
			value: "sales_form" as DocumentCategory,
			label: "Sales Form",
			icon: FileText,
			description: "Signed booking / SPA form",
		},
		{
			value: "bank_letter" as DocumentCategory,
			label: "Bank Letter",
			icon: Banknote,
			description: "Loan approval or bank letter",
		},
		{
			value: "payment_proof" as DocumentCategory,
			label: "Payment Proof",
			icon: Receipt,
			description: "Booking fee or payment receipt",
		},
		{
			value: "other" as DocumentCategory,
			label: "Others",
			icon: File,
			description: "Additional documents",
		},
	];

	const secondaryCategories = [
		{
			value: "booking_form" as DocumentCategory,
			label: "Booking Form",
			icon: FileText,
			description: "OTP / OTR form",
		},
		{
			value: "receipt" as DocumentCategory,
			label: "Receipt",
			icon: Receipt,
			description: "Booking Fees / SST / Deposit",
		},
		{
			value: "bank_letter" as DocumentCategory,
			label: "Bank Letter",
			icon: Banknote,
			description: "Bank LO if Loan Buy Case",
		},
		{
			value: "co_broke_letter" as DocumentCategory,
			label: "Co-Broke Letter",
			icon: Handshake,
			description: "Co-broke Letter",
		},
		{
			value: "tenancy_agreement" as DocumentCategory,
			label: "Tenancy Agreement",
			icon: Home,
			description: "Tenancy Agreement If Rental Case",
		},
		{
			value: "spa" as DocumentCategory,
			label: "SPA",
			icon: ScrollText,
			description: "Sales & Purchase Agreement",
		},
		{
			value: "other" as DocumentCategory,
			label: "Other",
			icon: File,
			description: "Additional Document",
		},
	];

	const legacyCategories = [
		{
			value: "contract" as DocumentCategory,
			label: "Contracts",
			icon: FileText,
			description: "Purchase agreements, leases",
		},
		{
			value: "identification" as DocumentCategory,
			label: "ID Documents",
			icon: User,
			description: "Driver's license, passport",
		},
		{
			value: "financial" as DocumentCategory,
			label: "Financial",
			icon: CreditCard,
			description: "Bank statements, pre-approval",
		},
		{
			value: "miscellaneous" as DocumentCategory,
			label: "Other",
			icon: File,
			description: "Additional documents",
		},
	];

	const categories =
		variant === "secondary"
			? secondaryCategories
			: variant === "transaction"
				? transactionCategories
				: legacyCategories;

	return (
		<div className="space-y-3">
			<h4 className="font-medium text-sm">Select Document Category</h4>
			<div className="grid grid-cols-2 gap-3 md:grid-cols-3">
				{categories.map(({ value, label, icon: Icon, description }) => (
					<Button
						key={value}
						type="button"
						variant={selectedCategory === value ? "default" : "outline"}
						onClick={() => onSelect(value)}
						className="h-auto flex-col gap-2 p-4"
					>
						<Icon size={20} />
						<div className="text-center">
							<div className="font-medium text-sm">{label}</div>
							<div className="text-muted-foreground text-xs">{description}</div>
						</div>
					</Button>
				))}
			</div>
		</div>
	);
}
