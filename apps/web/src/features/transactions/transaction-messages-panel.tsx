"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/utils/trpc";
import { format } from "date-fns";
import { Loader2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface TransactionMessagesPanelProps {
	transactionId: string;
	isAdmin?: boolean;
	/** When false, agent can only post edit_request / remark */
	locked?: boolean;
}

export function TransactionMessagesPanel({
	transactionId,
	isAdmin = false,
	locked = false,
}: TransactionMessagesPanelProps) {
	const [body, setBody] = useState("");
	const [messageType, setMessageType] = useState<
		"remark" | "edit_request" | "status_note" | "admin_reply"
	>(locked && !isAdmin ? "edit_request" : "remark");

	const utils = trpc.useUtils();
	const { data: messages = [], isLoading } =
		trpc.transactions.listMessages.useQuery({ id: transactionId });

	const addMessage = trpc.transactions.addMessage.useMutation({
		onSuccess: async () => {
			setBody("");
			await utils.transactions.listMessages.invalidate({ id: transactionId });
			toast.success("Message sent");
		},
		onError: (e) => toast.error(e.message || "Failed to send message"),
	});

	const handleSend = () => {
		const trimmed = body.trim();
		if (!trimmed) return;
		addMessage.mutate({
			transactionId,
			body: trimmed,
			messageType,
		});
	};

	return (
		<div className="space-y-4">
			{isLoading ? (
				<div className="flex justify-center py-8">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			) : messages.length === 0 ? (
				<p className="text-muted-foreground text-sm">No messages yet.</p>
			) : (
				<ul className="space-y-3">
					{messages.map((m) => (
						<li
							key={m.id}
							className="rounded-lg border bg-muted/20 p-3 text-sm"
						>
							<div className="mb-1 flex flex-wrap items-center gap-2">
								<span className="font-medium">
									{m.authorName ?? m.authorId}
								</span>
								<Badge variant="outline" className="text-xs capitalize">
									{m.authorRole}
								</Badge>
								<Badge variant="secondary" className="text-xs">
									{m.messageType.replace(/_/g, " ")}
								</Badge>
								<span className="text-muted-foreground text-xs">
									{format(new Date(m.createdAt), "dd MMM yyyy HH:mm")}
								</span>
							</div>
							<p className="whitespace-pre-wrap">{m.body}</p>
						</li>
					))}
				</ul>
			)}

			<div className="space-y-2 rounded-lg border p-4">
				{!isAdmin && locked && (
					<p className="text-muted-foreground text-xs">
						This case is locked. Send an edit request to admin.
					</p>
				)}
				{isAdmin && (
					<select
						className="w-full rounded-md border bg-background px-3 py-2 text-sm"
						value={messageType}
						onChange={(e) =>
							setMessageType(
								e.target.value as typeof messageType,
							)
						}
					>
						<option value="remark">Remark</option>
						<option value="admin_reply">Admin reply</option>
						<option value="status_note">Status note</option>
					</select>
				)}
				<Textarea
					placeholder={
						locked && !isAdmin
							? "Describe the changes you need…"
							: "Write a message…"
					}
					value={body}
					onChange={(e) => setBody(e.target.value)}
					rows={3}
				/>
				<div className="flex justify-end">
					<Button
						size="sm"
						onClick={handleSend}
						disabled={!body.trim() || addMessage.isPending}
					>
						{addMessage.isPending ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<>
								<Send className="mr-1 h-4 w-4" />
								Send
							</>
						)}
					</Button>
				</div>
			</div>
		</div>
	);
}
