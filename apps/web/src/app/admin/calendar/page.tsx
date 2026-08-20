"use client";

import { HeaderActions } from "@/components/header-actions";
import { SidebarTrigger } from "@/components/sidebar";
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
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	RiAddLine,
	RiArrowLeftLine,
	RiArrowRightLine,
	RiCalendarLine,
	RiDashboardLine,
	RiDeleteBinLine,
	RiEditLine,
	RiNotificationLine,
	RiPushpinLine,
} from "@remixicon/react";
import { useQueryClient } from "@tanstack/react-query";
import {
	addMonths,
	eachDayOfInterval,
	endOfMonth,
	format,
	isSameMonth,
	isToday,
	startOfMonth,
	subMonths,
} from "date-fns";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

function parseYmd(value: string | null | undefined): Date | undefined {
	if (!value) return undefined;
	const d = new Date(`${value}T00:00:00`);
	return Number.isNaN(d.getTime()) ? undefined : d;
}

function toYmd(date: Date | undefined): string {
	if (!date) return "";
	return format(date, "yyyy-MM-dd");
}

function FormDatePicker({
	value,
	onChange,
	placeholder = "Select date",
	optional = false,
}: {
	value: string | null | undefined;
	onChange: (next: string | null) => void;
	placeholder?: string;
	optional?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const selected = parseYmd(value ?? undefined);

	return (
		<Popover open={open} onOpenChange={setOpen} modal={false}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					className={cn(
						"h-10 w-full justify-start gap-2 rounded-xl border-border/70 bg-background font-normal shadow-none",
						!selected && "text-muted-foreground",
					)}
				>
					<RiCalendarLine className="size-4 shrink-0 text-muted-foreground" />
					<span className="truncate">
						{selected ? format(selected, "dd MMM yyyy") : placeholder}
					</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="z-[80] w-auto border-border/70 bg-popover p-0 text-popover-foreground shadow-card"
				align="start"
				sideOffset={6}
			>
				<Calendar
					mode="single"
					selected={selected}
					onSelect={(date) => {
						const next = toYmd(date);
						onChange(optional ? next || null : next);
						if (date) setOpen(false);
					}}
					initialFocus
				/>
				<div className="flex items-center justify-between border-border/60 border-t px-3 py-2">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-8 rounded-full px-2.5 text-xs"
						onClick={() => {
							onChange(optional ? null : "");
							setOpen(false);
						}}
					>
						Clear
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-8 rounded-full px-2.5 text-xs"
						onClick={() => {
							const today = toYmd(new Date());
							onChange(optional ? today : today);
							setOpen(false);
						}}
					>
						Today
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}

// Type definitions
type EventType =
	| "meeting"
	| "training"
	| "announcement"
	| "holiday"
	| "deadline"
	| "other";
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
	eventType: z.enum([
		"meeting",
		"training",
		"announcement",
		"holiday",
		"deadline",
		"other",
	]),
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
	const queryClient = useQueryClient();
	const { data: session } = authClient.useSession();
	const [viewMode, setViewMode] = useState<"calendar" | "announcements">(
		"calendar",
	);
	const [eventViewMode, setEventViewMode] = useState<"upcoming" | "all">(
		"upcoming",
	);
	const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
	const [isAnnouncementDialogOpen, setIsAnnouncementDialogOpen] =
		useState(false);
	const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
	const [editingAnnouncement, setEditingAnnouncement] =
		useState<Announcement | null>(null);
	const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
	const [selectedDateForEvent, setSelectedDateForEvent] = useState<Date | null>(
		null,
	);

	// All authenticated users are treated as admin
	const isAdmin = !!session;

	// Fetch all events for calendar view (needed for monthly display)
	const { data: allEventsData, isLoading: isLoadingEvents } =
		trpc.calendar.listEvents.useQuery(
			{ includeInactive: isAdmin },
			{ enabled: !!session },
		);

	// Fetch upcoming events for list view
	const { data: upcomingEventsData } = trpc.calendar.upcomingEvents.useQuery(
		{ days: 30 },
		{
			enabled:
				!!session &&
				(eventViewMode === "upcoming" || !isAdmin) &&
				viewMode !== "calendar",
		},
	);

	// Fetch announcements
	const { data: announcementsData, isLoading: isLoadingAnnouncements } =
		trpc.calendar.listAnnouncements.useQuery(
			{ includeExpired: isAdmin, includeInactive: isAdmin },
			{ enabled: !!session },
		);

	const upcomingEvents = upcomingEventsData?.events || [];
	const allEvents = allEventsData?.events || [];
	// For calendar view, always use all events; for list view, use filtered events
	const events =
		viewMode === "calendar"
			? allEvents
			: isAdmin && eventViewMode === "all"
				? allEvents
				: upcomingEvents;
	const announcements = announcementsData?.announcements || [];

	// Group events by date for calendar display
	const eventsByDate = new Map<string, CalendarEvent[]>();
	for (const event of events) {
		const eventDate =
			typeof event.startDate === "string"
				? new Date(event.startDate)
				: event.startDate;
		const dateKey = format(eventDate, "yyyy-MM-dd");
		if (!eventsByDate.has(dateKey)) {
			eventsByDate.set(dateKey, []);
		}
		eventsByDate.get(dateKey)?.push(event as CalendarEvent);
	}

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

	const createAnnouncementMutation =
		trpc.calendar.createAnnouncement.useMutation({
			onSuccess: () => {
				toast.success("Announcement created successfully!");
				queryClient.invalidateQueries({
					queryKey: [["calendar", "listAnnouncements"]],
				});
				setIsAnnouncementDialogOpen(false);
				announcementForm.reset();
				setEditingAnnouncement(null);
			},
			onError: (error) => {
				toast.error(error.message || "Failed to create announcement");
			},
		});

	const updateAnnouncementMutation =
		trpc.calendar.updateAnnouncement.useMutation({
			onSuccess: () => {
				toast.success("Announcement updated successfully!");
				queryClient.invalidateQueries({
					queryKey: [["calendar", "listAnnouncements"]],
				});
				setIsAnnouncementDialogOpen(false);
				announcementForm.reset();
				setEditingAnnouncement(null);
			},
			onError: (error) => {
				toast.error(error.message || "Failed to update announcement");
			},
		});

	const deleteAnnouncementMutation =
		trpc.calendar.deleteAnnouncement.useMutation({
			onSuccess: () => {
				toast.success("Announcement deleted successfully!");
				queryClient.invalidateQueries({
					queryKey: [["calendar", "listAnnouncements"]],
				});
			},
			onError: (error) => {
				toast.error(error.message || "Failed to delete announcement");
			},
		});

	// Helper functions
	const formatDate = (date: Date | string): string => {
		const d = typeof date === "string" ? new Date(date) : date;
		return d.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

	const formatTime = (date: Date | string): string => {
		const d = typeof date === "string" ? new Date(date) : date;
		return d.toLocaleTimeString("en-US", {
			hour: "2-digit",
			minute: "2-digit",
		});
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
		const startDate =
			typeof event.startDate === "string"
				? new Date(event.startDate)
				: event.startDate;
		const endDate = event.endDate
			? typeof event.endDate === "string"
				? new Date(event.endDate)
				: event.endDate
			: null;

		eventForm.reset({
			title: event.title,
			description: event.description || "",
			eventType: event.eventType,
			startDate: startDate.toISOString().split("T")[0],
			startTime: event.isAllDay ? "" : startDate.toTimeString().slice(0, 5),
			endDate: endDate ? endDate.toISOString().split("T")[0] : "",
			endTime:
				endDate && !event.isAllDay ? endDate.toTimeString().slice(0, 5) : "",
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

		type CalendarPriority = "low" | "normal" | "high" | "urgent";
		type CalendarEventType =
			| "meeting"
			| "training"
			| "announcement"
			| "holiday"
			| "deadline"
			| "other";
		const eventData: {
			title: string;
			eventType: CalendarEventType;
			startDate: Date;
			endDate?: Date;
			description?: string;
			location?: string;
			assignedToAgentId?: string | null;
			priority?: CalendarPriority;
			isAllDay?: boolean;
		} = {
			title: data.title,
			eventType: data.eventType as CalendarEventType,
			startDate,
			priority: (data.priority as CalendarPriority) ?? "normal",
			isAllDay: data.isAllDay,
		};

		// Only include optional fields if they have values
		if (data.description?.trim()) {
			eventData.description = data.description;
		}
		if (endDate) {
			eventData.endDate = endDate;
		}
		if (data.location?.trim()) {
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
				? typeof announcement.expiresAt === "string"
					? new Date(announcement.expiresAt).toISOString().split("T")[0]
					: announcement.expiresAt.toISOString().split("T")[0]
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
			updateAnnouncementMutation.mutate({
				id: editingAnnouncement.id,
				...announcementData,
			});
		} else {
			createAnnouncementMutation.mutate(announcementData);
		}
	};

	return (
		<>
			<header className="sticky top-0 z-40 -mx-4 flex h-16 shrink-0 items-center gap-2 border-border/60 border-b bg-background px-4 backdrop-blur-md supports-backdrop-filter:bg-background/95 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
				<div className="flex flex-1 items-center gap-2 px-1 sm:px-0">
					<SidebarTrigger className="-ms-1 rounded-xl" />
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
								<BreadcrumbPage className="flex items-center gap-2 font-medium">
									<span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
										<RiCalendarLine size={16} />
									</span>
									Office Calendar
								</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				</div>
				<div className="ml-auto flex gap-2">
					<HeaderActions />
				</div>
			</header>

			<div className="flex flex-1 flex-col gap-5 py-5 lg:gap-6 lg:py-7">
					{/* Header */}
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div className="min-w-0 space-y-1">
							<h1 className="font-bold text-2xl tracking-tight">
								Office Calendar & Announcements
							</h1>
							<p className="text-muted-foreground text-sm">
								Manage office events, meetings, and announcements for all agents
							</p>
						</div>
						{isAdmin && (
							<div className="flex flex-wrap gap-2">
								<Button
									onClick={() => handleCreateEvent()}
									className="h-9 gap-1.5 rounded-full px-4"
								>
									<RiAddLine className="size-4" />
									New Event
								</Button>
								<Button
									onClick={handleCreateAnnouncement}
									variant="outline"
									className="h-9 gap-1.5 rounded-full border-border/70 bg-card px-4 shadow-card"
								>
									<RiAddLine className="size-4" />
									New Announcement
								</Button>
							</div>
						)}
					</div>

					{/* View Toggle */}
					<div className="flex w-fit items-center gap-1 rounded-full border border-border/60 bg-muted/40 p-1 shadow-sm">
						<button
							type="button"
							onClick={() => setViewMode("calendar")}
							className={cn(
								"inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 font-medium text-xs transition-colors",
								viewMode === "calendar"
									? "bg-primary text-primary-foreground shadow-sm"
									: "text-muted-foreground hover:bg-muted hover:text-foreground",
							)}
						>
							<RiCalendarLine className="size-3.5" />
							Calendar Events
						</button>
						<button
							type="button"
							onClick={() => setViewMode("announcements")}
							className={cn(
								"inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 font-medium text-xs transition-colors",
								viewMode === "announcements"
									? "bg-primary text-primary-foreground shadow-sm"
									: "text-muted-foreground hover:bg-muted hover:text-foreground",
							)}
						>
							<RiNotificationLine className="size-3.5" />
							Announcements
						</button>
					</div>

					{/* Calendar Events View - Monthly Grid */}
					{viewMode === "calendar" && (
						<Card className="w-full gap-0 overflow-hidden rounded-3xl border-border/50 py-0 shadow-card">
							<CardContent className="p-5 sm:p-6">
								{isLoadingEvents ? (
									<>
										{/* Skeleton header */}
										<div className="mb-6 flex items-center justify-between">
											<div className="flex items-center gap-4">
												<Skeleton className="h-[60px] w-[60px] rounded-lg" />
												<div className="space-y-2">
													<Skeleton className="h-7 w-44" />
													<Skeleton className="h-4 w-52" />
												</div>
											</div>
											<div className="flex items-center gap-2">
												<Skeleton className="h-9 w-9 rounded-md" />
												<Skeleton className="h-9 w-16 rounded-md" />
												<Skeleton className="h-9 w-9 rounded-md" />
											</div>
										</div>
										{/* Skeleton calendar grid */}
										<div className="overflow-hidden rounded-2xl border border-border/60">
											<div className="grid grid-cols-7 border-border/60 border-b bg-muted/40">
												{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
													(d) => (
														<div
															key={d}
															className="border-border/50 border-r p-3 text-center font-semibold text-foreground/75 text-xs uppercase tracking-wide last:border-r-0"
														>
															{d}
														</div>
													),
												)}
											</div>
											<div className="grid grid-cols-7">
												{Array.from({ length: 35 }, (_, n) => ({
													id: `sk-day-${n}`,
													n,
												})).map(({ id, n }) => (
													<div
														key={id}
														className="min-h-[100px] border-r border-b p-2 last:border-r-0"
													>
														<Skeleton className="mb-2 h-5 w-5 rounded-full" />
														{n % 5 === 0 && (
															<Skeleton className="h-5 w-full rounded" />
														)}
														{n % 7 === 2 && (
															<Skeleton className="mt-1 h-5 w-4/5 rounded" />
														)}
													</div>
												))}
											</div>
										</div>
									</>
								) : (
									<>
										{/* Calendar Header with Navigation */}
										<div className="mb-6 flex items-center justify-between">
											{/* Current Date Display */}
											<div className="flex items-center gap-4">
												<div className="flex min-w-[60px] flex-col items-center justify-center rounded-lg bg-muted p-3">
													<div className="font-medium text-muted-foreground text-xs uppercase">
														{format(currentMonth, "MMM")}
													</div>
													<div className="font-bold text-2xl">
														{format(new Date(), "d")}
													</div>
												</div>
												<div>
													<h2 className="font-semibold text-2xl">
														{format(currentMonth, "MMMM, yyyy")}
													</h2>
													<p className="text-muted-foreground text-sm">
														{format(startOfMonth(currentMonth), "MMM d, yyyy")}{" "}
														- {format(endOfMonth(currentMonth), "MMM d, yyyy")}
													</p>
												</div>
											</div>

											{/* Navigation Controls */}
											<div className="flex items-center gap-2">
												<Button
													variant="outline"
													size="icon"
													onClick={() => navigateMonth("prev")}
													className="size-9 rounded-full border-border/70 shadow-card"
												>
													<RiArrowLeftLine className="size-4" />
												</Button>
												<Button
													variant="outline"
													size="sm"
													onClick={() => navigateMonth("today")}
													className="h-9 rounded-full border-border/70 px-4 shadow-card"
												>
													Today
												</Button>
												<Button
													variant="outline"
													size="icon"
													onClick={() => navigateMonth("next")}
													className="size-9 rounded-full border-border/70 shadow-card"
												>
													<RiArrowRightLine className="size-4" />
												</Button>
											</div>
										</div>

										{/* Calendar Grid */}
										<div className="overflow-hidden rounded-2xl border border-border/60">
											{/* Days of Week Header */}
											<div className="grid grid-cols-7 border-border/60 border-b bg-muted/40">
												{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
													(day) => (
														<div
															key={day}
															className="border-border/50 border-r p-3 text-center font-semibold text-foreground/75 text-xs uppercase tracking-wide last:border-r-0"
														>
															{day}
														</div>
													),
												)}
											</div>

											{/* Calendar Days Grid */}
											<div className="grid grid-cols-7">
												{(() => {
													const monthStart = startOfMonth(currentMonth);
													const monthEnd = endOfMonth(currentMonth);
													const calendarStart = new Date(monthStart);
													calendarStart.setDate(
														calendarStart.getDate() - calendarStart.getDay(),
													);
													const calendarEnd = new Date(monthEnd);
													calendarEnd.setDate(
														calendarEnd.getDate() + (6 - calendarEnd.getDay()),
													);
													const days = eachDayOfInterval({
														start: calendarStart,
														end: calendarEnd,
													});

													return days.map((day) => {
														const dateKey = format(day, "yyyy-MM-dd");
														const dayEvents = eventsByDate.get(dateKey) || [];
														const isCurrentMonth = isSameMonth(
															day,
															currentMonth,
														);
														const isCurrentDay = isToday(day);

														return (
															<div
																key={dateKey}
																className={`min-h-[120px] border-r border-b p-2 last:border-r-0 ${
																	!isCurrentMonth
																		? "bg-muted/30"
																		: "bg-background"
																} ${isAdmin ? "cursor-pointer transition-colors hover:bg-muted/50" : ""}`}
																onClick={() => isAdmin && handleDayClick(day)}
																onKeyDown={(e) => {
																	if (e.key === "Enter" || e.key === " ") {
																		isAdmin && handleDayClick(day);
																	}
																}}
															>
																<div className="mb-1 flex items-center justify-between">
																	<span
																		className={`font-medium text-sm ${
																			isCurrentDay
																				? "flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground"
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
																			onKeyDown={(e) => {
																				if (
																					e.key === "Enter" ||
																					e.key === " "
																				) {
																					e.stopPropagation();
																					if (isAdmin) {
																						handleEditEvent(event);
																					}
																				}
																			}}
																			className={`cursor-pointer truncate rounded p-1.5 text-xs ${getEventTypeColor(
																				event.eventType,
																			)} ${!event.isActive ? "opacity-50" : ""}`}
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
																		<div className="p-1 text-muted-foreground text-xs">
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
									</>
								)}
							</CardContent>
						</Card>
					)}

					{/* Announcements View */}
					{viewMode === "announcements" && (
						<div className="space-y-4">
							{isLoadingAnnouncements ? (
								<>
									{["sk-1", "sk-2", "sk-3"].map((id) => (
										<Card key={id}>
											<CardHeader>
												<div className="flex items-start justify-between">
													<div className="flex items-center gap-2">
														<Skeleton className="h-5 w-5 rounded" />
														<Skeleton className="h-5 w-48" />
													</div>
													{isAdmin && (
														<div className="flex gap-1">
															<Skeleton className="h-8 w-8 rounded-md" />
															<Skeleton className="h-8 w-8 rounded-md" />
														</div>
													)}
												</div>
												<div className="mt-2 flex items-center gap-2">
													<Skeleton className="h-5 w-14 rounded-full" />
													<Skeleton className="h-3 w-40" />
												</div>
											</CardHeader>
											<CardContent className="space-y-2">
												<Skeleton className="h-3.5 w-full" />
												<Skeleton className="h-3.5 w-5/6" />
												<Skeleton className="h-3.5 w-3/4" />
											</CardContent>
										</Card>
									))}
								</>
							) : announcements.length === 0 ? (
								<Card>
									<CardContent className="flex flex-col items-center justify-center py-12">
										<RiNotificationLine className="mb-4 size-12 text-muted-foreground" />
										<p className="font-medium text-lg">No announcements</p>
										<p className="text-muted-foreground text-sm">
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
											className={
												announcement.isPinned ? "border-yellow-500" : ""
											}
										>
											<CardHeader>
												<div className="flex items-start justify-between">
													<div className="flex items-center gap-2">
														{announcement.isPinned && (
															<RiPushpinLine className="size-5 text-yellow-500" />
														)}
														<CardTitle className="text-lg">
															{announcement.title}
														</CardTitle>
													</div>
													{isAdmin && (
														<div className="flex gap-1">
															<Button
																variant="ghost"
																size="sm"
																onClick={() =>
																	handleEditAnnouncement(
																		announcement as Announcement,
																	)
																}
																className="h-8 w-8 p-0"
															>
																<RiEditLine className="size-4" />
															</Button>
															<Button
																variant="ghost"
																size="sm"
																onClick={() =>
																	handleDeleteAnnouncement(announcement.id)
																}
																className="h-8 w-8 p-0 text-destructive"
															>
																<RiDeleteBinLine className="size-4" />
															</Button>
														</div>
													)}
												</div>
												<div className="mt-2 flex items-center gap-2">
													<Badge
														className={getPriorityColor(
															announcement.priority || "normal",
														)}
													>
														{announcement.priority || "normal"}
													</Badge>
													<span className="text-muted-foreground text-xs">
														{formatDate(announcement.createdAt)} •{" "}
														{announcement.createdByName || "Admin"}
													</span>
													{announcement.expiresAt && (
														<span className="text-muted-foreground text-xs">
															• Expires {formatDate(announcement.expiresAt)}
														</span>
													)}
												</div>
											</CardHeader>
											<CardContent>
												<p className="whitespace-pre-wrap text-sm">
													{announcement.content}
												</p>
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
					<DialogContent className="max-h-[min(90vh,880px)] gap-0 overflow-visible rounded-3xl border-border/60 p-0 sm:max-w-2xl">
						<DialogHeader className="border-border/50 border-b px-6 py-5">
							<DialogTitle className="text-base">
								{editingEvent ? "Edit Event" : "Create New Event"}
							</DialogTitle>
							<DialogDescription>
								{editingEvent
									? "Update the event details below"
									: "Add a new event to the office calendar"}
							</DialogDescription>
						</DialogHeader>
						<Form {...eventForm}>
							<form
								onSubmit={eventForm.handleSubmit(onSubmitEvent)}
								className="flex max-h-[min(70vh,640px)] flex-col"
							>
								<div className="space-y-4 overflow-y-auto px-6 py-5">
								<FormField
									control={eventForm.control}
									name="title"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Title *</FormLabel>
											<FormControl>
												<Input
													placeholder="e.g., Team Meeting"
													className="h-10 rounded-xl border-border/70"
													{...field}
												/>
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
											<Select
												onValueChange={field.onChange}
												defaultValue={field.value}
											>
												<FormControl>
													<SelectTrigger className="h-10 rounded-xl border-border/70">
														<SelectValue placeholder="Select event type" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													<SelectItem value="meeting">Meeting</SelectItem>
													<SelectItem value="training">Training</SelectItem>
													<SelectItem value="announcement">
														Announcement
													</SelectItem>
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
													className="resize-none rounded-xl border-border/70"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<div className="grid gap-4 sm:grid-cols-2">
									<FormField
										control={eventForm.control}
										name="startDate"
										render={({ field }) => (
											<FormItem className="flex flex-col">
												<FormLabel>Start Date *</FormLabel>
												<FormControl>
													<FormDatePicker
														value={field.value}
														onChange={(next) => field.onChange(next ?? "")}
														placeholder="Select start date"
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									{!eventForm.watch("isAllDay") ? (
										<FormField
											control={eventForm.control}
											name="startTime"
											render={({ field }) => (
												<FormItem className="flex flex-col">
													<FormLabel>Start Time</FormLabel>
													<FormControl>
														<Input
															type="time"
															className="h-10 rounded-xl border-border/70"
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
									) : (
										<div className="hidden sm:block" />
									)}
								</div>

								<div className="grid gap-4 sm:grid-cols-2">
									<FormField
										control={eventForm.control}
										name="endDate"
										render={({ field }) => (
											<FormItem className="flex flex-col">
												<FormLabel>End Date</FormLabel>
												<FormControl>
													<FormDatePicker
														value={field.value}
														onChange={(next) => field.onChange(next ?? "")}
														placeholder="Select end date"
														optional
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									{!eventForm.watch("isAllDay") ? (
										<FormField
											control={eventForm.control}
											name="endTime"
											render={({ field }) => (
												<FormItem className="flex flex-col">
													<FormLabel>End Time</FormLabel>
													<FormControl>
														<Input
															type="time"
															className="h-10 rounded-xl border-border/70"
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
									) : (
										<div className="hidden sm:block" />
									)}
								</div>

								<FormField
									control={eventForm.control}
									name="isAllDay"
									render={({ field }) => (
										<FormItem className="flex flex-row items-center justify-between rounded-2xl border border-border/60 p-4">
											<div className="space-y-0.5">
												<FormLabel className="text-base">
													All Day Event
												</FormLabel>
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
												<Input
													placeholder="e.g., Conference Room A, Online"
													className="h-10 rounded-xl border-border/70"
													{...field}
												/>
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
											<Select
												onValueChange={field.onChange}
												defaultValue={field.value}
											>
												<FormControl>
													<SelectTrigger className="h-10 rounded-xl border-border/70">
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
								</div>

								<DialogFooter className="flex items-center justify-between border-border/50 border-t bg-muted/20 px-6 py-4 sm:justify-between">
									{editingEvent && (
										<Button
											type="button"
											variant="destructive"
											onClick={() => handleDeleteEvent(editingEvent.id)}
											disabled={
												deleteEventMutation.isPending ||
												createEventMutation.isPending ||
												updateEventMutation.isPending
											}
											className="mr-auto rounded-full"
										>
											<RiDeleteBinLine className="mr-2 size-4" />
											Delete Event
										</Button>
									)}
									<div className="ml-auto flex gap-2">
										<Button
											type="button"
											variant="outline"
											className="rounded-full"
											onClick={() => {
												setIsEventDialogOpen(false);
												eventForm.reset();
												setEditingEvent(null);
												setSelectedDateForEvent(null);
											}}
										>
											Cancel
										</Button>
										<Button
											type="submit"
											className="rounded-full px-5"
											disabled={
												createEventMutation.isPending ||
												updateEventMutation.isPending ||
												deleteEventMutation.isPending
											}
										>
											{editingEvent ? "Update Event" : "Create Event"}
										</Button>
									</div>
								</DialogFooter>
							</form>
						</Form>
					</DialogContent>
				</Dialog>

				{/* Create/Edit Announcement Dialog */}
				<Dialog
					open={isAnnouncementDialogOpen}
					onOpenChange={setIsAnnouncementDialogOpen}
				>
					<DialogContent className="max-h-[min(90vh,880px)] gap-0 overflow-visible rounded-3xl border-border/60 p-0 sm:max-w-2xl">
						<DialogHeader className="border-border/50 border-b px-6 py-5">
							<DialogTitle className="text-base">
								{editingAnnouncement
									? "Edit Announcement"
									: "Create New Announcement"}
							</DialogTitle>
							<DialogDescription>
								{editingAnnouncement
									? "Update the announcement details below"
									: "Create a new office announcement to share with all agents"}
							</DialogDescription>
						</DialogHeader>
						<Form {...announcementForm}>
							<form
								onSubmit={announcementForm.handleSubmit(onSubmitAnnouncement)}
								className="flex max-h-[min(70vh,640px)] flex-col"
							>
								<div className="space-y-4 overflow-y-auto px-6 py-5">
								<FormField
									control={announcementForm.control}
									name="title"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Title *</FormLabel>
											<FormControl>
												<Input
													placeholder="e.g., Office Policy Update"
													className="h-10 rounded-xl border-border/70"
													{...field}
												/>
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
													className="min-h-[120px] resize-none rounded-xl border-border/70"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<div className="grid items-start gap-4 sm:grid-cols-2">
									<FormField
										control={announcementForm.control}
										name="priority"
										render={({ field }) => (
											<FormItem className="flex flex-col gap-2">
												<FormLabel>Priority</FormLabel>
												<Select
													onValueChange={field.onChange}
													defaultValue={field.value}
												>
													<FormControl>
														<SelectTrigger className="h-10 w-full rounded-xl border-border/70">
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
											<FormItem className="flex flex-col gap-2">
												<FormLabel>Expiration Date (Optional)</FormLabel>
												<FormControl>
													<FormDatePicker
														value={field.value}
														onChange={(next) => field.onChange(next)}
														placeholder="Select expiration date"
														optional
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
										<FormItem className="flex flex-row items-center justify-between rounded-2xl border border-border/60 p-4">
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
								</div>

								<DialogFooter className="border-border/50 border-t bg-muted/20 px-6 py-4">
									<Button
										type="button"
										variant="outline"
										className="rounded-full"
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
										className="rounded-full px-5"
										disabled={
											createAnnouncementMutation.isPending ||
											updateAnnouncementMutation.isPending
										}
									>
										{editingAnnouncement
											? "Update Announcement"
											: "Create Announcement"}
									</Button>
								</DialogFooter>
							</form>
						</Form>
					</DialogContent>
				</Dialog>
		</>
	);
}
