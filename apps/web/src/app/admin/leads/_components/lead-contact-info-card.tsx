"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { formatDateDMY } from "@/lib/date-format";
import { cn } from "@/lib/utils";
import { RiContactsLine } from "@remixicon/react";
import { formatLeadTypeLabel } from "./lead-constants";
import { getLeadDisplayTags } from "./lead-models";
import { StatusBadge } from "./lead-ui";

export type LeadContactInfoCardLead = {
	status: string;
	email?: string | null;
	phone: string;
	whatsappUsername?: string | null;
	source?: string | null;
	leadType: string;
	tagNames?: string[];
	tags?: string | null;
	property?: string | null;
	notesSummary?: string | null;
	createdAt: Date | string;
	agentName?: string | null;
};

function formatLeadDate(d: Date | string | null) {
	return formatDateDMY(d);
}

function InfoField({
	label,
	children,
	className,
}: {
	label: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"rounded-xl border border-border/60 bg-background/80 p-3 dark:bg-background/50",
				className,
			)}
		>
			<p className="font-medium text-[11px] text-foreground/65 uppercase tracking-wide">
				{label}
			</p>
			<div className="mt-1.5 min-w-0 text-sm text-foreground">{children}</div>
		</div>
	);
}

export function LeadContactInfoCard({
	lead,
	showDescription = true,
	showNotes = true,
}: {
	lead: LeadContactInfoCardLead;
	showDescription?: boolean;
	showNotes?: boolean;
}) {
	const displayTags = getLeadDisplayTags({
		tagNames: lead.tagNames ?? [],
		tags: lead.tags ?? null,
	});

	return (
		<Card className="gap-0 overflow-hidden border-border/70 py-0 shadow-sm">
			<CardHeader className="border-border/60 border-b bg-muted/40 px-4 py-3 dark:bg-muted/50">
				<CardTitle className="flex items-center gap-2 font-semibold text-sm">
					<span className="flex size-7 items-center justify-center rounded-lg bg-primary/12 text-primary">
						<RiContactsLine className="size-3.5" />
					</span>
					Contact Info
				</CardTitle>
			</CardHeader>
			<CardContent className="grid grid-cols-2 gap-2.5 p-4">
				<InfoField label="Status">
					<StatusBadge status={lead.status} />
				</InfoField>
				<InfoField label="Email">
					<p className="truncate font-semibold">{lead.email || "—"}</p>
				</InfoField>
				<InfoField label="Phone">
					<p className="font-semibold">{lead.phone?.trim() || "—"}</p>
				</InfoField>
				<InfoField label="WhatsApp Username">
					<p
						className={
							!lead.phone?.trim() && lead.whatsappUsername?.trim()
								? "font-semibold text-primary"
								: "font-semibold"
						}
					>
						{lead.whatsappUsername?.trim()
							? lead.whatsappUsername.trim().startsWith("@")
								? lead.whatsappUsername.trim()
								: `@${lead.whatsappUsername.trim()}`
							: "—"}
					</p>
					{!lead.phone?.trim() && lead.whatsappUsername?.trim() ? (
						<p className="mt-1 text-foreground/60 text-xs">
							Primary contact (no phone on file)
						</p>
					) : null}
				</InfoField>
				<InfoField label="Source">
					<p className="font-semibold">{lead.source?.trim() || "—"}</p>
				</InfoField>
				<InfoField label="Lead Type">
					<p className="font-semibold">{formatLeadTypeLabel(lead.leadType)}</p>
				</InfoField>
				<InfoField label="Categories" className="col-span-2">
					{displayTags.length > 0 ? (
						<div className="flex flex-wrap gap-1.5">
							{displayTags.map((tag) => (
								<Badge
									key={tag}
									variant="secondary"
									className="border border-border/50 bg-muted/80 font-medium"
								>
									{tag}
								</Badge>
							))}
						</div>
					) : (
						<p className="font-semibold">—</p>
					)}
				</InfoField>
				{showDescription ? (
					<InfoField label="Description" className="col-span-2">
						<p className="break-words whitespace-pre-line font-medium leading-relaxed">
							{lead.property?.trim() || "—"}
						</p>
					</InfoField>
				) : null}
				{showNotes ? (
					<InfoField label="Notes" className="col-span-2">
						<p className="break-words whitespace-pre-line font-medium leading-relaxed">
							{lead.notesSummary?.trim() || "—"}
						</p>
					</InfoField>
				) : null}
				<InfoField label="Created">
					<p className="font-semibold">{formatLeadDate(lead.createdAt)}</p>
				</InfoField>
				<InfoField label="Assigned Agent">
					<p className="font-semibold">{lead.agentName ?? "Unassigned"}</p>
				</InfoField>
			</CardContent>
		</Card>
	);
}
