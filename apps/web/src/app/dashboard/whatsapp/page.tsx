"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { HeaderActions } from "@/components/header-actions";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/sidebar";
import { Badge } from "@/components/ui/badge";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingScreen } from "@/components/ui/loading-spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import {
	RiAttachmentLine,
	RiCheckDoubleLine,
	RiDashboardLine,
	RiInformationLine,
	RiLoader4Line,
	RiMessageLine,
	RiPhoneLine,
	RiSearchLine,
	RiSendPlaneLine,
	RiSettings3Line,
	RiUserLine,
} from "@remixicon/react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// Message interface matching API response
interface Message {
	id: string;
	text: string;
	timestamp: string;
	sender: "user" | "agent";
	read?: boolean;
}

// Conversation interface matching API response
interface Conversation {
	id: string;
	name: string;
	phone: string;
	lastMessage: string;
	unreadCount: number;
	timestamp: string;
	messages?: Message[];
}

// Helper function to format timestamp
const formatTimestamp = (timestamp: string): string => {
	try {
		const date = new Date(timestamp);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));

		if (days === 0) {
			// Today - show time
			return date.toLocaleTimeString("en-US", {
				hour: "2-digit",
				minute: "2-digit",
			});
		}
		if (days === 1) {
			return "Yesterday";
		}
		if (days < 7) {
			return date.toLocaleDateString("en-US", { weekday: "short" });
		}
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});
	} catch {
		return timestamp;
	}
};

export default function WhatsAppPage() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { data: session, isPending: isSessionPending } =
		authClient.useSession();
	const [searchQuery, setSearchQuery] = useState("");
	const [filter, setFilter] = useState<"all" | "unread">("all");
	const [selectedConversationId, setSelectedConversationId] = useState<
		string | null
	>(null);
	const [messageInput, setMessageInput] = useState("");

	// Fetch conversations with tRPC
	const {
		data: conversationsData,
		isLoading: isLoadingConversations,
		error: conversationsError,
		refetch: refetchConversations,
	} = trpc.whatsapp.list.useQuery(
		{
			search: searchQuery || undefined,
			filter,
			page: 1,
			limit: 50,
		},
		{
			enabled: !!session,
			retry: 1,
			staleTime: 2000, // 2 seconds - refresh more frequently for real-time feel
			refetchInterval: 5000, // Auto-refresh every 5 seconds to catch new messages quickly
			refetchOnWindowFocus: true, // Refetch when user returns to the tab
		},
	);

	const conversations = conversationsData?.conversations || [];
	const totalConversations = conversations.length;
	const unreadCount = conversations.reduce(
		(sum, conv) => sum + conv.unreadCount,
		0,
	);

	// Fetch selected conversation details
	const {
		data: conversationData,
		isLoading: isLoadingConversation,
		refetch: refetchConversation,
	} = trpc.whatsapp.get.useQuery(
		{ id: selectedConversationId ?? "" },
		{
			enabled: !!selectedConversationId && !!session,
			retry: 1,
			staleTime: 3000, // 3 seconds - very fresh for active conversation
			refetchInterval: 8000, // Auto-refresh every 8 seconds when conversation is open
		},
	);

	const selectedConversation = conversationData || null;
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Auto-scroll to bottom when new messages arrive
	useEffect(() => {
		if (messagesEndRef.current && selectedConversation?.messages) {
			messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, [selectedConversation?.messages]);

	// Send message mutation
	const sendMessageMutation = trpc.whatsapp.send.useMutation({
		onMutate: async (newMessage) => {
			// Cancel any outgoing refetches to avoid overwriting optimistic update
			await queryClient.cancelQueries({
				queryKey: [["whatsapp", "get", { id: newMessage.conversationId }]],
			});

			// Snapshot the previous value
			const previousConversation = queryClient.getQueryData([
				["whatsapp", "get", { id: newMessage.conversationId }],
			]);

			// Optimistically update the conversation with the new message
			queryClient.setQueryData(
				[["whatsapp", "get", { id: newMessage.conversationId }]],
				(old: { messages?: unknown[] } | undefined) => {
					if (!old) return old;
					const optimisticMessage = {
						id: `temp-${Date.now()}`,
						text: newMessage.message,
						timestamp: new Date().toISOString(),
						sender: "agent" as const,
						read: false,
					};
					return {
						...old,
						messages: [...(old.messages || []), optimisticMessage],
					};
				},
			);

			return { previousConversation };
		},
		onSuccess: (data) => {
			toast.success("Message sent successfully!");
			setMessageInput("");
			// Invalidate and refetch to get the real message from server
			queryClient.invalidateQueries({ queryKey: [["whatsapp", "list"]] });
			queryClient.invalidateQueries({ queryKey: [["whatsapp", "get"]] });
			refetchConversations();
			refetchConversation();
		},
		onError: (error, variables, context) => {
			// Rollback optimistic update on error
			if (context?.previousConversation) {
				queryClient.setQueryData(
					[["whatsapp", "get", { id: variables.conversationId }]],
					context.previousConversation,
				);
			}
			console.error("Error sending message:", error);
			toast.error(error.message || "Failed to send message. Please try again.");
		},
	});

	// Auto-select first conversation if none selected
	useEffect(() => {
		if (!selectedConversationId && conversations.length > 0) {
			setSelectedConversationId(conversations[0].id);
		}
	}, [conversations, selectedConversationId]);

	const handleSendMessage = () => {
		if (!messageInput.trim() || !selectedConversationId) return;
		sendMessageMutation.mutate({
			conversationId: selectedConversationId,
			message: messageInput.trim(),
		});
	};

	const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	};

	// Scroll to bottom when new messages arrive or after sending
	useEffect(() => {
		if (messagesEndRef.current && selectedConversation?.messages) {
			setTimeout(() => {
				messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
			}, 100);
		}
	}, [selectedConversation?.messages]);

	const handleSelectConversation = (conversationId: string) => {
		setSelectedConversationId(conversationId);
	};

	// Authentication check
	if (isSessionPending) {
		return <LoadingScreen text="Loading..." />;
	}

	if (!session) {
		router.push("/login");
		return null;
	}

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset className="flex h-screen flex-col overflow-hidden">
				{/* Header */}
				<header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 md:px-6 lg:px-8">
					<div className="flex flex-1 items-center gap-2 px-3">
						<SidebarTrigger className="-ms-4" />
						<Separator
							orientation="vertical"
							className="mr-2 data-[orientation=vertical]:h-4"
						/>
						<Breadcrumb>
							<BreadcrumbList>
								<BreadcrumbItem className="hidden md:block">
									<BreadcrumbLink href="/dashboard">
										<RiDashboardLine size={22} aria-hidden="true" />
										<span className="sr-only">Dashboard</span>
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator className="hidden md:block" />
								<BreadcrumbItem>
									<BreadcrumbPage className="flex items-center gap-2">
										<RiMessageLine size={18} />
										WhatsApp
									</BreadcrumbPage>
								</BreadcrumbItem>
							</BreadcrumbList>
						</Breadcrumb>
					</div>
					<div className="ml-auto flex gap-3">
						<HeaderActions />
					</div>
				</header>

				{/* Main Content - Two Pane Layout */}
				<div className="flex flex-1 overflow-hidden">
					{/* Left Pane - Chat List */}
					<div className="flex w-full flex-col border-r md:w-80 lg:w-96">
						{/* Top Bar */}
						<div className="flex items-center justify-between border-b p-4">
							<h2 className="font-semibold text-lg">WhatsApp Inbox</h2>
							<div className="flex items-center gap-2">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => {
										refetchConversations();
										toast.success("Refreshing conversations...");
									}}
									disabled={isLoadingConversations}
									title="Refresh conversations"
								>
									<RiLoader4Line
										className={`h-4 w-4 ${isLoadingConversations ? "animate-spin" : ""}`}
									/>
								</Button>
								<Button variant="ghost" size="sm">
									<RiSettings3Line className="h-4 w-4" />
								</Button>
							</div>
						</div>

						{/* Search Bar */}
						<div className="border-b p-3">
							<div className="relative">
								<RiSearchLine className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
								<Input
									placeholder="Search"
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="pl-9"
								/>
							</div>
						</div>

						{/* Filters */}
						<div className="flex gap-2 border-b p-3">
							<Button
								variant={filter === "all" ? "default" : "ghost"}
								size="sm"
								onClick={() => setFilter("all")}
								className="h-8"
							>
								All ({totalConversations})
							</Button>
							<Button
								variant={filter === "unread" ? "default" : "ghost"}
								size="sm"
								onClick={() => setFilter("unread")}
								className="h-8"
							>
								Unread ({unreadCount})
							</Button>
						</div>

						{/* Conversation List */}
						<ScrollArea className="flex-1">
							<div className="flex flex-col">
								{isLoadingConversations ? (
									<div className="flex flex-col">
										{Array.from({ length: 7 }).map((_, i) => (
											<div
												key={i}
												className="flex items-center gap-3 border-b p-4"
											>
												<Skeleton className="size-10 shrink-0 rounded-full" />
												<div className="flex-1 space-y-2">
													<div className="flex items-center justify-between">
														<Skeleton className="h-4 w-28" />
														<Skeleton className="h-3 w-10" />
													</div>
													<Skeleton className="h-3 w-full" />
												</div>
											</div>
										))}
									</div>
								) : conversationsError ? (
									<div className="px-4 py-12 text-center">
										<div className="mb-2 text-red-500">
											Error loading conversations
										</div>
										<div className="mb-4 text-muted-foreground text-sm">
											{conversationsError.message}
										</div>
										<Button
											variant="outline"
											size="sm"
											onClick={() => refetchConversations()}
										>
											Retry
										</Button>
									</div>
								) : conversations.length === 0 ? (
									<div className="px-4 py-12 text-center text-muted-foreground">
										<RiMessageLine className="mx-auto mb-2 size-8" />
										<p className="text-sm">No conversations yet</p>
										<p className="mt-1 text-xs">
											Messages will appear here when received
										</p>
									</div>
								) : (
									conversations.map((conversation) => (
										<button
											type="button"
											key={conversation.id}
											onClick={() => handleSelectConversation(conversation.id)}
											className={`flex items-center gap-3 border-b p-4 text-left transition-colors hover:bg-muted/50 ${
												selectedConversationId === conversation.id
													? "bg-muted"
													: ""
											}`}
										>
											<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
												<RiUserLine className="size-5 text-primary" />
											</div>
											<div className="min-w-0 flex-1">
												<div className="flex items-center justify-between">
													<span className="truncate font-medium">
														{conversation.name}
													</span>
													<span className="shrink-0 text-muted-foreground text-xs">
														{formatTimestamp(conversation.timestamp)}
													</span>
												</div>
												<div className="flex items-center justify-between gap-2">
													<span className="truncate text-muted-foreground text-sm">
														{conversation.lastMessage}
													</span>
													{conversation.unreadCount > 0 && (
														<Badge
															variant="destructive"
															className="size-5 shrink-0 items-center justify-center rounded-full p-0 text-xs"
														>
															{conversation.unreadCount}
														</Badge>
													)}
												</div>
											</div>
										</button>
									))
								)}
							</div>
						</ScrollArea>
					</div>

					{/* Right Pane - Conversation View */}
					<div className="flex flex-1 flex-col">
						{isLoadingConversation ? (
							<div className="flex flex-1 flex-col">
								{/* Header skeleton */}
								<div className="flex items-center justify-between border-b p-4">
									<div className="flex items-center gap-3">
										<Skeleton className="size-10 rounded-full" />
										<div className="space-y-1.5">
											<Skeleton className="h-4 w-32" />
											<Skeleton className="h-3 w-24" />
										</div>
									</div>
								</div>
								{/* Messages skeleton */}
								<div className="flex flex-1 flex-col gap-4 p-4">
									{[false, true, false, true, false].map((isRight, i) => (
										<div
											key={i}
											className={`flex ${isRight ? "justify-end" : "justify-start"}`}
										>
											<Skeleton
												className={`h-10 rounded-lg ${isRight ? "w-1/2" : "w-2/3"}`}
											/>
										</div>
									))}
								</div>
								{/* Input skeleton */}
								<div className="border-t p-4">
									<Skeleton className="h-10 w-full rounded-md" />
								</div>
							</div>
						) : selectedConversation ? (
							<>
								{/* Conversation Header */}
								<div className="flex items-center justify-between border-b p-4">
									<div className="flex items-center gap-3">
										<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
											<RiUserLine className="size-5 text-primary" />
										</div>
										<div>
											<div className="font-medium">
												{selectedConversation.name}
											</div>
											<div className="text-muted-foreground text-sm">
												{selectedConversation.phone}
											</div>
										</div>
									</div>
									<div className="flex items-center gap-2">
										<Button variant="ghost" size="sm">
											<RiInformationLine className="h-4 w-4" />
										</Button>
									</div>
								</div>

								{/* Messages Area */}
								<ScrollArea className="flex-1 p-4">
									<div className="flex flex-col gap-4">
										{selectedConversation.messages &&
										selectedConversation.messages.length > 0 ? (
											<>
												{selectedConversation.messages.map((message) => (
													<div
														key={message.id}
														className={`flex ${
															message.sender === "agent"
																? "justify-end"
																: "justify-start"
														}`}
													>
														<div
															className={`max-w-[70%] rounded-lg px-4 py-2 ${
																message.sender === "agent"
																	? "bg-primary text-primary-foreground"
																	: "bg-muted"
															}`}
														>
															<div className="text-sm">{message.text}</div>
															<div
																className={`mt-1 flex items-center gap-1 text-xs ${
																	message.sender === "agent"
																		? "text-primary-foreground/70"
																		: "text-muted-foreground"
																}`}
															>
																<span>
																	{formatTimestamp(message.timestamp)}
																</span>
																{message.sender === "agent" && (
																	<>
																		{message.read ? (
																			<RiCheckDoubleLine className="size-3 text-blue-400" />
																		) : (
																			<RiCheckDoubleLine className="size-3" />
																		)}
																		{message.read && (
																			<span className="text-[10px]">Read</span>
																		)}
																	</>
																)}
															</div>
														</div>
													</div>
												))}
												<div ref={messagesEndRef} />
											</>
										) : (
											<div className="py-12 text-center text-muted-foreground">
												<RiMessageLine className="mx-auto mb-2 size-8" />
												<p className="text-sm">No messages yet</p>
												<p className="mt-1 text-xs">Start the conversation</p>
											</div>
										)}
									</div>
								</ScrollArea>

								{/* Message Input */}
								<div className="border-t p-4">
									<div className="flex items-center gap-2">
										<Button variant="ghost" size="sm" disabled>
											<RiAttachmentLine className="h-4 w-4" />
										</Button>
										<Input
											placeholder="Type a message..."
											value={messageInput}
											onChange={(e) => setMessageInput(e.target.value)}
											onKeyPress={handleKeyPress}
											disabled={sendMessageMutation.isPending}
											className="flex-1"
										/>
										<Button
											size="sm"
											onClick={handleSendMessage}
											disabled={
												!messageInput.trim() || sendMessageMutation.isPending
											}
											className="bg-green-600 hover:bg-green-700"
										>
											{sendMessageMutation.isPending ? (
												<RiLoader4Line className="h-4 w-4 animate-spin" />
											) : (
												<RiSendPlaneLine className="h-4 w-4" />
											)}
										</Button>
									</div>
								</div>
							</>
						) : (
							<div className="flex flex-1 items-center justify-center">
								<div className="text-center">
									<RiMessageLine className="mx-auto mb-4 size-12 text-muted-foreground" />
									<p className="text-muted-foreground">
										Select a conversation to start messaging
									</p>
								</div>
							</div>
						)}
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
