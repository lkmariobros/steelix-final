"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageListSkeleton } from "@/components/loading-skeletons";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	TRANSACTION_REQUEST_ITEMS,
	type TransactionRequestItemValue,
} from "@/features/transactions/request-items";
import { trpc } from "@/utils/trpc";
import { format } from "date-fns";
import { FileText, Loader2, Paperclip, Send, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

interface TransactionMessagesPanelProps {
	transactionId: string;
	isAdmin?: boolean;
	/** When false, agent can only post edit_request / remark */
	locked?: boolean;
}

type PendingAttachment = {
	key: string;
	file: File;
};

const fileToBase64 = (file: File): Promise<string> =>
	new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.readAsDataURL(file);
		reader.onload = () => {
			const result = reader.result as string;
			resolve(result.split(",")[1] ?? "");
		};
		reader.onerror = (error) => reject(error);
	});

function guessMime(name: string): string {
	const ext = name.split(".").pop()?.toLowerCase();
	switch (ext) {
		case "pdf":
			return "application/pdf";
		case "jpg":
		case "jpeg":
			return "image/jpeg";
		case "png":
			return "image/png";
		case "doc":
			return "application/msword";
		case "docx":
			return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
		case "txt":
			return "text/plain";
		default:
			return "";
	}
}

export function TransactionMessagesPanel({
	transactionId,
	isAdmin = false,
	locked = false,
}: TransactionMessagesPanelProps) {
	const [body, setBody] = useState("");
	const [requestItem, setRequestItem] = useState<
		TransactionRequestItemValue | ""
	>("");
	const [messageType, setMessageType] = useState<
		"remark" | "edit_request" | "status_note" | "admin_reply"
	>(locked && !isAdmin ? "edit_request" : "remark");
	const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
	const [isUploading, setIsUploading] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const utils = trpc.useUtils();
	const { data: messages = [], isLoading } =
		trpc.transactions.listMessages.useQuery({ id: transactionId });

	const uploadDocument = trpc.documents.upload.useMutation();
	const addMessage = trpc.transactions.addMessage.useMutation({
		onSuccess: async () => {
			setBody("");
			setRequestItem("");
			setPendingFiles([]);
			await utils.transactions.listMessages.invalidate({ id: transactionId });
			await utils.transactions.getById.invalidate({ id: transactionId });
			await utils.documents.list.invalidate({ transactionId });
			toast.success(
				messageType === "edit_request"
					? "Edit request submitted"
					: "Message sent",
			);
		},
		onError: (e) => toast.error(e.message || "Failed to send message"),
	});

	const showRequestItemPicker =
		!isAdmin && locked && messageType === "edit_request";
	const showUploadField = showRequestItemPicker;
	const requiresAttachment = requestItem === "add_document";

	const handleFilesSelected = (fileList: FileList | null) => {
		if (!fileList?.length) return;
		const next: PendingAttachment[] = [];
		for (const file of Array.from(fileList)) {
			if (file.size > 50 * 1024 * 1024) {
				toast.error(`${file.name} exceeds 50MB limit`);
				continue;
			}
			next.push({
				key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
				file,
			});
		}
		setPendingFiles((prev) => [...prev, ...next].slice(0, 10));
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	const handleSend = async () => {
		const trimmed = body.trim();
		if (!trimmed) return;
		if (!isAdmin && messageType === "edit_request" && !requestItem) {
			toast.error("Please select a request item");
			return;
		}
		if (requiresAttachment && pendingFiles.length === 0) {
			toast.error("Please upload at least one document");
			return;
		}

		try {
			setIsUploading(true);
			const attachments: {
				id: string;
				fileName: string;
				fileType: string;
				fileSize?: number;
			}[] = [];

			for (const pending of pendingFiles) {
				const file = pending.file;
				const fileType = file.type || guessMime(file.name);
				if (!fileType) {
					toast.error(`Could not detect type for ${file.name}`);
					return;
				}
				const base64Data = await fileToBase64(file);
				const uploaded = await uploadDocument.mutateAsync({
					transactionId,
					fileName: file.name,
					fileType,
					fileSize: file.size,
					documentCategory: "other",
					base64Data,
					uploadedFrom: "edit-request",
				});
				attachments.push({
					id: uploaded.id,
					fileName: uploaded.fileName,
					fileType: uploaded.fileType,
					fileSize: uploaded.fileSize,
				});
			}

			await addMessage.mutateAsync({
				transactionId,
				body: trimmed,
				messageType,
				requestItem:
					!isAdmin && messageType === "edit_request" && requestItem
						? requestItem
						: undefined,
				attachments: attachments.length > 0 ? attachments : undefined,
			});
		} catch {
			// toast handled by mutations
		} finally {
			setIsUploading(false);
		}
	};

	const isBusy = addMessage.isPending || isUploading || uploadDocument.isPending;

	return (
		<div className="space-y-4">
			{isLoading ? (
				<MessageListSkeleton count={4} />
			) : messages.length === 0 ? (
				<p className="text-muted-foreground text-sm">No messages yet.</p>
			) : (
				<ul className="space-y-3">
					{messages.map((m) => {
						const attachments =
							(
								m as {
									attachments?: {
										id: string;
										fileName: string;
										fileType: string;
									}[] | null;
								}
							).attachments ?? [];
						return (
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
								{attachments.length > 0 ? (
									<ul className="mt-2 space-y-1">
										{attachments.map((file) => (
											<li key={file.id}>
												<a
													href={`/api/trpc/documents.getViewUrl?input=${encodeURIComponent(JSON.stringify({ documentId: file.id }))}`}
													className="inline-flex items-center gap-1.5 text-primary text-xs hover:underline"
													onClick={async (e) => {
														e.preventDefault();
														try {
															const result =
																await utils.documents.getViewUrl.fetch({
																	documentId: file.id,
																});
															if (result?.url) {
																window.open(result.url, "_blank", "noopener");
															} else {
																toast.error("Could not open file");
															}
														} catch {
															toast.error("Could not open file");
														}
													}}
												>
													<FileText className="h-3.5 w-3.5" />
													{file.fileName}
												</a>
											</li>
										))}
									</ul>
								) : null}
							</li>
						);
					})}
				</ul>
			)}

			<div className="space-y-2 rounded-lg border p-4">
				{!isAdmin && locked && (
					<p className="text-muted-foreground text-xs">
						This case is locked. Select a request item and describe the change
						you need. You can also upload supporting documents.
					</p>
				)}
				{isAdmin && (
					<select
						className="w-full rounded-md border bg-background px-3 py-2 text-sm"
						value={messageType}
						onChange={(e) =>
							setMessageType(e.target.value as typeof messageType)
						}
					>
						<option value="remark">Remark</option>
						<option value="admin_reply">Admin reply</option>
						<option value="status_note">Status note</option>
					</select>
				)}
				{showRequestItemPicker ? (
					<div className="space-y-1.5">
						<Label htmlFor="request-item">Request item</Label>
						<Select
							value={requestItem}
							onValueChange={(v) =>
								setRequestItem(v as TransactionRequestItemValue)
							}
						>
							<SelectTrigger id="request-item">
								<SelectValue placeholder="Select request type…" />
							</SelectTrigger>
							<SelectContent>
								{TRANSACTION_REQUEST_ITEMS.map((item) => (
									<SelectItem key={item.value} value={item.value}>
										{item.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				) : null}
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
				{showUploadField ? (
					<div className="space-y-2">
						<Label htmlFor="request-attachment">
							Upload file
							{requiresAttachment ? (
								<span className="text-destructive"> *</span>
							) : (
								<span className="text-muted-foreground font-normal">
									{" "}
									(optional)
								</span>
							)}
						</Label>
						<div className="flex flex-wrap items-center gap-2">
							<Input
								ref={fileInputRef}
								id="request-attachment"
								type="file"
								accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,image/*,application/pdf"
								multiple
								className="max-w-md cursor-pointer"
								disabled={isBusy}
								onChange={(e) => handleFilesSelected(e.target.files)}
							/>
							<span className="text-muted-foreground text-xs">
								PDF, DOC, JPG, PNG — max 50MB each
							</span>
						</div>
						{pendingFiles.length > 0 ? (
							<ul className="space-y-1">
								{pendingFiles.map((item) => (
									<li
										key={item.key}
										className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-1.5 text-sm"
									>
										<span className="inline-flex min-w-0 items-center gap-1.5">
											<Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
											<span className="truncate">{item.file.name}</span>
										</span>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="h-7 w-7 p-0"
											disabled={isBusy}
											onClick={() =>
												setPendingFiles((prev) =>
													prev.filter((f) => f.key !== item.key),
												)
											}
										>
											<X className="h-3.5 w-3.5" />
										</Button>
									</li>
								))}
							</ul>
						) : null}
					</div>
				) : null}
				<div className="flex justify-end">
					<Button
						size="sm"
						onClick={() => void handleSend()}
						disabled={
							!body.trim() ||
							isBusy ||
							(showRequestItemPicker && !requestItem) ||
							(requiresAttachment && pendingFiles.length === 0)
						}
					>
						{isBusy ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<>
								<Send className="mr-1 h-4 w-4" />
								{showRequestItemPicker ? "Submit request" : "Send"}
							</>
						)}
					</Button>
				</div>
			</div>
		</div>
	);
}
