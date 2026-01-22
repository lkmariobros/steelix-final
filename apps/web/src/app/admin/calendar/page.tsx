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
import { Switch } from "@/components/ui/switch";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Calendar } from "@/components/ui/calendar";
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
	RiShieldUserLine,
	RiArrowLeftLine,
	RiArrowRightLine,
	RiSearchLine,
} from "@remixicon/react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isSameMonth, addMonths, subMonths } from "date-fns";

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

export default function AdminCalendarPage() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { data: session, isPending } = authClient.useSession();
	const [viewMode, setViewMode] = useState<"calendar" | "announcements">("calendar");
	const [eventViewMode, setEventViewMode] = useState<"upcoming" | "all">("upcoming");
	const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
	const [isAnnouncementDialogOpen, setIsAnnouncementDialogOpen] = useState(false);
	const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
	const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
	const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
	const [selectedDateForEvent, setSelectedDateForEvent] = useState<Date | null>(null);

	// Admin role checking
	const { data: roleData, isLoading: isRoleLoading } = trpc.admin.checkAdminRole.useQuery(
		undefined,
		{
			enabled: !!session,
			retry: false,
		}
	) as { data: { hasAdminAccess: boolean; role: string } | undefined; isLoading: boolean };

	// Check if user is admin
	const isAdmin = roleData?.hasAdminAccess || (session?.user as any)?.role === "admin";

	// Fetch all events for calendar view (needed for monthly display)
	const { data: allEventsData } = trpc.calendar.listEvents.useQuery(
		{ includeInactive: isAdmin },
		{ enabled: !!session }
	);

	// Fetch upcoming events for list view
	const { data: upcomingEventsData } = trpc.calendar.upcomingEvents.useQuery(
		{ days: 30 },
		{ enabled: !!session && (eventViewMode === "upcoming" || !isAdmin) && viewMode !== "calendar" }
	);

	// Fetch announcements
	const { data: announcementsData } = trpc.calendar.listAnnouncements.useQuery(
		{ includeExpired: isAdmin, includeInactive: isAdmin },
		{ enabled: !!session }
	);

	const upcomingEvents = upcomingEventsData?.events || [];
	const allEvents = allEventsData?.events || [];
	// For calendar view, always use all events; for list view, use filtered events
	const events = viewMode === "calendar" ? allEvents : (isAdmin && eventViewMode === "all" ? allEvents : upcomingEvents);
	const announcements = announcementsData?.announcements || [];

	// Group events by date for calendar display
	const eventsByDate = new Map<string, CalendarEvent[]>();
	events.forEach((event) => {
		const eventDate = typeof event.startDate === "string" ? new Date(event.startDate) : event.startDate;
		const dateKey = format(eventDate, "yyyy-MM-dd");
		if (!eventsByDate.has(dateKey)) {
			eventsByDate.set(dateKey, []);
		}
		eventsByDate.get(dateKey)!.push(event as CalendarEvent);
	});

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
			setSelectedDateForEvent(null);
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
			setSelectedDateForEvent(null);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update event");
		},
	});

	const deleteEventMutation = trpc.calendar.deleteEvent.useMutation({
		onSuccess: () => {
			toast.success("Event deleted successfully!");
			queryClient.invalidateQueries({ queryKey: [["calendar"]] });
			setIsEventDialogOpen(false);
			eventForm.reset();
			setEditingEvent(null);
			setSelectedDateForEvent(null);
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
	const handleCreateEvent = (date?: Date) => {
		setEditingEvent(null);
		const defaultDate = date || new Date();
		eventForm.reset({
			title: "",
			description: "",
			eventType: "meeting",
			startDate: format(defaultDate, "yyyy-MM-dd"),
			startTime: "",
			endDate: "",
			endTime: "",
			location: "",
			priority: "normal",
			isAllDay: false,
			assignedToAgentId: null,
		});
		setSelectedDateForEvent(date || null);
		setIsEventDialogOpen(true);
	};

	const handleDayClick = (date: Date) => {
		if (isAdmin) {
			handleCreateEvent(date);
		}
	};

	const navigateMonth = (direction: "prev" | "next" | "today") => {
		if (direction === "prev") {
			setCurrentMonth(subMonths(currentMonth, 1));
		} else if (direction === "next") {
			setCurrentMonth(addMonths(currentMonth, 1));
		} else {
			setCurrentMonth(new Date());
		}
	};

	const handleEditEvent = (event: CalendarEvent) => {
		setEditingEvent(event);
		setSelectedDateForEvent(null);
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

	// Authentication and role check
	if (isPending || isRoleLoading) {
		return (
			<div className="flex h-screen items-center justify-center">
				<LoadingSpinner size="lg" text="Loading..." />
			</div>
		);
	}

	if (!session) {
		router.push("/login");
		return null;
	}

	if (!roleData || !roleData.hasAdminAccess) {
		return (
			<div className="flex h-screen items-center justify-center">
				<div className="text-center">
					<RiShieldUserLine size={48} className="mx-auto text-muted-foreground mb-4" />
					<h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
					<p className="text-muted-foreground mb-4">
						You don&apos;t have permission to access the admin portal.
					</p>
					<button
						type="button"
						onClick={() => router.push('/dashboard')}
						className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
					>
						Go to Agent Dashboard
					</button>
				</div>
			</div>
		);
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
									<BreadcrumbLink href="/admin">
										<RiDashboardLine size={22} aria-hidden="true" />
										<span className="sr-only">Admin Dashboard</span>
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
								Manage office events, meetings, and announcements for all agents
							</p>
						</div>
						{isAdmin && (
							<div className="flex gap-2">
								<Button onClick={() => handleCreateEvent()} variant="default">
									<RiAddLine className="mr-2 size-4" />
									New Event
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
					</div>

					{/* Calendar Events View - Monthly Grid */}
					{viewMode === "calendar" && (
						<Card className="w-full">
							<CardContent className="p-6">
								{/* Calendar Header with Navigation */}
								<div className="flex items-center justify-between mb-6">
									{/* Current Date Display */}
									<div className="flex items-center gap-4">
										<div className="flex flex-col items-center justify-center bg-muted rounded-lg p-3 min-w-[60px]">
											<div className="text-xs font-medium text-muted-foreground uppercase">
												{format(currentMonth, "MMM")}
											</div>
											<div className="text-2xl font-bold">
												{format(new Date(), "d")}
											</div>
										</div>
										<div>
											<h2 className="text-2xl font-semibold">
												{format(currentMonth, "MMMM, yyyy")}
											</h2>
											<p className="text-sm text-muted-foreground">
												{format(startOfMonth(currentMonth), "MMM d, yyyy")} - {format(endOfMonth(currentMonth), "MMM d, yyyy")}
											</p>
										</div>
									</div>

									{/* Navigation Controls */}
									<div className="flex items-center gap-2">
										<Button
											variant="ghost"
											size="icon"
											onClick={() => navigateMonth("prev")}
											className="h-9 w-9"
										>
											<RiArrowLeftLine className="size-5" />
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() => navigateMonth("today")}
											className="h-9"
										>
											Today
										</Button>
										<Button
											variant="ghost"
											size="icon"
											onClick={() => navigateMonth("next")}
											className="h-9 w-9"
										>
											<RiArrowRightLine className="size-5" />
										</Button>
										{isAdmin && (
											<Button
												variant="default"
												size="sm"
												onClick={() => handleCreateEvent()}
												className="h-9 ml-2"
											>
												<RiAddLine className="mr-2 size-4" />
												New Event
											</Button>
										)}
									</div>
								</div>

								{/* Calendar Grid */}
								<div className="border rounded-lg overflow-hidden">
									{/* Days of Week Header */}
									<div className="grid grid-cols-7 border-b bg-muted/50">
										{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
											<div
												key={day}
												className="p-3 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0"
											>
												{day}
											</div>
										))}
									</div>

									{/* Calendar Days Grid */}
									<div className="grid grid-cols-7">
										{(() => {
											const monthStart = startOfMonth(currentMonth);
											const monthEnd = endOfMonth(currentMonth);
											const calendarStart = new Date(monthStart);
											calendarStart.setDate(calendarStart.getDate() - calendarStart.getDay());
											const calendarEnd = new Date(monthEnd);
											calendarEnd.setDate(calendarEnd.getDate() + (6 - calendarEnd.getDay()));
											const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

											return days.map((day, index) => {
												const dateKey = format(day, "yyyy-MM-dd");
												const dayEvents = eventsByDate.get(dateKey) || [];
												const isCurrentMonth = isSameMonth(day, currentMonth);
												const isCurrentDay = isToday(day);

												return (
													<div
														key={index}
														className={`min-h-[120px] border-r border-b last:border-r-0 p-2 ${
															!isCurrentMonth ? "bg-muted/30" : "bg-background"
														} ${isAdmin ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}`}
														onClick={() => isAdmin && handleDayClick(day)}
													>
														<div className="flex items-center justify-between mb-1">
															<span
																className={`text-sm font-medium ${
																	isCurrentDay
																		? "flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground"
																		: !isCurrentMonth
																		? "text-muted-foreground"
																		: "text-foreground"
																}`}
															>
																{format(day, "d")}
															</span>
														</div>
														<div className="space-y-1">
															{dayEvents.slice(0, 3).map((event) => (
																<div
																	key={event.id}
																	onClick={(e) => {
																		e.stopPropagation();
																		if (isAdmin) {
																			handleEditEvent(event);
																		}
																	}}
																	className={`text-xs p-1.5 rounded truncate cursor-pointer ${
																		getEventTypeColor(event.eventType)
																	} ${!event.isActive ? "opacity-50" : ""}`}
																	title={event.title}
																>
																	{!event.isAllDay && (
																		<span className="font-medium">
																			{formatTime(event.startDate)}{" "}
																		</span>
																	)}
																	{event.title}
																</div>
															))}
															{dayEvents.length > 3 && (
																<div className="text-xs text-muted-foreground p-1">
																	+{dayEvents.length - 3} more
																</div>
															)}
														</div>
													</div>
												);
											});
										})()}
									</div>
								</div>
							</CardContent>
						</Card>
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

								<DialogFooter className="flex items-center justify-between sm:justify-between">
									{editingEvent && (
										<Button
											type="button"
											variant="destructive"
											onClick={() => handleDeleteEvent(editingEvent.id)}
											disabled={deleteEventMutation.isPending || createEventMutation.isPending || updateEventMutation.isPending}
											className="mr-auto"
										>
											<RiDeleteBinLine className="mr-2 size-4" />
											Delete Event
										</Button>
									)}
									<div className="flex gap-2 ml-auto">
										<Button
											type="button"
											variant="outline"
											onClick={() => {
												setIsEventDialogOpen(false);
												eventForm.reset();
												setEditingEvent(null);
												setSelectedDateForEvent(null);
											}}
										>
											Cancel
										</Button>
										<Button type="submit" disabled={createEventMutation.isPending || updateEventMutation.isPending || deleteEventMutation.isPending}>
											{editingEvent ? "Update Event" : "Create Event"}
										</Button>
									</div>
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
