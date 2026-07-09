"use client";

import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { formatLeadTypeLabel } from "./lead-constants";
import { getLeadDisplayTags } from "./lead-models";
import { StatusBadge } from "./lead-ui";

export type LeadContactInfoCardLead = {
	status: string;
	email?: string | null;
	phone: string;
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
	if (!d) return "—";
	try {
		return new Date(d).toLocaleDateString();
	} catch {
		return "—";
	}
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
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-sm">Contact Info</CardTitle>
			</CardHeader>
			<CardContent className="grid grid-cols-2 gap-3 text-sm">
				<div>
					<span className="text-muted-foreground">Status</span>
					<div className="mt-0.5">
						<StatusBadge status={lead.status} />
					</div>
				</div>
				<div>
					<span className="text-muted-foreground">Email</span>
					<p className="truncate font-medium">{lead.email || "—"}</p>
				</div>
				<div>
					<span className="text-muted-foreground">Phone</span>
					<p className="font-medium">{lead.phone}</p>
				</div>
				<div>
					<span className="text-muted-foreground">Source</span>
					<p className="font-medium">{lead.source?.trim() || "—"}</p>
				</div>
				<div>
					<span className="text-muted-foreground">Lead Type</span>
					<p className="font-medium">{formatLeadTypeLabel(lead.leadType)}</p>
				</div>
				<div className="col-span-2">
					<span className="text-muted-foreground">Categories</span>
					{displayTags.length > 0 ? (
						<div className="mt-1 flex flex-wrap gap-1.5">
							{displayTags.map((tag) => (
								<Badge key={tag} variant="secondary">
									{tag}
								</Badge>
							))}
						</div>
					) : (
						<p className="font-medium">—</p>
					)}
				</div>
				{showDescription ? (
					<div className="col-span-2">
						<span className="text-muted-foreground">Description</span>
						<p className="mt-0.5 break-words whitespace-pre-line font-medium leading-relaxed">
							{lead.property?.trim() || "—"}
						</p>
					</div>
				) : null}
				{showNotes ? (
					<div className="col-span-2">
						<span className="text-muted-foreground">Notes</span>
						<p className="mt-0.5 break-words whitespace-pre-line font-medium leading-relaxed">
							{lead.notesSummary?.trim() || "—"}
						</p>
					</div>
				) : null}
				<div>
					<span className="text-muted-foreground">Created</span>
					<p className="font-medium">{formatLeadDate(lead.createdAt)}</p>
				</div>
				<div>
					<span className="text-muted-foreground">Assigned Agent</span>
					<p className="font-medium">{lead.agentName ?? "Unassigned"}</p>
				</div>
			</CardContent>
		</Card>
	);
}
