"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import UserDropdown from "@/components/user-dropdown";
import {
	RiCalendarLine,
	RiDashboardLine,
	RiAddLine,
	RiEditLine,
	RiDeleteBinLine,
	RiMapPinLine,
	RiTimeLine,
	RiAlarmLine,
	RiNotificationLine,
	RiPushpinLine,
} from "@remixicon/react";

// Type definitions
type EventType = "meeting" | "training" | "announcement" | "holiday" | "deadline" | "other";
type Priority = "low" | "normal" | "high" | "urgent";

interface CalendarEvent {
	id: string;
	title: string;
	description?: string | null;
	eventType: EventType;
	startDate: Date | string;
	endDate?: Date | string | null;
	location?: string | null;
	priority: Priority;
	isAllDay: boolean;
	assignedToAgentId?: string | null;
	isActive: boolean;
	createdByName?: string | null;
	createdAt: Date | string;
	updatedAt: Date | string;
}

interface Announcement {
	id: string;
	title: string;
	content: string;
	priority: Priority;
	expiresAt?: Date | string | null;
	isActive: boolean;
	isPinned: boolean;
	createdByName?: string | null;
	createdAt: Date | string;
	updatedAt: Date | string;
}

// Form schemas
const eventFormSchema = z.object({
	title: z.string().min(1, "Title is required"),
	description: z.string().optional(),
	eventType: z.enum(["meeting", "training", "announcement", "holiday", "deadline", "other"]),
	startDate: z.string().min(1, "Start date is required"),
	startTime: z.string().optional(),
	endDate: z.string().optional(),
	endTime: z.string().optional(),
	location: z.string().optional(),
	priority: z.enum(["low", "normal", "high", "urgent"]),
	isAllDay: z.boolean(),
	assignedToAgentId: z.string().uuid().optional().nullable(),
});

const announcementFormSchema = z.object({
	title: z.string().min(1, "Title is required"),
	content: z.string().min(1, "Content is required"),
	priority: z.enum(["low", "normal", "high", "urgent"]),
	expiresAt: z.string().optional().nullable(),
	isPinned: z.boolean(),
});

type EventFormValues = z.infer<typeof eventFormSchema>;
type AnnouncementFormValues = z.infer<typeof announcementFormSchema>;

export default function CalendarPage() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { data: session, isPending } = authClient.useSession();
	const [viewMode, setViewMode] = useState<"calendar" | "announcements">("calendar");
	const [eventViewMode, setEventViewMode] = useState<"upcoming" | "all">("upcoming");
	const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
	const [isAnnouncementDialogOpen, setIsAnnouncementDialogOpen] = useState(false);
	const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
	const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);

	// Check if user is admin
	const isAdmin = (session?.user as any)?.role === "admin";

	// Fetch upcoming events
	const { data: upcomingEventsData } = trpc.calendar.upcomingEvents.useQuery(
		{ days: 30 },
		{ enabled: !!session && (eventViewMode === "upcoming" || !isAdmin) }
	);

	// Fetch all events (admin only, includes past and inactive)
	const { data: allEventsData } = trpc.calendar.listEvents.useQuery(
		{ includeInactive: true },
		{ enabled: !!session && isAdmin && eventViewMode === "all" }
	);

	// Fetch announcements
	const { data: announcementsData } = trpc.calendar.listAnnouncements.useQuery(
		{ includeExpired: isAdmin, includeInactive: isAdmin },
		{ enabled: !!session }
	);

	const upcomingEvents = upcomingEventsData?.events || [];
	const allEvents = allEventsData?.events || [];
	const events = isAdmin && eventViewMode === "all" ? allEvents : upcomingEvents;
	const announcements = announcementsData?.announcements || [];

	// Event form
	const eventForm = useForm<EventFormValues>({
		resolver: zodResolver(eventFormSchema),
		defaultValues: {
			title: "",
			description: "",
			eventType: "meeting",
			startDate: "",
			startTime: "",
			endDate: "",
			endTime: "",
			location: "",
			priority: "normal",
			isAllDay: false,
			assignedToAgentId: null,
		},
	});

	// Announcement form
	const announcementForm = useForm<AnnouncementFormValues>({
		resolver: zodResolver(announcementFormSchema),
		defaultValues: {
			title: "",
			content: "",
			priority: "normal",
			expiresAt: null,
			isPinned: false,
		},
	});

	// Mutations
	const createEventMutation = trpc.calendar.createEvent.useMutation({
		onSuccess: () => {
			toast.success("Event created successfully!");
			queryClient.invalidateQueries({ queryKey: [["calendar"]] });
			setIsEventDialogOpen(false);
			eventForm.reset();
			setEditingEvent(null);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to create event");
		},
	});

	const updateEventMutation = trpc.calendar.updateEvent.useMutation({
		onSuccess: () => {
			toast.success("Event updated successfully!");
			queryClient.invalidateQueries({ queryKey: [["calendar"]] });
			setIsEventDialogOpen(false);
			eventForm.reset();
			setEditingEvent(null);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update event");
		},
	});

	const deleteEventMutation = trpc.calendar.deleteEvent.useMutation({
		onSuccess: () => {
			toast.success("Event deleted successfully!");
			queryClient.invalidateQueries({ queryKey: [["calendar"]] });
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete event");
		},
	});

	const createAnnouncementMutation = trpc.calendar.createAnnouncement.useMutation({
		onSuccess: () => {
			toast.success("Announcement created successfully!");
			queryClient.invalidateQueries({ queryKey: [["calendar", "listAnnouncements"]] });
			setIsAnnouncementDialogOpen(false);
			announcementForm.reset();
			setEditingAnnouncement(null);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to create announcement");
		},
	});

	const updateAnnouncementMutation = trpc.calendar.updateAnnouncement.useMutation({
		onSuccess: () => {
			toast.success("Announcement updated successfully!");
			queryClient.invalidateQueries({ queryKey: [["calendar", "listAnnouncements"]] });
			setIsAnnouncementDialogOpen(false);
			announcementForm.reset();
			setEditingAnnouncement(null);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update announcement");
		},
	});

	const deleteAnnouncementMutation = trpc.calendar.deleteAnnouncement.useMutation({
		onSuccess: () => {
			toast.success("Announcement deleted successfully!");
			queryClient.invalidateQueries({ queryKey: [["calendar", "listAnnouncements"]] });
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete announcement");
		},
	});

	// Helper functions
	const formatDate = (date: Date | string): string => {
		const d = typeof date === "string" ? new Date(date) : date;
		return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
	};

	const formatTime = (date: Date | string): string => {
		const d = typeof date === "string" ? new Date(date) : date;
		return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
	};

	const getDaysUntil = (date: Date | string): number => {
		const d = typeof date === "string" ? new Date(date) : date;
		const now = new Date();
		const diffTime = d.getTime() - now.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return diffDays;
	};

	const getPriorityColor = (priority: Priority): string => {
		switch (priority) {
			case "urgent":
				return "bg-red-500 text-white";
			case "high":
				return "bg-orange-500 text-white";
			case "normal":
				return "bg-blue-500 text-white";
			case "low":
				return "bg-gray-500 text-white";
			default:
				return "bg-gray-500 text-white";
		}
	};

	const getEventTypeColor = (type: EventType): string => {
		switch (type) {
			case "meeting":
				return "bg-purple-500 text-white";
			case "training":
				return "bg-green-500 text-white";
			case "holiday":
				return "bg-yellow-500 text-white";
			case "deadline":
				return "bg-red-500 text-white";
			case "announcement":
				return "bg-blue-500 text-white";
			default:
				return "bg-gray-500 text-white";
		}
	};

	// Handlers
	const handleCreateEvent = () => {
		setEditingEvent(null);
		eventForm.reset();
		setIsEventDialogOpen(true);
	};

	const handleEditEvent = (event: CalendarEvent) => {
		setEditingEvent(event);
		const startDate = typeof event.startDate === "string" ? new Date(event.startDate) : event.startDate;
		const endDate = event.endDate ? (typeof event.endDate === "string" ? new Date(event.endDate) : event.endDate) : null;

		eventForm.reset({
			title: event.title,
			description: event.description || "",
			eventType: event.eventType,
			startDate: startDate.toISOString().split("T")[0],
			startTime: event.isAllDay ? "" : startDate.toTimeString().slice(0, 5),
			endDate: endDate ? endDate.toISOString().split("T")[0] : "",
			endTime: endDate && !event.isAllDay ? endDate.toTimeString().slice(0, 5) : "",
			location: event.location || "",
			priority: event.priority,
			isAllDay: event.isAllDay,
			assignedToAgentId: event.assignedToAgentId || null,
		});
		setIsEventDialogOpen(true);
	};

	const handleDeleteEvent = (id: string) => {
		if (confirm("Are you sure you want to delete this event?")) {
			deleteEventMutation.mutate({ id });
		}
	};

	const onSubmitEvent = (data: EventFormValues) => {
		const startDate = new Date(data.startDate);
		if (data.startTime && !data.isAllDay) {
			const [hours, minutes] = data.startTime.split(":").map(Number);
			startDate.setHours(hours, minutes, 0, 0);
		}

		let endDate: Date | undefined;
		if (data.endDate) {
			endDate = new Date(data.endDate);
			if (data.endTime && !data.isAllDay) {
				const [hours, minutes] = data.endTime.split(":").map(Number);
				endDate.setHours(hours, minutes, 0, 0);
			} else if (data.isAllDay) {
				endDate.setHours(23, 59, 59, 999);
			}
		}

		const eventData: any = {
			title: data.title,
			eventType: data.eventType,
			startDate,
			priority: data.priority,
			isAllDay: data.isAllDay,
		};

		// Only include optional fields if they have values
		if (data.description && data.description.trim()) {
			eventData.description = data.description;
		}
		if (endDate) {
			eventData.endDate = endDate;
		}
		if (data.location && data.location.trim()) {
			eventData.location = data.location;
		}
		if (data.assignedToAgentId) {
			eventData.assignedToAgentId = data.assignedToAgentId;
		}

		if (editingEvent) {
			updateEventMutation.mutate({ id: editingEvent.id, ...eventData });
		} else {
			createEventMutation.mutate(eventData);
		}
	};

	const handleCreateAnnouncement = () => {
		setEditingAnnouncement(null);
		announcementForm.reset();
		setIsAnnouncementDialogOpen(true);
	};

	const handleEditAnnouncement = (announcement: Announcement) => {
		setEditingAnnouncement(announcement);
		announcementForm.reset({
			title: announcement.title,
			content: announcement.content,
			priority: announcement.priority,
			expiresAt: announcement.expiresAt
				? (typeof announcement.expiresAt === "string"
					? new Date(announcement.expiresAt).toISOString().split("T")[0]
					: announcement.expiresAt.toISOString().split("T")[0])
				: null,
			isPinned: announcement.isPinned,
		});
		setIsAnnouncementDialogOpen(true);
	};

	const handleDeleteAnnouncement = (id: string) => {
		if (confirm("Are you sure you want to delete this announcement?")) {
			deleteAnnouncementMutation.mutate({ id });
		}
	};

	const onSubmitAnnouncement = (data: AnnouncementFormValues) => {
		const announcementData = {
			title: data.title,
			content: data.content,
			priority: data.priority,
			expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
			isPinned: data.isPinned,
		};

		if (editingAnnouncement) {
			updateAnnouncementMutation.mutate({ id: editingAnnouncement.id, ...announcementData });
		} else {
			createAnnouncementMutation.mutate(announcementData);
		}
	};

	// Authentication check
	if (isPending) {
		return (
			<div className="flex h-screen items-center justify-center">
				<div className="animate-spin">Loading...</div>
			</div>
		);
	}

	if (!session) {
		router.push("/login");
		return null;
	}

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset className="overflow-hidden px-4 md:px-6 lg:px-8">
				<header className="flex h-16 shrink-0 items-center gap-2 border-b">
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
										<RiCalendarLine size={18} />
										Office Calendar
									</BreadcrumbPage>
								</BreadcrumbItem>
							</BreadcrumbList>
						</Breadcrumb>
					</div>
					<div className="ml-auto flex gap-3">
						<UserDropdown />
					</div>
				</header>

				<div className="flex flex-1 flex-col gap-4 py-4 lg:gap-6 lg:py-6">
					{/* Header */}
					<div className="flex items-center justify-between">
						<div>
							<h1 className="font-semibold text-2xl">Office Calendar & Announcements</h1>
							<p className="text-sm text-muted-foreground">
								View upcoming meetings, events, and office announcements
							</p>
						</div>
						{isAdmin && (
							<div className="flex gap-2">
								<Button onClick={handleCreateEvent} variant="default">
									<RiAddLine className="mr-2 size-4" />
									Add Event
								</Button>
								<Button onClick={handleCreateAnnouncement} variant="outline">
									<RiAddLine className="mr-2 size-4" />
									New Announcement
								</Button>
							</div>
						)}
					</div>

					{/* View Toggle */}
					<div className="flex items-center gap-4">
						<div className="flex items-center gap-1 border rounded-md p-1 bg-muted/50 w-fit">
							<Button
								variant={viewMode === "calendar" ? "default" : "ghost"}
								size="sm"
								onClick={() => setViewMode("calendar")}
								className="h-8"
							>
								<RiCalendarLine className="mr-2 size-4" />
								Calendar Events
							</Button>
							<Button
								variant={viewMode === "announcements" ? "default" : "ghost"}
								size="sm"
								onClick={() => setViewMode("announcements")}
								className="h-8"
							>
								<RiNotificationLine className="mr-2 size-4" />
								Announcements
							</Button>
						</div>
						{isAdmin && viewMode === "calendar" && (
							<div className="flex items-center gap-1 border rounded-md p-1 bg-muted/50 w-fit">
								<Button
									variant={eventViewMode === "upcoming" ? "default" : "ghost"}
									size="sm"
									onClick={() => setEventViewMode("upcoming")}
									className="h-8 text-xs"
								>
									Upcoming
								</Button>
								<Button
									variant={eventViewMode === "all" ? "default" : "ghost"}
									size="sm"
									onClick={() => setEventViewMode("all")}
									className="h-8 text-xs"
								>
									All Events
								</Button>
							</div>
						)}
					</div>

					{/* Calendar Events View */}
					{viewMode === "calendar" && (
						<div className="space-y-4">
							{events.length === 0 ? (
								<Card>
									<CardContent className="flex flex-col items-center justify-center py-12">
										<RiCalendarLine className="mb-4 size-12 text-muted-foreground" />
										<p className="text-lg font-medium">
											{eventViewMode === "all" ? "No events found" : "No upcoming events"}
										</p>
										<p className="text-sm text-muted-foreground">
											{isAdmin
												? "Create an event to get started"
												: "Check back later for upcoming events"}
										</p>
									</CardContent>
								</Card>
							) : (
								<div className="space-y-4">
									{isAdmin && eventViewMode === "all" && (
										<div className="text-sm text-muted-foreground">
											Showing {events.length} event{events.length !== 1 ? "s" : ""} (including past and inactive)
										</div>
									)}
									<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
										{events.map((event) => {
											const daysUntil = getDaysUntil(event.startDate);
											const isUpcoming = daysUntil >= 0 && daysUntil <= 7;
											const isPast = daysUntil < 0;

											return (
												<Card 
													key={event.id} 
													className={
														isPast && eventViewMode === "all"
															? "border-gray-300 opacity-75"
															: isUpcoming
															? "border-blue-500"
															: ""
													}
												>
												<CardHeader>
													<div className="flex items-start justify-between">
														<div className="flex-1">
															<CardTitle className="text-lg">{event.title}</CardTitle>
															{isAdmin && !event.isActive && (
																<Badge variant="outline" className="mt-1 text-xs text-muted-foreground">
																	Inactive
																</Badge>
															)}
														</div>
														{isAdmin && (
															<div className="flex gap-1">
																<Button
																	variant="ghost"
																	size="sm"
																	onClick={() => handleEditEvent(event as CalendarEvent)}
																	className="h-8 w-8 p-0"
																>
																	<RiEditLine className="size-4" />
																</Button>
																<Button
																	variant="ghost"
																	size="sm"
																	onClick={() => handleDeleteEvent(event.id)}
																	className="h-8 w-8 p-0 text-destructive"
																>
																	<RiDeleteBinLine className="size-4" />
																</Button>
															</div>
														)}
													</div>
													<div className="flex flex-wrap gap-2 mt-2">
														<Badge className={getEventTypeColor(event.eventType)}>
															{event.eventType}
														</Badge>
														<Badge className={getPriorityColor(event.priority || "normal")}>
															{event.priority || "normal"}
														</Badge>
														{isPast && eventViewMode === "all" && (
															<Badge variant="outline" className="text-xs">
																Past
															</Badge>
														)}
													</div>
												</CardHeader>
												<CardContent className="space-y-2">
													{event.description && (
														<p className="text-sm text-muted-foreground">{event.description}</p>
													)}
													<div className="space-y-1 text-sm">
														<div className="flex items-center gap-2">
															<RiTimeLine className="size-4 text-muted-foreground" />
															<span>
																{formatDate(event.startDate)}
																{!event.isAllDay && ` at ${formatTime(event.startDate)}`}
															</span>
														</div>
														{event.location && (
															<div className="flex items-center gap-2">
																<RiMapPinLine className="size-4 text-muted-foreground" />
																<span>{event.location}</span>
															</div>
														)}
														{daysUntil >= 0 && daysUntil <= 7 && (
															<div className="flex items-center gap-2 text-blue-600 font-medium">
																<RiAlarmLine className="size-4" />
																<span>
																	{daysUntil === 0
																		? "Today"
																		: daysUntil === 1
																			? "Tomorrow"
																			: `In ${daysUntil} days`}
																</span>
															</div>
														)}
														{isPast && eventViewMode === "all" && (
															<div className="flex items-center gap-2 text-muted-foreground text-sm">
																<span>
																	{Math.abs(daysUntil) === 1
																		? "Yesterday"
																		: `${Math.abs(daysUntil)} days ago`}
																</span>
															</div>
														)}
													</div>
												</CardContent>
												</Card>
											);
										})}
									</div>
								</div>
							)}
						</div>
					)}

					{/* Announcements View */}
					{viewMode === "announcements" && (
						<div className="space-y-4">
							{announcements.length === 0 ? (
								<Card>
									<CardContent className="flex flex-col items-center justify-center py-12">
										<RiNotificationLine className="mb-4 size-12 text-muted-foreground" />
										<p className="text-lg font-medium">No announcements</p>
										<p className="text-sm text-muted-foreground">
											{isAdmin
												? "Create an announcement to share with the team"
												: "Check back later for announcements"}
										</p>
									</CardContent>
								</Card>
							) : (
								<div className="space-y-4">
									{announcements.map((announcement) => (
										<Card
											key={announcement.id}
											className={announcement.isPinned ? "border-yellow-500" : ""}
										>
											<CardHeader>
												<div className="flex items-start justify-between">
													<div className="flex items-center gap-2">
														{announcement.isPinned && (
															<RiPushpinLine className="size-5 text-yellow-500" />
														)}
														<CardTitle className="text-lg">{announcement.title}</CardTitle>
													</div>
													{isAdmin && (
														<div className="flex gap-1">
															<Button
																variant="ghost"
																size="sm"
																onClick={() => handleEditAnnouncement(announcement as Announcement)}
																className="h-8 w-8 p-0"
															>
																<RiEditLine className="size-4" />
															</Button>
															<Button
																variant="ghost"
																size="sm"
																onClick={() => handleDeleteAnnouncement(announcement.id)}
																className="h-8 w-8 p-0 text-destructive"
															>
																<RiDeleteBinLine className="size-4" />
															</Button>
														</div>
													)}
												</div>
												<div className="flex items-center gap-2 mt-2">
													<Badge className={getPriorityColor(announcement.priority || "normal")}>
														{announcement.priority || "normal"}
													</Badge>
													<span className="text-xs text-muted-foreground">
														{formatDate(announcement.createdAt)} • {announcement.createdByName || "Admin"}
													</span>
													{announcement.expiresAt && (
														<span className="text-xs text-muted-foreground">
															• Expires {formatDate(announcement.expiresAt)}
														</span>
													)}
												</div>
											</CardHeader>
											<CardContent>
												<p className="text-sm whitespace-pre-wrap">{announcement.content}</p>
											</CardContent>
										</Card>
									))}
								</div>
							)}
						</div>
					)}
				</div>

				{/* Create/Edit Event Dialog */}
				<Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
					<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
						<DialogHeader>
							<DialogTitle>
								{editingEvent ? "Edit Event" : "Create New Event"}
							</DialogTitle>
							<DialogDescription>
								{editingEvent
									? "Update the event details below"
									: "Add a new event to the office calendar"}
							</DialogDescription>
						</DialogHeader>
						<Form {...eventForm}>
							<form onSubmit={eventForm.handleSubmit(onSubmitEvent)} className="space-y-4">
								<FormField
									control={eventForm.control}
									name="title"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Title *</FormLabel>
											<FormControl>
												<Input placeholder="e.g., Team Meeting" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={eventForm.control}
									name="eventType"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Event Type *</FormLabel>
											<Select onValueChange={field.onChange} defaultValue={field.value}>
												<FormControl>
													<SelectTrigger>
														<SelectValue placeholder="Select event type" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													<SelectItem value="meeting">Meeting</SelectItem>
													<SelectItem value="training">Training</SelectItem>
													<SelectItem value="announcement">Announcement</SelectItem>
													<SelectItem value="holiday">Holiday</SelectItem>
													<SelectItem value="deadline">Deadline</SelectItem>
													<SelectItem value="other">Other</SelectItem>
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={eventForm.control}
									name="description"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Description</FormLabel>
											<FormControl>
												<Textarea
													placeholder="Add event details..."
													className="resize-none"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<div className="grid grid-cols-2 gap-4">
									<FormField
										control={eventForm.control}
										name="startDate"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Start Date *</FormLabel>
												<FormControl>
													<Input type="date" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									{!eventForm.watch("isAllDay") && (
										<FormField
											control={eventForm.control}
											name="startTime"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Start Time</FormLabel>
													<FormControl>
														<Input type="time" {...field} />
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
									)}
								</div>

								<div className="grid grid-cols-2 gap-4">
									<FormField
										control={eventForm.control}
										name="endDate"
										render={({ field }) => (
											<FormItem>
												<FormLabel>End Date</FormLabel>
												<FormControl>
													<Input type="date" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									{!eventForm.watch("isAllDay") && (
										<FormField
											control={eventForm.control}
											name="endTime"
											render={({ field }) => (
												<FormItem>
													<FormLabel>End Time</FormLabel>
													<FormControl>
														<Input type="time" {...field} />
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
									)}
								</div>

								<FormField
									control={eventForm.control}
									name="isAllDay"
									render={({ field }) => (
										<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
											<div className="space-y-0.5">
												<FormLabel className="text-base">All Day Event</FormLabel>
												<FormDescription>
													Event spans the entire day without specific times
												</FormDescription>
											</div>
											<FormControl>
												<Switch
													checked={field.value}
													onCheckedChange={field.onChange}
												/>
											</FormControl>
										</FormItem>
									)}
								/>

								<FormField
									control={eventForm.control}
									name="location"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Location</FormLabel>
											<FormControl>
												<Input placeholder="e.g., Conference Room A, Online" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={eventForm.control}
									name="priority"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Priority</FormLabel>
											<Select onValueChange={field.onChange} defaultValue={field.value}>
												<FormControl>
													<SelectTrigger>
														<SelectValue placeholder="Select priority" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													<SelectItem value="low">Low</SelectItem>
													<SelectItem value="normal">Normal</SelectItem>
													<SelectItem value="high">High</SelectItem>
													<SelectItem value="urgent">Urgent</SelectItem>
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>

								<DialogFooter>
									<Button
										type="button"
										variant="outline"
										onClick={() => {
											setIsEventDialogOpen(false);
											eventForm.reset();
											setEditingEvent(null);
										}}
									>
										Cancel
									</Button>
									<Button type="submit" disabled={createEventMutation.isPending || updateEventMutation.isPending}>
										{editingEvent ? "Update Event" : "Create Event"}
									</Button>
								</DialogFooter>
							</form>
						</Form>
					</DialogContent>
				</Dialog>

				{/* Create/Edit Announcement Dialog */}
				<Dialog open={isAnnouncementDialogOpen} onOpenChange={setIsAnnouncementDialogOpen}>
					<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
						<DialogHeader>
							<DialogTitle>
								{editingAnnouncement ? "Edit Announcement" : "Create New Announcement"}
							</DialogTitle>
							<DialogDescription>
								{editingAnnouncement
									? "Update the announcement details below"
									: "Create a new office announcement to share with all agents"}
							</DialogDescription>
						</DialogHeader>
						<Form {...announcementForm}>
							<form onSubmit={announcementForm.handleSubmit(onSubmitAnnouncement)} className="space-y-4">
								<FormField
									control={announcementForm.control}
									name="title"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Title *</FormLabel>
											<FormControl>
												<Input placeholder="e.g., Office Policy Update" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={announcementForm.control}
									name="content"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Content *</FormLabel>
											<FormControl>
												<Textarea
													placeholder="Enter announcement details..."
													className="resize-none min-h-[120px]"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<div className="grid grid-cols-2 gap-4">
									<FormField
										control={announcementForm.control}
										name="priority"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Priority</FormLabel>
												<Select onValueChange={field.onChange} defaultValue={field.value}>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select priority" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="low">Low</SelectItem>
														<SelectItem value="normal">Normal</SelectItem>
														<SelectItem value="high">High</SelectItem>
														<SelectItem value="urgent">Urgent</SelectItem>
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={announcementForm.control}
										name="expiresAt"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Expiration Date (Optional)</FormLabel>
												<FormControl>
													<Input
														type="date"
														value={field.value || ""}
														onChange={(e) => field.onChange(e.target.value || null)}
													/>
												</FormControl>
												<FormDescription>
													Announcement will be hidden after this date
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								<FormField
									control={announcementForm.control}
									name="isPinned"
									render={({ field }) => (
										<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
											<div className="space-y-0.5">
												<FormLabel className="text-base">Pin to Top</FormLabel>
												<FormDescription>
													Pinned announcements appear at the top of the list
												</FormDescription>
											</div>
											<FormControl>
												<Switch
													checked={field.value}
													onCheckedChange={field.onChange}
												/>
											</FormControl>
										</FormItem>
									)}
								/>

								<DialogFooter>
									<Button
										type="button"
										variant="outline"
										onClick={() => {
											setIsAnnouncementDialogOpen(false);
											announcementForm.reset();
											setEditingAnnouncement(null);
										}}
									>
										Cancel
									</Button>
									<Button
										type="submit"
										disabled={createAnnouncementMutation.isPending || updateAnnouncementMutation.isPending}
									>
										{editingAnnouncement ? "Update Announcement" : "Create Announcement"}
									</Button>
								</DialogFooter>
							</form>
						</Form>
					</DialogContent>
				</Dialog>
			</SidebarInset>
		</SidebarProvider>
	);
}
