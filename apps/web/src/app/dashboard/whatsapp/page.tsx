"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/sidebar";
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import UserDropdown from "@/components/user-dropdown";
import {
	RiDashboardLine,
	RiSearchLine,
	RiUserLine,
	RiPhoneLine,
	RiInformationLine,
	RiAttachmentLine,
	RiSendPlaneLine,
	RiSettings3Line,
	RiMessageLine,
	RiCheckDoubleLine,
} from "@remixicon/react";

// Mock data types
interface Message {
	id: string;
	text: string;
	timestamp: string;
	sender: "user" | "agent";
	read?: boolean;
}

interface Conversation {
	id: string;
	name: string;
	phone: string;
	lastMessage: string;
	unreadCount: number;
	timestamp: string;
	messages: Message[];
}

// Mock conversations data
const mockConversations: Conversation[] = [
	{
		id: "1",
		name: "John S.",
		phone: "+65 9123 4567",
		lastMessage: "Hi...",
		unreadCount: 2,
		timestamp: "10:30 AM",
		messages: [
			{
				id: "1",
				text: "Hi, I'm interested",
				timestamp: "10:30 AM",
				sender: "user",
			},
			{
				id: "2",
				text: "Thank you!",
				timestamp: "10:32 AM",
				sender: "agent",
				read: true,
			},
			{
				id: "3",
				text: "What's the price?",
				timestamp: "10:35 AM",
				sender: "user",
			},
		],
	},
	{
		id: "2",
		name: "Sarah L.",
		phone: "+65 9876 5432",
		lastMessage: "When...",
		unreadCount: 1,
		timestamp: "09:15 AM",
		messages: [
			{
				id: "1",
				text: "When can I view the property?",
				timestamp: "09:15 AM",
				sender: "user",
			},
		],
	},
];

export default function WhatsAppPage() {
	const [searchQuery, setSearchQuery] = useState("");
	const [filter, setFilter] = useState<"all" | "unread">("all");
	const [selectedConversation, setSelectedConversation] =
		useState<Conversation | null>(mockConversations[0]);
	const [messageInput, setMessageInput] = useState("");

	// Filter conversations
	const filteredConversations = mockConversations.filter((conv) => {
		const matchesSearch =
			conv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			conv.phone.includes(searchQuery);
		const matchesFilter =
			filter === "all" || (filter === "unread" && conv.unreadCount > 0);
		return matchesSearch && matchesFilter;
	});

	const totalConversations = mockConversations.length;
	const unreadCount = mockConversations.reduce(
		(sum, conv) => sum + conv.unreadCount,
		0,
	);

	const handleSendMessage = () => {
		if (!messageInput.trim() || !selectedConversation) return;

		// TODO: Send message via API
		const newMessage: Message = {
			id: Date.now().toString(),
			text: messageInput,
			timestamp: new Date().toLocaleTimeString("en-US", {
				hour: "2-digit",
				minute: "2-digit",
			}),
			sender: "agent",
			read: false,
		};

		// Update conversation messages (in real app, this would be API call)
		const updatedConversation = {
			...selectedConversation,
			messages: [...selectedConversation.messages, newMessage],
			lastMessage: messageInput,
			timestamp: newMessage.timestamp,
		};

		setSelectedConversation(updatedConversation);
		setMessageInput("");
	};

	const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	};

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
						<UserDropdown />
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
								<Button variant="ghost" size="sm">
									<RiSettings3Line className="h-4 w-4" />
								</Button>
							</div>
						</div>

						{/* Search Bar */}
						<div className="border-b p-3">
							<div className="relative">
								<RiSearchLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
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
								{filteredConversations.map((conversation) => (
									<button
										key={conversation.id}
										onClick={() => setSelectedConversation(conversation)}
										className={`flex items-center gap-3 border-b p-4 text-left transition-colors hover:bg-muted/50 ${
											selectedConversation?.id === conversation.id
												? "bg-muted"
												: ""
										}`}
									>
										<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
											<RiUserLine className="size-5 text-primary" />
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center justify-between">
												<span className="truncate font-medium">
													{conversation.name}
												</span>
												<span className="shrink-0 text-xs text-muted-foreground">
													{conversation.timestamp}
												</span>
											</div>
											<div className="flex items-center justify-between gap-2">
												<span className="truncate text-sm text-muted-foreground">
													{conversation.lastMessage}
												</span>
												{conversation.unreadCount > 0 && (
													<Badge
														variant="destructive"
														className="shrink-0 size-5 items-center justify-center rounded-full p-0 text-xs"
													>
														{conversation.unreadCount}
													</Badge>
												)}
											</div>
										</div>
									</button>
								))}
							</div>
						</ScrollArea>
					</div>

					{/* Right Pane - Conversation View */}
					<div className="flex flex-1 flex-col">
						{selectedConversation ? (
							<>
								{/* Conversation Header */}
								<div className="flex items-center justify-between border-b p-4">
									<div className="flex items-center gap-3">
										<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
											<RiUserLine className="size-5 text-primary" />
										</div>
										<div>
											<div className="font-medium">{selectedConversation.name}</div>
											<div className="text-sm text-muted-foreground">
												{selectedConversation.phone}
											</div>
										</div>
									</div>
									<div className="flex items-center gap-2">
										{/* <Button variant="ghost" size="sm">
											<RiPhoneLine className="h-4 w-4" />
										</Button> */}
										<Button variant="ghost" size="sm">
											<RiInformationLine className="h-4 w-4" />
										</Button>
									</div>
								</div>

								{/* Messages Area */}
								<ScrollArea className="flex-1 p-4">
									<div className="flex flex-col gap-4">
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
														<span>{message.timestamp}</span>
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
									</div>
								</ScrollArea>

								{/* Message Input */}
								<div className="border-t p-4">
									<div className="flex items-center gap-2">
										<Button variant="ghost" size="sm">
											<RiAttachmentLine className="h-4 w-4" />
										</Button>
										<Input
											placeholder="Type a message..."
											value={messageInput}
											onChange={(e) => setMessageInput(e.target.value)}
											onKeyPress={handleKeyPress}
											className="flex-1"
										/>
										<Button
											size="sm"
											onClick={handleSendMessage}
											disabled={!messageInput.trim()}
											className="bg-green-600 hover:bg-green-700"
										>
											<RiSendPlaneLine className="h-4 w-4" />
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
