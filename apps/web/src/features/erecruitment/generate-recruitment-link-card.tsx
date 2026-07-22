"use client";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { buildJoinUrl } from "@/lib/public-portal-url";
import { trpc } from "@/utils/trpc";
import { RiClipboardLine, RiLinkM } from "@remixicon/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export interface GenerateRecruitmentLinkCardProps {
	/** When true, show recruiter picker (admin). Agents always use their own account. */
	allowRecruiterSelect?: boolean;
}

export function GenerateRecruitmentLinkCard({
	allowRecruiterSelect = false,
}: GenerateRecruitmentLinkCardProps) {
	const [inviteeName, setInviteeName] = useState("");
	const [inviteeEmail, setInviteeEmail] = useState("");
	const [recruiterId, setRecruiterId] = useState("");
	const [generatedUrl, setGeneratedUrl] = useState("");

	const { data: recruiters } = trpc.agents.list.useQuery(
		{
			limit: 100,
			role: "agent",
			sortBy: "name",
			sortOrder: "asc",
		},
		{ enabled: allowRecruiterSelect },
	);

	const createLinkMutation = trpc.erecruitment.createLink.useMutation({
		onSuccess: (link) => {
			const url = buildJoinUrl(link.token);
			setGeneratedUrl(url);
			toast.success("Recruitment link created");
		},
		onError: (e) => toast.error(e.message),
	});

	const recruiterOptions = useMemo(
		() => recruiters?.agents?.map((a) => a.agent) ?? [],
		[recruiters],
	);

	const copyLink = async () => {
		if (!generatedUrl) return;
		await navigator.clipboard.writeText(generatedUrl);
		toast.success("Link copied to clipboard");
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<RiLinkM className="size-5" />
					Generate recruitment link
				</CardTitle>
				<CardDescription>
					Link includes recruiter name. Optionally pre-fill invitee name and
					email.
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4 md:grid-cols-2">
				<div className="space-y-2">
					<Label>Invitee name (optional)</Label>
					<Input
						value={inviteeName}
						onChange={(e) => setInviteeName(e.target.value)}
						placeholder="New joiner full name"
					/>
				</div>
				<div className="space-y-2">
					<Label>Invitee email (optional)</Label>
					<Input
						type="email"
						value={inviteeEmail}
						onChange={(e) => setInviteeEmail(e.target.value)}
						placeholder="newjoiner@email.com"
					/>
				</div>
				<div className="space-y-2 md:col-span-2">
					<Label>Recruiter</Label>
					{allowRecruiterSelect ? (
						<Select
							value={recruiterId || "__self__"}
							onValueChange={(v) =>
								setRecruiterId(v === "__self__" ? "" : v)
							}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select recruiter" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__self__">
									Use my account as recruiter
								</SelectItem>
								{recruiterOptions.map((r) => (
									<SelectItem key={r.id} value={r.id}>
										{r.name} ({r.email})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					) : (
						<Input
							value="Use my account as recruiter"
							readOnly
							className="bg-muted/50"
						/>
					)}
				</div>
				<div className="flex flex-wrap gap-2 md:col-span-2">
					<Button
						onClick={() =>
							createLinkMutation.mutate({
								inviteeName: inviteeName.trim() || undefined,
								inviteeEmail: inviteeEmail.trim() || undefined,
								recruiterId:
									allowRecruiterSelect && recruiterId
										? recruiterId
										: undefined,
							})
						}
						disabled={createLinkMutation.isPending}
					>
						Generate link
					</Button>
					{generatedUrl ? (
						<Button variant="outline" onClick={() => void copyLink()}>
							<RiClipboardLine className="mr-1.5 size-4" />
							Copy link
						</Button>
					) : null}
				</div>
				{generatedUrl ? (
					<p className="break-all rounded-md border bg-muted/40 p-3 font-mono text-sm md:col-span-2">
						{generatedUrl}
					</p>
				) : null}
			</CardContent>
		</Card>
	);
}
