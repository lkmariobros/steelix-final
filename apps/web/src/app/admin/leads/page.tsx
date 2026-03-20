"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { HeaderActions } from "@/components/header-actions";
import { Separator } from "@/components/separator";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/sheet";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/sidebar";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import {
	RiAddLine,
	RiAlarmWarningLine,
	RiArrowDownLine,
	RiArrowUpLine,
	RiBarChartLine,
	RiCalendar2Line,
	RiCheckboxMultipleLine,
	RiCheckLine,
	RiCloseLine,
	RiDashboardLine,
	RiDeleteBinLine,
	RiEditLine,
	RiErrorWarningLine,
	RiEyeLine,
	RiFileList3Line,
	RiFilter3Line,
	RiHistoryLine,
	RiLoader4Line,
	RiMailLine,
	RiPhoneLine,
	RiRefreshLine,
	RiSearchLine,
	RiShieldUserLine,
	RiStickyNoteLine,
	RiTodoLine,
	RiUserLine,
} from "@remixicon/react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	Area,
	AreaChart,
	Cell,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { toast } from "sonner";

// ─── Constants ─────────────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
	{
		value: "new_lead",
		label: "New Lead",
		color: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
	},
	{
		value: "follow_up_in_progress",
		label: "Follow Up In Progress",
		color:
			"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
	},
	{
		value: "no_pick_reply",
		label: "No Pick/Reply",
		color: "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400",
	},
	{
		value: "follow_up_for_appointment",
		label: "Follow Up For Appt.",
		color:
			"bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400",
	},
	{
		value: "potential_lead",
		label: "Potential Lead",
		color: "bg-teal-100 text-teal-800 dark:bg-teal-900/20 dark:text-teal-400",
	},
	{
		value: "consider_seen",
		label: "Consider / Seen",
		color:
			"bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
	},
	{
		value: "appointment_made",
		label: "Appointment Made",
		color:
			"bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
	},
	{
		value: "reject_project",
		label: "Reject Project",
		color: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
	},
	{
		value: "booking_made",
		label: "Booking Made",
		color:
			"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400",
	},
	{
		value: "spam_fake_lead",
		label: "Spam / Fake Lead",
		color: "bg-red-200 text-red-900 dark:bg-red-900/30 dark:text-red-300",
	},
] as const;

type PipelineStageValue = (typeof PIPELINE_STAGES)[number]["value"];

const stageMap = Object.fromEntries(PIPELINE_STAGES.map((s) => [s.value, s]));

const STATUS_OPTIONS = [
	{ value: "active", label: "Active" },
	{ value: "inactive", label: "Inactive" },
	{ value: "pending", label: "Pending" },
];

const TYPE_OPTIONS = [
	{ value: "tenant", label: "Tenant" },
	{ value: "buyer", label: "Buyer" },
];

const LEAD_TYPE_OPTIONS = [
	{ value: "personal", label: "Personal" },
	{ value: "company", label: "Company" },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// ─── Types ─────────────────────────────────────────────────────────────────────

type Lead = {
	id: string;
	name: string;
	email: string;
	phone: string;
	source: string;
	type: "tenant" | "buyer";
	property: string;
	projectId: string | null;
	projectName: string | null;
	status: "active" | "inactive" | "pending";
	stage: string;
	leadType: "personal" | "company";
	tags: string | null;
	lastContact: Date | string | null;
	nextContact: Date | string | null;
	agentId: string | null;
	agentName: string | null;
	agentEmail: string | null;
	tagIds: string[];
	tagNames: string[];
	createdAt: Date | string;
	updatedAt: Date | string;
};

type SortKey =
	| "name"
	| "stage"
	| "status"
	| "agentName"
	| "createdAt"
	| "updatedAt";

type TaskType = "call" | "email" | "follow_up" | "meeting" | "other";
type TaskPriority = "low" | "normal" | "high" | "urgent";

type LeadTask = {
	id: string;
	prospectId: string;
	prospectName: string | null;
	title: string;
	taskType: TaskType;
	priority: TaskPriority;
	dueDate: Date | string;
	completedAt: Date | string | null;
	assignedTo: string | null;
	assignedToName: string | null;
	createdBy: string;
	createdByName: string | null;
	notes: string | null;
	createdAt: Date | string;
	updatedAt: Date | string;
	isOverdue: boolean;
};

// ─── Task Helpers ───────────────────────────────────────────────────────────

const TASK_TYPE_LABELS: Record<TaskType, string> = {
	call: "Call",
	email: "Email",
	follow_up: "Follow-up",
	meeting: "Meeting",
	other: "Other",
};

const TASK_PRIORITY_CONFIG: Record<
	TaskPriority,
	{ label: string; color: string }
> = {
	low: { label: "Low", color: "text-muted-foreground" },
	normal: { label: "Normal", color: "text-blue-600 dark:text-blue-400" },
	high: { label: "High", color: "text-orange-600 dark:text-orange-400" },
	urgent: { label: "Urgent", color: "text-red-600 dark:text-red-400" },
};

function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
	const cfg = TASK_PRIORITY_CONFIG[priority];
	return (
		<span className={`font-medium text-xs ${cfg.color}`}>{cfg.label}</span>
	);
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function StageBadge({ stage }: { stage: string }) {
	const info = stageMap[stage] ?? {
		label: stage,
		color: "bg-gray-100 text-gray-700",
	};
	return (
		<span
			className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${info.color}`}
		>
			{info.label}
		</span>
	);
}

function StatusBadge({ status }: { status: string }) {
	const colors: Record<string, string> = {
		active:
			"bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
		inactive:
			"bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400",
		pending:
			"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
	};
	return (
		<span
			className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${colors[status] ?? colors.pending}`}
		>
			{status.charAt(0).toUpperCase() + status.slice(1)}
		</span>
	);
}

// ─── Activity Timeline Helpers ─────────────────────────────────────────────────

type ActivityEventType =
	| "note_added"
	| "stage_changed"
	| "lead_assigned"
	| "lead_updated"
	| "call_logged"
	| "email_sent";

const ACTIVITY_CONFIG: Record<
	ActivityEventType,
	{ icon: React.ReactNode; label: string; color: string; dotColor: string }
> = {
	note_added: {
		icon: <RiStickyNoteLine className="size-3.5" />,
		label: "Note Added",
		color: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
		dotColor: "bg-blue-400",
	},
	stage_changed: {
		icon: <RiHistoryLine className="size-3.5" />,
		label: "Stage Changed",
		color:
			"bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300",
		dotColor: "bg-purple-400",
	},
	lead_assigned: {
		icon: <RiUserLine className="size-3.5" />,
		label: "Assigned",
		color:
			"bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300",
		dotColor: "bg-orange-400",
	},
	lead_updated: {
		icon: <RiEditLine className="size-3.5" />,
		label: "Details Updated",
		color: "bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-300",
		dotColor: "bg-gray-400",
	},
	call_logged: {
		icon: <RiPhoneLine className="size-3.5" />,
		label: "Call Logged",
		color:
			"bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300",
		dotColor: "bg-green-400",
	},
	email_sent: {
		icon: <RiMailLine className="size-3.5" />,
		label: "Email Sent",
		color: "bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300",
		dotColor: "bg-teal-400",
	},
};

function ActivityEventIcon({ type }: { type: ActivityEventType }) {
	const cfg = ACTIVITY_CONFIG[type] ?? ACTIVITY_CONFIG.lead_updated;
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs ${cfg.color}`}
		>
			{cfg.icon}
			{cfg.label}
		</span>
	);
}

// ─── Date Time Picker ─────────────────────────────────────────────────────────

// Static arrays defined once outside the component
const DTP_HOURS = Array.from({ length: 12 }, (_, i) =>
	String(i + 1).padStart(2, "0"),
);
const DTP_MINUTES = Array.from({ length: 60 }, (_, i) =>
	String(i).padStart(2, "0"),
);

function DateTimePicker({
	value,
	onChange,
	placeholder = "Pick date & time",
}: {
	value: string; // "YYYY-MM-DDTHH:mm"
	onChange: (v: string) => void;
	placeholder?: string;
}) {
	const [open, setOpen] = useState(false);

	const dateObj = value ? new Date(value) : undefined;
	const isValid = dateObj && !Number.isNaN(dateObj.getTime());

	const timePart = value?.split("T")[1]?.slice(0, 5) ?? "09:00";
	const [rawH, rawM] = timePart.split(":").map(Number);
	const currentAmPm: "AM" | "PM" = rawH >= 12 ? "PM" : "AM";
	const hour12Num = rawH % 12 === 0 ? 12 : rawH % 12;
	const currentHour12 = String(hour12Num).padStart(2, "0");
	const currentMinute = String(rawM).padStart(2, "0");

	const displayValue = isValid
		? dateObj.toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
				year: "numeric",
			}) +
			" · " +
			dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
		: null;

	const handleDaySelect = (day: Date | undefined) => {
		if (!day) return;
		const pad = (n: number) => String(n).padStart(2, "0");
		const dateStr = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
		onChange(`${dateStr}T${timePart}`);
	};

	const applyTime = (
		hour12: string,
		minute: string,
		amPm: "AM" | "PM",
	) => {
		let datePart = value?.split("T")[0];
		if (!datePart) {
			const today = new Date();
			const pad = (n: number) => String(n).padStart(2, "0");
			datePart = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
		}
		let h = parseInt(hour12, 10);
		if (amPm === "AM" && h === 12) h = 0;
		else if (amPm === "PM" && h !== 12) h += 12;
		onChange(`${datePart}T${String(h).padStart(2, "0")}:${minute}`);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						"flex h-8 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-xs transition-colors hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring",
						!displayValue && "text-muted-foreground",
					)}
				>
					<RiCalendar2Line className="size-3.5 shrink-0 text-muted-foreground" />
					{displayValue ?? placeholder}
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="start">
				<Calendar
					mode="single"
					selected={isValid ? dateObj : undefined}
					onSelect={handleDaySelect}
					captionLayout="label"
				/>
				{/* ── Time Picker ── */}
				<div className="border-t px-3 py-3">
					<p className="mb-2.5 font-medium text-muted-foreground text-xs">
						Time
					</p>
					<div className="flex items-center gap-2">
						{/* Hour */}
						<Select
							value={currentHour12}
							onValueChange={(v) =>
								applyTime(v, currentMinute, currentAmPm)
							}
						>
							<SelectTrigger className="h-8 w-[4.5rem] text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="max-h-44">
								{DTP_HOURS.map((h) => (
									<SelectItem key={h} value={h} className="text-xs">
										{h}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<span className="font-bold text-muted-foreground text-sm">:</span>

						{/* Minute */}
						<Select
							value={currentMinute}
							onValueChange={(v) =>
								applyTime(currentHour12, v, currentAmPm)
							}
						>
							<SelectTrigger className="h-8 w-[4.5rem] text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="max-h-44">
								{DTP_MINUTES.map((m) => (
									<SelectItem key={m} value={m} className="text-xs">
										{m}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						{/* AM / PM toggle */}
						<div className="flex overflow-hidden rounded-md border">
							<button
								type="button"
								className={cn(
									"px-2.5 py-1 text-xs font-medium transition-colors",
									currentAmPm === "AM"
										? "bg-primary text-primary-foreground"
										: "bg-background text-muted-foreground hover:bg-accent",
								)}
								onClick={() => applyTime(currentHour12, currentMinute, "AM")}
							>
								AM
							</button>
							<button
								type="button"
								className={cn(
									"border-l px-2.5 py-1 text-xs font-medium transition-colors",
									currentAmPm === "PM"
										? "bg-primary text-primary-foreground"
										: "bg-background text-muted-foreground hover:bg-accent",
								)}
								onClick={() => applyTime(currentHour12, currentMinute, "PM")}
							>
								PM
							</button>
						</div>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}

// ─── Lead Tasks Card ──────────────────────────────────────────────────────────

function LeadTasksCard({ leadId }: { leadId: string }) {
	const queryClient = useQueryClient();

	const { data: tasks, isLoading: tasksLoading } = trpc.leadTasks.list.useQuery(
		{ prospectId: leadId },
		{ staleTime: 0 },
	);

	const [showForm, setShowForm] = useState(false);
	const [form, setForm] = useState({
		title: "",
		taskType: "follow_up" as TaskType,
		priority: "normal" as TaskPriority,
		dueDate: "",
		notes: "",
	});

	// Inline edit state
	const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
	const [editForm, setEditForm] = useState({
		title: "",
		taskType: "follow_up" as TaskType,
		priority: "normal" as TaskPriority,
		dueDate: "",
		notes: "",
	});

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: [["leadTasks", "list"]] });
		queryClient.invalidateQueries({ queryKey: [["leadTasks", "listToday"]] });
	};

	const createMutation = trpc.leadTasks.create.useMutation({
		onSuccess: () => {
			toast.success("Task created");
			setShowForm(false);
			setForm({
				title: "",
				taskType: "follow_up",
				priority: "normal",
				dueDate: "",
				notes: "",
			});
			invalidate();
		},
		onError: (e) => toast.error(e.message),
	});

	const updateMutation = trpc.leadTasks.update.useMutation({
		onSuccess: () => {
			toast.success("Task updated");
			setEditingTaskId(null);
			invalidate();
		},
		onError: (e) => toast.error(e.message),
	});

	const completeMutation = trpc.leadTasks.complete.useMutation({
		onSuccess: (task) => {
			toast.success(task.completedAt ? "Task completed ✓" : "Task reopened");
			invalidate();
		},
		onError: (e) => toast.error(e.message),
	});

	const deleteMutation = trpc.leadTasks.delete.useMutation({
		onSuccess: () => {
			toast.success("Task deleted");
			invalidate();
		},
		onError: (e) => toast.error(e.message),
	});

	const handleCreate = () => {
		if (!form.title.trim() || !form.dueDate) return;
		createMutation.mutate({
			prospectId: leadId,
			title: form.title.trim(),
			taskType: form.taskType,
			priority: form.priority,
			dueDate: new Date(form.dueDate),
			notes: form.notes.trim() || null,
		});
	};

	const handleStartEdit = (task: LeadTask) => {
		const dt = new Date(task.dueDate);
		const pad = (n: number) => String(n).padStart(2, "0");
		const local = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
		setEditForm({
			title: task.title,
			taskType: task.taskType as TaskType,
			priority: task.priority as TaskPriority,
			dueDate: local,
			notes: task.notes ?? "",
		});
		setEditingTaskId(task.id);
	};

	const handleSaveEdit = () => {
		if (!editingTaskId || !editForm.title.trim() || !editForm.dueDate) return;
		updateMutation.mutate({
			id: editingTaskId,
			title: editForm.title.trim(),
			taskType: editForm.taskType,
			priority: editForm.priority,
			dueDate: new Date(editForm.dueDate),
			notes: editForm.notes.trim() || null,
		});
	};

	const formatDue = (d: Date | string) => {
		const dt = new Date(d);
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const tomorrow = new Date(today);
		tomorrow.setDate(today.getDate() + 1);
		const taskDay = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());

		if (taskDay.getTime() === today.getTime())
			return `Today ${dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
		if (taskDay.getTime() === tomorrow.getTime())
			return `Tomorrow ${dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
		return dt.toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
			year: dt.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const pendingTasks = (tasks ?? []).filter((t) => !t.completedAt);
	const completedTasks = (tasks ?? []).filter((t) => !!t.completedAt);
	const overduePending = pendingTasks.filter((t) => t.isOverdue);

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2 text-sm">
						<RiTodoLine className="size-4" />
						Tasks &amp; Follow-ups
						{pendingTasks.length > 0 && (
							<span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 font-medium text-primary text-xs">
								{pendingTasks.length}
							</span>
						)}
						{overduePending.length > 0 && (
							<span className="ml-0.5 rounded-full bg-red-100 px-1.5 py-0.5 font-medium text-red-700 text-xs dark:bg-red-900/20 dark:text-red-400">
								{overduePending.length} overdue
							</span>
						)}
					</CardTitle>
					<Button
						size="sm"
						variant="ghost"
						className="h-7 gap-1 px-2 text-xs"
						onClick={() => setShowForm((v) => !v)}
					>
						<RiAddLine className="size-3.5" />
						Add Task
					</Button>
				</div>
			</CardHeader>

			<CardContent className="space-y-3">
				{/* ── Add Task Form ── */}
				{showForm && (
					<div className="space-y-3 rounded-md border bg-muted/30 p-3">
						<p className="font-medium text-xs">New Task</p>
						<div className="space-y-2">
							<Input
								placeholder="Task title e.g. Call Ahmad on Thursday 10am"
								value={form.title}
								onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
								className="h-8 text-sm"
								autoFocus
							/>
							<div className="grid grid-cols-2 gap-2">
								<Select
									value={form.taskType}
									onValueChange={(v) =>
										setForm((p) => ({ ...p, taskType: v as TaskType }))
									}
								>
									<SelectTrigger className="h-8 text-xs">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{(
											Object.entries(TASK_TYPE_LABELS) as [TaskType, string][]
										).map(([val, label]) => (
											<SelectItem key={val} value={val} className="text-xs">
												{label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Select
									value={form.priority}
									onValueChange={(v) =>
										setForm((p) => ({ ...p, priority: v as TaskPriority }))
									}
								>
									<SelectTrigger className="h-8 text-xs">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{(
											Object.entries(
												TASK_PRIORITY_CONFIG,
											) as [TaskPriority, { label: string }][]
										).map(([val, cfg]) => (
											<SelectItem key={val} value={val} className="text-xs">
												{cfg.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						<DateTimePicker
							value={form.dueDate}
							onChange={(v) => setForm((p) => ({ ...p, dueDate: v }))}
							placeholder="Due date & time"
						/>
						<Textarea
							placeholder="Notes (optional)"
							value={form.notes}
							onChange={(e) =>
								setForm((p) => ({ ...p, notes: e.target.value }))
							}
							rows={2}
							className="resize-none bg-background text-xs"
						/>
					</div>
					<div className="flex gap-2">
						<Button
							size="sm"
							className="h-7 text-xs"
							disabled={!form.title.trim() || !form.dueDate || createMutation.isPending}
							onClick={handleCreate}
						>
								{createMutation.isPending && (
									<RiLoader4Line className="mr-1 size-3.5 animate-spin" />
								)}
								Save Task
							</Button>
							<Button
								size="sm"
								variant="ghost"
								className="h-7 text-xs"
								onClick={() => setShowForm(false)}
							>
								Cancel
							</Button>
						</div>
					</div>
				)}

			{/* ── Task List ── */}
			{tasksLoading ? (
				<div className="space-y-2">
					{[1, 2].map((i) => (
						<div key={i} className="rounded-md border p-2.5">
							<div className="flex items-start justify-between gap-2">
								<div className="flex-1 space-y-2">
									<Skeleton className="h-4 w-3/4" />
									<Skeleton className="h-3 w-1/2" />
								</div>
								<div className="flex gap-1">
									<Skeleton className="h-7 w-7 rounded-md" />
									<Skeleton className="h-7 w-7 rounded-md" />
									<Skeleton className="h-7 w-7 rounded-md" />
								</div>
							</div>
						</div>
					))}
				</div>
			) : (tasks ?? []).length === 0 ? (
				<div className="flex flex-col items-center gap-1.5 py-6 text-center">
					<RiTodoLine className="size-7 text-muted-foreground/40" />
					<p className="text-muted-foreground text-sm">No tasks yet</p>
					<p className="text-muted-foreground text-xs">
						Click &ldquo;Add Task&rdquo; to create a follow-up reminder
					</p>
				</div>
			) : (
				<div className="space-y-2">
					{/* Pending tasks */}
					{pendingTasks.map((task) =>
						editingTaskId === task.id ? (
							/* ── Inline Edit Form ── */
							<div
								key={task.id}
								className="space-y-2.5 rounded-md border border-primary/30 bg-muted/30 p-3"
							>
								<p className="font-medium text-xs text-primary">Edit Task</p>
								<Input
									value={editForm.title}
									onChange={(e) =>
										setEditForm((p) => ({ ...p, title: e.target.value }))
									}
									className="h-8 text-sm"
									autoFocus
								/>
								<div className="grid grid-cols-2 gap-2">
									<Select
										value={editForm.taskType}
										onValueChange={(v) =>
											setEditForm((p) => ({ ...p, taskType: v as TaskType }))
										}
									>
										<SelectTrigger className="h-8 text-xs">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{(
												Object.entries(TASK_TYPE_LABELS) as [TaskType, string][]
											).map(([val, label]) => (
												<SelectItem key={val} value={val} className="text-xs">
													{label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<Select
										value={editForm.priority}
										onValueChange={(v) =>
											setEditForm((p) => ({
												...p,
												priority: v as TaskPriority,
											}))
										}
									>
										<SelectTrigger className="h-8 text-xs">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{(
												Object.entries(
													TASK_PRIORITY_CONFIG,
												) as [TaskPriority, { label: string }][]
											).map(([val, cfg]) => (
												<SelectItem key={val} value={val} className="text-xs">
													{cfg.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							<DateTimePicker
								value={editForm.dueDate}
								onChange={(v) => setEditForm((p) => ({ ...p, dueDate: v }))}
								placeholder="Due date & time"
							/>
								<Textarea
									placeholder="Notes (optional)"
									value={editForm.notes}
									onChange={(e) =>
										setEditForm((p) => ({ ...p, notes: e.target.value }))
									}
									rows={2}
									className="resize-none bg-background text-xs"
								/>
								<div className="flex gap-2">
									<Button
										size="sm"
										className="h-7 text-xs"
										disabled={
											!editForm.title.trim() ||
											!editForm.dueDate ||
											updateMutation.isPending
										}
										onClick={handleSaveEdit}
									>
										{updateMutation.isPending && (
											<RiLoader4Line className="mr-1 size-3.5 animate-spin" />
										)}
										Save Changes
									</Button>
									<Button
										size="sm"
										variant="ghost"
										className="h-7 text-xs"
										onClick={() => setEditingTaskId(null)}
									>
										Cancel
									</Button>
								</div>
							</div>
						) : (
							/* ── Task Row ── */
							<div
								key={task.id}
								className={`rounded-md border p-2.5 transition-colors ${
									task.isOverdue
										? "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20"
										: "bg-muted/20 hover:bg-muted/40"
								}`}
							>
								<div className="flex items-start justify-between gap-2">
									<div className="min-w-0 flex-1">
										<div className="flex flex-wrap items-center gap-1.5">
											{task.isOverdue && (
												<RiAlarmWarningLine className="size-3.5 shrink-0 text-red-500" />
											)}
											<p
												className={`font-medium text-sm ${task.isOverdue ? "text-red-700 dark:text-red-400" : ""}`}
											>
												{task.title}
											</p>
										</div>
										<div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
											<span className="text-muted-foreground">
												{TASK_TYPE_LABELS[task.taskType as TaskType]}
											</span>
											<span className="text-muted-foreground">·</span>
											<TaskPriorityBadge
												priority={task.priority as TaskPriority}
											/>
											<span className="text-muted-foreground">·</span>
											<span
												className={`flex items-center gap-0.5 ${task.isOverdue ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground"}`}
											>
												<RiCalendar2Line className="size-3" />
												{formatDue(task.dueDate)}
											</span>
										</div>
										{task.notes && (
											<p className="mt-1 line-clamp-2 text-muted-foreground text-xs">
												{task.notes}
											</p>
										)}
									</div>
									<div className="flex shrink-0 gap-0.5">
										<Button
											variant="ghost"
											size="sm"
											className="h-7 w-7 p-0 text-muted-foreground hover:text-green-600"
											title="Mark complete"
											onClick={() =>
												completeMutation.mutate({ id: task.id, completed: true })
											}
											disabled={completeMutation.isPending}
										>
											<RiCheckLine className="size-3.5" />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
											title="Edit task"
											onClick={() => handleStartEdit(task as LeadTask)}
										>
											<RiEditLine className="size-3.5" />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
											title="Delete task"
											onClick={() => deleteMutation.mutate({ id: task.id })}
											disabled={deleteMutation.isPending}
										>
											<RiDeleteBinLine className="size-3.5" />
										</Button>
									</div>
								</div>
							</div>
						),
					)}

						{/* Completed tasks (collapsed indicator) */}
						{completedTasks.length > 0 && (
							<details className="group">
								<summary className="flex cursor-pointer select-none list-none items-center gap-1.5 text-muted-foreground text-xs hover:text-foreground">
									<RiCheckboxMultipleLine className="size-3.5" />
									{completedTasks.length} completed task
									{completedTasks.length !== 1 ? "s" : ""}
								</summary>
								<div className="mt-2 space-y-1.5">
									{completedTasks.map((task) => (
										<div
											key={task.id}
											className="flex items-center justify-between gap-2 rounded-md border bg-muted/10 px-2.5 py-2 opacity-60"
										>
											<div className="min-w-0 flex-1">
												<p className="truncate text-sm line-through">
													{task.title}
												</p>
												<p className="text-muted-foreground text-xs">
													{TASK_TYPE_LABELS[task.taskType as TaskType]} ·{" "}
													{task.completedAt
														? `Done ${new Date(task.completedAt).toLocaleDateString()}`
														: ""}
												</p>
											</div>
											<div className="flex shrink-0 gap-0.5">
												<Button
													variant="ghost"
													size="sm"
													className="h-7 px-2 text-muted-foreground text-xs hover:text-foreground"
													title="Reopen task"
													onClick={() =>
														completeMutation.mutate({
															id: task.id,
															completed: false,
														})
													}
													disabled={completeMutation.isPending}
												>
													Reopen
												</Button>
												<Button
													variant="ghost"
													size="sm"
													className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
													title="Delete task"
													onClick={() =>
														deleteMutation.mutate({ id: task.id })
													}
													disabled={deleteMutation.isPending}
												>
													<RiDeleteBinLine className="size-3.5" />
												</Button>
											</div>
										</div>
									))}
								</div>
							</details>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

// ─── Today's Tasks Widget ─────────────────────────────────────────────────────

// Task-type icon map used inside TodayTasksWidget
const TASK_TYPE_ICONS: Record<TaskType, React.ReactNode> = {
	call: <RiPhoneLine className="size-3.5" />,
	email: <RiMailLine className="size-3.5" />,
	follow_up: <RiTodoLine className="size-3.5" />,
	meeting: <RiCalendar2Line className="size-3.5" />,
	other: <RiFileList3Line className="size-3.5" />,
};

function TodayTasksWidget({
	onViewLead,
}: {
	onViewLead: (leadId: string) => void;
}) {
	const { data: tasks, isLoading } = trpc.leadTasks.listToday.useQuery(
		undefined,
		{ staleTime: 30 * 1000 },
	);
	const queryClient = useQueryClient();

	const completeMutation = trpc.leadTasks.complete.useMutation({
		onSuccess: (task) => {
			toast.success(task.completedAt ? "Task completed ✓" : "Task reopened");
			queryClient.invalidateQueries({ queryKey: [["leadTasks"]] });
		},
		onError: (e) => toast.error(e.message),
	});

	if (isLoading) {
		return (
			<div className="overflow-hidden rounded-xl border bg-card shadow-sm">
				<div className="flex items-center gap-3 border-b px-4 py-3">
					<Skeleton className="size-8 shrink-0 rounded-lg" />
					<div className="space-y-1.5">
						<Skeleton className="h-4 w-36" />
						<Skeleton className="h-3 w-48" />
					</div>
				</div>
				<div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
					{[1, 2, 3, 4].map((i) => (
						<div key={i} className="flex flex-col gap-2.5 rounded-lg border p-3">
							<div className="flex items-start gap-2">
								<Skeleton className="mt-0.5 size-6 shrink-0 rounded" />
								<div className="flex-1 space-y-1.5">
									<Skeleton className="h-3.5 w-4/5" />
									<Skeleton className="h-3 w-2/3" />
								</div>
							</div>
							<div className="flex items-center justify-between pt-1">
								<Skeleton className="h-5 w-20 rounded-full" />
								<div className="flex gap-1">
									<Skeleton className="size-6 rounded-md" />
									<Skeleton className="size-6 rounded-md" />
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		);
	}

	if (!tasks || tasks.length === 0) return null;

	const overdue = tasks.filter((t) => t.isOverdue);
	const dueToday = tasks.filter((t) => !t.isOverdue);

	const MAX_VISIBLE = 9;
	const visible = tasks.slice(0, MAX_VISIBLE);

	return (
		<div className="overflow-hidden rounded-xl border bg-card shadow-sm">
			{/* ── Header ── */}
			<div className="flex items-center justify-between border-b px-4 py-3">
				<div className="flex items-center gap-3">
					<div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
						<RiTodoLine className="size-4 text-amber-600 dark:text-amber-400" />
					</div>
					<div>
						<h3 className="font-semibold text-sm">Tasks Due Today</h3>
						<p className="text-muted-foreground text-xs">
							Follow-ups &amp; tasks that need your attention
						</p>
					</div>
				</div>
				<div className="flex items-center gap-1.5">
					{overdue.length > 0 && (
						<span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 font-semibold text-red-700 text-xs dark:bg-red-900/20 dark:text-red-400">
							<RiAlarmWarningLine className="size-3" />
							{overdue.length} overdue
						</span>
					)}
					{dueToday.length > 0 && (
						<span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-700 text-xs dark:bg-amber-900/20 dark:text-amber-400">
							{dueToday.length} today
						</span>
					)}
				</div>
			</div>

			{/* ── Card Grid ── */}
			<div className="grid gap-2.5 p-4 sm:grid-cols-2 xl:grid-cols-3">
				{visible.map((task) => (
					<div
						key={task.id}
						className={cn(
							"group relative flex flex-col gap-2 overflow-hidden rounded-lg border transition-all hover:shadow-sm",
							task.isOverdue
								? "border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20"
								: "border-amber-200/70 bg-amber-50/30 dark:border-amber-900/30 dark:bg-amber-950/10",
						)}
					>
						{/* Left accent bar */}
						<div
							className={cn(
								"absolute inset-y-0 left-0 w-0.5",
								task.isOverdue ? "bg-red-500" : "bg-amber-400",
							)}
						/>

						<div className="flex flex-col gap-2 pl-3 pr-3 pt-2.5 pb-2.5">
							{/* Top row: icon + title */}
							<div className="flex items-start gap-2">
								<div
									className={cn(
										"mt-0.5 flex size-6 shrink-0 items-center justify-center rounded",
										task.isOverdue
											? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
											: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
									)}
								>
									{TASK_TYPE_ICONS[task.taskType as TaskType]}
								</div>
								<p
									className={cn(
										"line-clamp-2 font-semibold text-sm leading-snug",
										task.isOverdue && "text-red-700 dark:text-red-400",
									)}
								>
									{task.title}
								</p>
							</div>

							{/* Lead + type */}
							<p className="truncate pl-8 text-muted-foreground text-xs">
								<span className="font-medium text-foreground/70">
									{task.prospectName ?? "Unknown Lead"}
								</span>
								<span className="mx-1 opacity-40">·</span>
								{TASK_TYPE_LABELS[task.taskType as TaskType]}
							</p>

							{/* Footer: due chip + priority + actions */}
							<div className="flex items-center justify-between pl-8">
								<div className="flex items-center gap-1.5">
									{/* Due chip */}
									{task.isOverdue ? (
										<span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700 text-[0.65rem] dark:bg-red-900/20 dark:text-red-400">
											<RiAlarmWarningLine className="mr-1 size-2.5" />
											{new Date(task.dueDate).toLocaleDateString([], {
												month: "short",
												day: "numeric",
											})}
										</span>
									) : (
										<span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700 text-[0.65rem] dark:bg-amber-900/20 dark:text-amber-400">
											<RiCalendar2Line className="mr-1 size-2.5" />
											{new Date(task.dueDate).toLocaleTimeString([], {
												hour: "2-digit",
												minute: "2-digit",
											})}
										</span>
									)}
									{/* Priority badge */}
									<span
										className={cn(
											"inline-flex items-center rounded-full px-2 py-0.5 font-medium text-[0.65rem]",
											{
												"bg-muted text-muted-foreground":
													task.priority === "low",
												"bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400":
													task.priority === "normal",
												"bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400":
													task.priority === "high",
												"bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400":
													task.priority === "urgent",
											},
										)}
									>
										{TASK_PRIORITY_CONFIG[task.priority as TaskPriority].label}
									</span>
								</div>
								{/* Action buttons */}
								<div className="flex items-center gap-0.5">
									<Button
										variant="ghost"
										size="sm"
										className="size-6 p-0 text-muted-foreground hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/20 dark:hover:text-green-400"
										title="Mark complete"
										onClick={() =>
											completeMutation.mutate({
												id: task.id,
												completed: true,
											})
										}
										disabled={completeMutation.isPending}
									>
										<RiCheckLine className="size-3" />
									</Button>
									<Button
										variant="ghost"
										size="sm"
										className="size-6 p-0 text-muted-foreground hover:bg-accent"
										title="View lead"
										onClick={() => onViewLead(task.prospectId)}
									>
										<RiEyeLine className="size-3" />
									</Button>
								</div>
							</div>
						</div>
					</div>
				))}
			</div>

			{tasks.length > MAX_VISIBLE && (
				<div className="border-t bg-muted/20 px-4 py-2.5 text-center text-muted-foreground text-xs">
					+{tasks.length - MAX_VISIBLE} more tasks — open individual leads to see
					all
				</div>
			)}
		</div>
	);
}

// ─── Lead Detail Sheet ─────────────────────────────────────────────────────────

function LeadDetailSheet({
	lead,
	open,
	onClose,
	agents,
	onRefresh,
}: {
	lead: Lead | null;
	open: boolean;
	onClose: () => void;
	agents: Array<{
		agentId: string;
		agentName: string | null;
		agentEmail: string;
	}>;
	onRefresh: () => void;
}) {
	const queryClient = useQueryClient();

	// Input state for the three action types
	const [activeInput, setActiveInput] = useState<
		"note" | "call" | "email" | null
	>(null);
	const [inputContent, setInputContent] = useState("");
	const [newStage, setNewStage] = useState<string>("");
	const [assignAgentId, setAssignAgentId] = useState<string>("");

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: [["adminLeads", "get"]] });
		queryClient.invalidateQueries({
			queryKey: [["adminLeads", "getTimeline"]],
		});
	};

	const { data: detail, isLoading } = trpc.adminLeads.get.useQuery(
		{ id: lead?.id ?? "" },
		{ enabled: !!lead?.id && open, staleTime: 0 },
	);

	const { data: timeline, isLoading: timelineLoading } =
		trpc.adminLeads.getTimeline.useQuery(
			{ leadId: lead?.id ?? "" },
			{ enabled: !!lead?.id && open, staleTime: 0 },
		);

	const addNoteMutation = trpc.adminLeads.addNote.useMutation({
		onSuccess: () => {
			toast.success("Note added");
			setInputContent("");
			setActiveInput(null);
			invalidate();
		},
		onError: (e) => toast.error(e.message),
	});

	const logCallMutation = trpc.adminLeads.logCall.useMutation({
		onSuccess: () => {
			toast.success("Call logged");
			setInputContent("");
			setActiveInput(null);
			invalidate();
			onRefresh();
		},
		onError: (e) => toast.error(e.message),
	});

	const logEmailMutation = trpc.adminLeads.logEmail.useMutation({
		onSuccess: () => {
			toast.success("Email logged");
			setInputContent("");
			setActiveInput(null);
			invalidate();
		},
		onError: (e) => toast.error(e.message),
	});

	const updateStageMutation = trpc.adminLeads.update.useMutation({
		onSuccess: () => {
			toast.success("Stage updated");
			onRefresh();
			invalidate();
		},
		onError: (e) => toast.error(e.message),
	});

	const assignMutation = trpc.adminLeads.assign.useMutation({
		onSuccess: () => {
			toast.success("Lead reassigned");
			onRefresh();
			invalidate();
		},
		onError: (e) => toast.error(e.message),
	});

	if (!lead) return null;

	const formatDate = (d: Date | string | null) => {
		if (!d) return "—";
		try {
			return new Date(d).toLocaleDateString();
		} catch {
			return "—";
		}
	};

	const formatDateTime = (d: Date | string) => {
		try {
			const dt = new Date(d);
			return dt.toLocaleString(undefined, {
				month: "short",
				day: "numeric",
				year: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			});
		} catch {
			return "—";
		}
	};

	const handleSubmitAction = () => {
		if (!inputContent.trim() || !lead) return;
		if (activeInput === "note") {
			addNoteMutation.mutate({ leadId: lead.id, content: inputContent.trim() });
		} else if (activeInput === "call") {
			logCallMutation.mutate({ leadId: lead.id, content: inputContent.trim() });
		} else if (activeInput === "email") {
			logEmailMutation.mutate({
				leadId: lead.id,
				content: inputContent.trim(),
			});
		}
	};

	const isSubmitting =
		addNoteMutation.isPending ||
		logCallMutation.isPending ||
		logEmailMutation.isPending;

	const actionLabels: Record<"note" | "call" | "email", string> = {
		note: "Note",
		call: "Call Summary",
		email: "Email Summary",
	};

	const actionPlaceholders: Record<"note" | "call" | "email", string> = {
		note: "Add a note about this lead…",
		call: 'e.g. "Called John, interested in Unit 12A, will follow up Friday"',
		email: 'e.g. "Sent brochure for Breeze Hill — awaiting reply"',
	};

	return (
		<Sheet open={open} onOpenChange={(v) => !v && onClose()}>
			<SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
				<SheetHeader className="mb-4">
					<SheetTitle className="flex items-center gap-2">
						<RiUserLine size={20} />
						{lead.name}
					</SheetTitle>
					<SheetDescription>
						Lead details, activity timeline, and management actions
					</SheetDescription>
				</SheetHeader>

				{isLoading ? (
					<div className="flex items-center justify-center py-12">
						<RiLoader4Line className="size-6 animate-spin text-muted-foreground" />
					</div>
				) : (
					<div className="space-y-6">
						{/* Contact Info */}
						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-sm">Contact Info</CardTitle>
							</CardHeader>
							<CardContent className="grid grid-cols-2 gap-3 text-sm">
								<div>
									<span className="text-muted-foreground">Email</span>
									<p className="truncate font-medium">{lead.email}</p>
								</div>
								<div>
									<span className="text-muted-foreground">Phone</span>
									<p className="font-medium">{lead.phone}</p>
								</div>
								<div>
									<span className="text-muted-foreground">Source</span>
									<p className="font-medium">{lead.source}</p>
								</div>
								<div>
									<span className="text-muted-foreground">Type</span>
									<p className="font-medium capitalize">{lead.type}</p>
								</div>
								<div>
									<span className="text-muted-foreground">Property</span>
									<p className="font-medium">{lead.property}</p>
								</div>
								<div>
									<span className="text-muted-foreground">Lead Type</span>
									<p className="font-medium capitalize">{lead.leadType}</p>
								</div>
								<div>
									<span className="text-muted-foreground">Last Contact</span>
									<p className="font-medium">{formatDate(lead.lastContact)}</p>
								</div>
								<div>
									<span className="text-muted-foreground">Next Contact</span>
									<p className="font-medium">{formatDate(lead.nextContact)}</p>
								</div>
								<div>
									<span className="text-muted-foreground">Created</span>
									<p className="font-medium">{formatDate(lead.createdAt)}</p>
								</div>
								<div>
									<span className="text-muted-foreground">Assigned Agent</span>
									<p className="font-medium">
										{lead.agentName ?? "Unassigned"}
									</p>
								</div>
							</CardContent>
						</Card>

						{/* Pipeline Stage */}
						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-sm">Pipeline Stage</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="flex items-center gap-2">
									<StageBadge stage={lead.stage} />
									<StatusBadge status={lead.status} />
								</div>
								<div className="flex gap-2">
									<Select
										value={newStage || lead.stage}
										onValueChange={setNewStage}
									>
										<SelectTrigger className="flex-1">
											<SelectValue placeholder="Change stage…" />
										</SelectTrigger>
										<SelectContent>
											{PIPELINE_STAGES.map((s) => (
												<SelectItem key={s.value} value={s.value}>
													{s.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<Button
										size="sm"
										disabled={
											!newStage ||
											newStage === lead.stage ||
											updateStageMutation.isPending
										}
										onClick={() =>
											updateStageMutation.mutate({
												id: lead.id,
												stage: newStage as PipelineStageValue,
											})
										}
									>
										{updateStageMutation.isPending ? (
											<RiLoader4Line className="size-4 animate-spin" />
										) : (
											"Update"
										)}
									</Button>
								</div>
							</CardContent>
						</Card>

						{/* Assign to Agent */}
						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-sm">Assign to Agent</CardTitle>
							</CardHeader>
							<CardContent className="flex gap-2">
								<Select
									value={assignAgentId || lead.agentId || "__unassigned__"}
									onValueChange={setAssignAgentId}
								>
									<SelectTrigger className="flex-1">
										<SelectValue placeholder="Select agent…" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="__unassigned__">
											— Unassigned —
										</SelectItem>
										{agents.map((a) => (
											<SelectItem key={a.agentId} value={a.agentId}>
												{a.agentName ?? a.agentEmail}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Button
									size="sm"
									disabled={
										!assignAgentId ||
										assignAgentId === (lead.agentId ?? "__unassigned__") ||
										assignMutation.isPending
									}
									onClick={() =>
										assignMutation.mutate({
											id: lead.id,
											agentId:
												assignAgentId === "__unassigned__"
													? null
													: assignAgentId,
										})
									}
								>
									{assignMutation.isPending ? (
										<RiLoader4Line className="size-4 animate-spin" />
									) : (
										"Assign"
									)}
								</Button>
							</CardContent>
						</Card>

						{/* Tags */}
						{lead.tagNames.length > 0 && (
							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="text-sm">Tags</CardTitle>
								</CardHeader>
								<CardContent className="flex flex-wrap gap-1.5">
									{lead.tagNames.map((tag) => (
										<Badge key={tag} variant="secondary">
											{tag}
										</Badge>
									))}
								</CardContent>
							</Card>
						)}

						{/* ── Tasks & Follow-ups ── */}
						<LeadTasksCard leadId={lead.id} />

						{/* ── Activity Timeline ── */}
						<Card>
							<CardHeader className="pb-3">
								<div className="flex items-center justify-between">
									<CardTitle className="flex items-center gap-2 text-sm">
										<RiHistoryLine className="size-4" />
										Activity Timeline
									</CardTitle>
									{timeline && timeline.length > 0 && (
										<span className="text-muted-foreground text-xs">
											{timeline.length} event
											{timeline.length !== 1 ? "s" : ""}
										</span>
									)}
								</div>
								<CardDescription className="text-xs">
									Every touchpoint with this lead, newest first
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								{/* Quick-log action buttons */}
								<div className="flex flex-wrap gap-2">
									<Button
										size="sm"
										variant={activeInput === "note" ? "default" : "outline"}
										className="h-8 gap-1.5 text-xs"
										onClick={() =>
											setActiveInput(activeInput === "note" ? null : "note")
										}
									>
										<RiStickyNoteLine className="size-3.5" />
										Add Note
									</Button>
									<Button
										size="sm"
										variant={activeInput === "call" ? "default" : "outline"}
										className="h-8 gap-1.5 text-xs"
										onClick={() =>
											setActiveInput(activeInput === "call" ? null : "call")
										}
									>
										<RiPhoneLine className="size-3.5" />
										Log Call
									</Button>
									<Button
										size="sm"
										variant={activeInput === "email" ? "default" : "outline"}
										className="h-8 gap-1.5 text-xs"
										onClick={() =>
											setActiveInput(activeInput === "email" ? null : "email")
										}
									>
										<RiMailLine className="size-3.5" />
										Log Email
									</Button>
								</div>

								{/* Expandable text input */}
								{activeInput && (
									<div className="space-y-2 rounded-md border bg-muted/30 p-3">
										<p className="font-medium text-xs">
											{actionLabels[activeInput]}
										</p>
										<Textarea
											placeholder={actionPlaceholders[activeInput]}
											value={inputContent}
											onChange={(e) => setInputContent(e.target.value)}
											rows={3}
											className="resize-none bg-background"
											autoFocus
										/>
										<div className="flex gap-2">
											<Button
												size="sm"
												disabled={!inputContent.trim() || isSubmitting}
												onClick={handleSubmitAction}
											>
												{isSubmitting ? (
													<RiLoader4Line className="mr-1 size-4 animate-spin" />
												) : null}
												Save {actionLabels[activeInput]}
											</Button>
											<Button
												size="sm"
												variant="ghost"
												onClick={() => {
													setActiveInput(null);
													setInputContent("");
												}}
											>
												Cancel
											</Button>
										</div>
									</div>
								)}

							{/* Timeline feed */}
							{timelineLoading ? (
								<div className="space-y-3 pt-1">
									{[1, 2, 3].map((i) => (
										<div key={i} className="flex gap-3">
											<Skeleton className="mt-0.5 size-7 shrink-0 rounded-full" />
											<div className="flex-1 space-y-1.5 pt-1">
												<Skeleton className="h-3.5 w-28 rounded" />
												<Skeleton className="h-3 w-48 rounded" />
												<Skeleton className="h-3 w-20 rounded" />
											</div>
										</div>
									))}
								</div>
							) : timeline && timeline.length > 0 ? (
								<div className="relative">
									{/* Vertical connector line — sits behind dots */}
									<div className="absolute top-3.5 bottom-3.5 left-3.5 w-px bg-gradient-to-b from-border via-border/60 to-transparent" />
									<div className="space-y-1">
										{timeline.map((event, idx) => {
											const cfg =
												ACTIVITY_CONFIG[
													event.eventType as ActivityEventType
												] ?? ACTIVITY_CONFIG.lead_updated;
											const isLast = idx === timeline.length - 1;
											return (
												<div
													key={event.id}
													className="relative flex gap-3"
												>
													{/* Dot */}
													<div
														className={`relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-background shadow-sm ${cfg.dotColor}`}
													>
														<span className="text-white [&>svg]:size-3">
															{cfg.icon}
														</span>
													</div>
													{/* Content bubble */}
													<div
														className={`flex-1 rounded-lg border bg-muted/20 px-3 py-2 ${isLast ? "mb-0" : "mb-1"}`}
													>
														<div className="flex flex-wrap items-center gap-2">
															<ActivityEventIcon
																type={event.eventType as ActivityEventType}
															/>
															<span className="text-muted-foreground text-xs">
																by{" "}
																<span className="font-medium text-foreground">
																	{event.actorName}
																</span>
															</span>
															<span className="ml-auto shrink-0 text-muted-foreground text-xs">
																{formatDateTime(event.createdAt)}
															</span>
														</div>
														{event.content && (
															<p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
																{event.content}
															</p>
														)}
													</div>
												</div>
											);
										})}
									</div>
								</div>
							) : (
								<div className="flex flex-col items-center gap-2 py-8 text-center">
									<RiHistoryLine className="size-8 text-muted-foreground/40" />
									<p className="text-muted-foreground text-sm">
										No activity yet
									</p>
									<p className="text-muted-foreground text-xs">
										Add a note, log a call, or change the stage to start the
										timeline
									</p>
								</div>
							)}
							</CardContent>
						</Card>
					</div>
				)}
			</SheetContent>
		</Sheet>
	);
}

// ─── Edit Lead Dialog ──────────────────────────────────────────────────────────

function EditLeadDialog({
	lead,
	open,
	onClose,
	agents,
	onSuccess,
}: {
	lead: Lead | null;
	open: boolean;
	onClose: () => void;
	agents: Array<{
		agentId: string;
		agentName: string | null;
		agentEmail: string;
	}>;
	onSuccess: () => void;
}) {
	const [form, setForm] = useState({
		name: "",
		email: "",
		phone: "",
		source: "",
		type: "buyer" as "tenant" | "buyer",
		property: "",
		status: "active" as "active" | "inactive" | "pending",
		stage: "new_lead",
		leadType: "personal" as "personal" | "company",
		agentId: "",
	});

	// Debounced values for duplicate check
	const [debouncedEmail, setDebouncedEmail] = useState("");
	const [debouncedPhone, setDebouncedPhone] = useState("");

	useEffect(() => {
		const t = setTimeout(() => setDebouncedEmail(form.email.trim()), 500);
		return () => clearTimeout(t);
	}, [form.email]);

	useEffect(() => {
		const t = setTimeout(() => setDebouncedPhone(form.phone.trim()), 500);
		return () => clearTimeout(t);
	}, [form.phone]);

	const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(debouncedEmail);
	const isValidPhone = debouncedPhone.length >= 8;

	// excludeId = this lead's own ID — so its own email/phone don't flag as duplicate
	const { data: dupeCheck, isFetching: dupeChecking } =
		trpc.adminLeads.checkDuplicate.useQuery(
			{
				email: debouncedEmail,
				phone: debouncedPhone,
				excludeId: lead?.id,
			},
			{ enabled: !!lead?.id && isValidEmail && isValidPhone, staleTime: 3000 },
		);

	const hasDuplicate = !!(dupeCheck?.emailTaken || dupeCheck?.phoneTaken);

	const updateMutation = trpc.adminLeads.update.useMutation({
		onSuccess: () => {
			toast.success("Lead updated successfully");
			onSuccess();
			onClose();
		},
		onError: (e) => toast.error(e.message),
	});

	// Pre-populate form only when the dialog opens or a different lead is selected
	useEffect(() => {
		if (open && lead) {
			setForm({
				name: lead.name,
				email: lead.email,
				phone: lead.phone,
				source: lead.source,
				type: lead.type,
				property: lead.property,
				status: lead.status,
				stage: lead.stage,
				leadType: lead.leadType,
				agentId: lead.agentId ?? "__unassigned__",
			});
			// Seed debounced values immediately so the check runs on open
			setDebouncedEmail(lead.email.trim());
			setDebouncedPhone(lead.phone.trim());
		}
	}, [open, lead?.id]); // eslint-disable-line react-hooks/exhaustive-deps

	if (!lead) return null;

	const f =
		(k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
			setForm((p) => ({ ...p, [k]: e.target.value }));

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Edit Lead</DialogTitle>
					<DialogDescription>
						Update lead information — changes apply immediately.
					</DialogDescription>
				</DialogHeader>
				<div className="grid grid-cols-2 gap-4 py-2">
					<div className="space-y-1.5">
						<Label htmlFor="edit-name">Name</Label>
						<Input id="edit-name" value={form.name} onChange={f("name")} />
					</div>
					{/* Email with duplicate check */}
					<div className="space-y-1.5">
						<Label htmlFor="edit-email">Email</Label>
						<div className="relative">
							<Input
								id="edit-email"
								value={form.email}
								onChange={f("email")}
								className={
									dupeCheck?.emailTaken
										? "border-destructive pr-8 focus-visible:ring-destructive"
										: ""
								}
							/>
							{dupeChecking && isValidEmail && (
								<RiLoader4Line className="absolute top-2.5 right-2.5 size-4 animate-spin text-muted-foreground" />
							)}
						</div>
						{dupeCheck?.emailTaken && (
							<DupeError name={dupeCheck.emailConflictName} />
						)}
					</div>
					{/* Phone with duplicate check */}
					<div className="space-y-1.5">
						<Label htmlFor="edit-phone">Phone</Label>
						<div className="relative">
							<Input
								id="edit-phone"
								value={form.phone}
								onChange={f("phone")}
								className={
									dupeCheck?.phoneTaken
										? "border-destructive pr-8 focus-visible:ring-destructive"
										: ""
								}
							/>
							{dupeChecking && isValidPhone && (
								<RiLoader4Line className="absolute top-2.5 right-2.5 size-4 animate-spin text-muted-foreground" />
							)}
						</div>
						{dupeCheck?.phoneTaken && (
							<DupeError name={dupeCheck.phoneConflictName} />
						)}
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="edit-source">Source</Label>
						<Input
							id="edit-source"
							value={form.source}
							onChange={f("source")}
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="edit-property">Property</Label>
						<Input
							id="edit-property"
							value={form.property}
							onChange={f("property")}
						/>
					</div>
					<div className="space-y-1.5">
						<Label>Type</Label>
						<Select
							value={form.type}
							onValueChange={(v) =>
								setForm((p) => ({ ...p, type: v as "tenant" | "buyer" }))
							}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{TYPE_OPTIONS.map((o) => (
									<SelectItem key={o.value} value={o.value}>
										{o.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-1.5">
						<Label>Status</Label>
						<Select
							value={form.status}
							onValueChange={(v) =>
								setForm((p) => ({
									...p,
									status: v as "active" | "inactive" | "pending",
								}))
							}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{STATUS_OPTIONS.map((o) => (
									<SelectItem key={o.value} value={o.value}>
										{o.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-1.5">
						<Label>Stage</Label>
						<Select
							value={form.stage}
							onValueChange={(v) => setForm((p) => ({ ...p, stage: v }))}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{PIPELINE_STAGES.map((s) => (
									<SelectItem key={s.value} value={s.value}>
										{s.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-1.5">
						<Label>Lead Type</Label>
						<Select
							value={form.leadType}
							onValueChange={(v) =>
								setForm((p) => ({
									...p,
									leadType: v as "personal" | "company",
								}))
							}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{LEAD_TYPE_OPTIONS.map((o) => (
									<SelectItem key={o.value} value={o.value}>
										{o.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-1.5">
						<Label>Assigned Agent</Label>
						<Select
							value={form.agentId || "__unassigned__"}
							onValueChange={(v) => setForm((p) => ({ ...p, agentId: v }))}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__unassigned__">— Unassigned —</SelectItem>
								{agents.map((a) => (
									<SelectItem key={a.agentId} value={a.agentId}>
										{a.agentName ?? a.agentEmail}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				{/* Summary banner when duplicates detected */}
				{hasDuplicate && (
					<div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-destructive text-sm">
						<RiErrorWarningLine className="mt-0.5 size-4 shrink-0" />
						<span>
							Cannot save — the{" "}
							{[
								dupeCheck?.emailTaken && "email",
								dupeCheck?.phoneTaken && "phone number",
							]
								.filter(Boolean)
								.join(" and ")}{" "}
							already belong to another lead.
						</span>
					</div>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={updateMutation.isPending || hasDuplicate || dupeChecking}
						onClick={() =>
							updateMutation.mutate({
								id: lead.id,
								...form,
								agentId:
									form.agentId === "__unassigned__"
										? undefined
										: form.agentId || undefined,
								stage: form.stage as PipelineStageValue,
							})
						}
					>
						{updateMutation.isPending && (
							<RiLoader4Line className="mr-1 size-4 animate-spin" />
						)}
						Save Changes
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ─── Delete Confirm Dialog ─────────────────────────────────────────────────────

function DeleteLeadDialog({
	lead,
	open,
	onClose,
	onSuccess,
}: {
	lead: Lead | null;
	open: boolean;
	onClose: () => void;
	onSuccess: () => void;
}) {
	const deleteMutation = trpc.adminLeads.delete.useMutation({
		onSuccess: () => {
			toast.success("Lead deleted");
			onSuccess();
			onClose();
		},
		onError: (e) => toast.error(e.message),
	});

	if (!lead) return null;

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete Lead</DialogTitle>
					<DialogDescription>
						Are you sure you want to delete <strong>{lead.name}</strong>? This
						action cannot be undone and will also remove all notes.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						variant="destructive"
						disabled={deleteMutation.isPending}
						onClick={() => deleteMutation.mutate({ id: lead.id })}
					>
						{deleteMutation.isPending && (
							<RiLoader4Line className="mr-1 size-4 animate-spin" />
						)}
						Delete Lead
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ─── Duplicate Field Error ─────────────────────────────────────────────────────

function DupeError({ name }: { name: string | null }) {
	return (
		<p className="flex items-center gap-1 text-destructive text-xs">
			<RiErrorWarningLine className="size-3.5 shrink-0" />
			Already used by <strong>{name}</strong>
		</p>
	);
}

// ─── Create Lead Dialog ────────────────────────────────────────────────────────

function CreateLeadDialog({
	open,
	onClose,
	agents,
	onSuccess,
}: {
	open: boolean;
	onClose: () => void;
	agents: Array<{
		agentId: string;
		agentName: string | null;
		agentEmail: string;
	}>;
	onSuccess: () => void;
}) {
	const emptyForm = {
		name: "",
		email: "",
		phone: "",
		source: "",
		type: "buyer" as "tenant" | "buyer",
		property: "",
		status: "active" as "active" | "inactive" | "pending",
		stage: "new_lead",
		leadType: "personal" as "personal" | "company",
		agentId: "",
	};

	const [form, setForm] = useState(emptyForm);
	// Debounced values used for the duplicate query (500 ms delay)
	const [debouncedEmail, setDebouncedEmail] = useState("");
	const [debouncedPhone, setDebouncedPhone] = useState("");

	useEffect(() => {
		const t = setTimeout(() => setDebouncedEmail(form.email.trim()), 500);
		return () => clearTimeout(t);
	}, [form.email]);

	useEffect(() => {
		const t = setTimeout(() => setDebouncedPhone(form.phone.trim()), 500);
		return () => clearTimeout(t);
	}, [form.phone]);

	const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(debouncedEmail);
	const isValidPhone = debouncedPhone.length >= 8;

	const { data: dupeCheck, isFetching: dupeChecking } =
		trpc.adminLeads.checkDuplicate.useQuery(
			{ email: debouncedEmail, phone: debouncedPhone },
			{ enabled: isValidEmail && isValidPhone, staleTime: 3000 },
		);

	const hasDuplicate = !!(dupeCheck?.emailTaken || dupeCheck?.phoneTaken);

	const createMutation = trpc.adminLeads.create.useMutation({
		onSuccess: () => {
			toast.success("Lead created successfully");
			setForm(emptyForm);
			setDebouncedEmail("");
			setDebouncedPhone("");
			onSuccess();
			onClose();
		},
		onError: (e) => toast.error(e.message),
	});

	const f =
		(k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
			setForm((p) => ({ ...p, [k]: e.target.value }));

	const handleClose = () => {
		onClose();
		setForm(emptyForm);
		setDebouncedEmail("");
		setDebouncedPhone("");
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				if (!v) handleClose();
			}}
		>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Create New Lead</DialogTitle>
					<DialogDescription>
						Add a new lead to the system and optionally assign it to an agent.
					</DialogDescription>
				</DialogHeader>
				<div className="grid grid-cols-2 gap-4 py-2">
					<div className="space-y-1.5">
						<Label htmlFor="create-name">Name *</Label>
						<Input
							id="create-name"
							value={form.name}
							onChange={f("name")}
							placeholder="Full name"
						/>
					</div>
					{/* Email with duplicate check */}
					<div className="space-y-1.5">
						<Label htmlFor="create-email">Email *</Label>
						<div className="relative">
							<Input
								id="create-email"
								value={form.email}
								onChange={f("email")}
								placeholder="email@example.com"
								className={
									dupeCheck?.emailTaken
										? "border-destructive pr-8 focus-visible:ring-destructive"
										: ""
								}
							/>
							{dupeChecking && isValidEmail && (
								<RiLoader4Line className="absolute top-2.5 right-2.5 size-4 animate-spin text-muted-foreground" />
							)}
						</div>
						{dupeCheck?.emailTaken && (
							<DupeError name={dupeCheck.emailConflictName} />
						)}
					</div>
					{/* Phone with duplicate check */}
					<div className="space-y-1.5">
						<Label htmlFor="create-phone">Phone *</Label>
						<div className="relative">
							<Input
								id="create-phone"
								value={form.phone}
								onChange={f("phone")}
								placeholder="+60 12-345 6789"
								className={
									dupeCheck?.phoneTaken
										? "border-destructive pr-8 focus-visible:ring-destructive"
										: ""
								}
							/>
							{dupeChecking && isValidPhone && (
								<RiLoader4Line className="absolute top-2.5 right-2.5 size-4 animate-spin text-muted-foreground" />
							)}
						</div>
						{dupeCheck?.phoneTaken && (
							<DupeError name={dupeCheck.phoneConflictName} />
						)}
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="create-source">Source *</Label>
						<Input
							id="create-source"
							value={form.source}
							onChange={f("source")}
							placeholder="e.g. Website, Social Media"
						/>
					</div>
					<div className="col-span-2 space-y-1.5">
						<Label htmlFor="create-property">Property Interest *</Label>
						<Input
							id="create-property"
							value={form.property}
							onChange={f("property")}
							placeholder="Property name or description"
						/>
					</div>
					<div className="space-y-1.5">
						<Label>Type</Label>
						<Select
							value={form.type}
							onValueChange={(v) =>
								setForm((p) => ({ ...p, type: v as "tenant" | "buyer" }))
							}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{TYPE_OPTIONS.map((o) => (
									<SelectItem key={o.value} value={o.value}>
										{o.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-1.5">
						<Label>Status</Label>
						<Select
							value={form.status}
							onValueChange={(v) =>
								setForm((p) => ({
									...p,
									status: v as "active" | "inactive" | "pending",
								}))
							}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{STATUS_OPTIONS.map((o) => (
									<SelectItem key={o.value} value={o.value}>
										{o.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-1.5">
						<Label>Pipeline Stage</Label>
						<Select
							value={form.stage}
							onValueChange={(v) => setForm((p) => ({ ...p, stage: v }))}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{PIPELINE_STAGES.map((s) => (
									<SelectItem key={s.value} value={s.value}>
										{s.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-1.5">
						<Label>Lead Type</Label>
						<Select
							value={form.leadType}
							onValueChange={(v) =>
								setForm((p) => ({
									...p,
									leadType: v as "personal" | "company",
								}))
							}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{LEAD_TYPE_OPTIONS.map((o) => (
									<SelectItem key={o.value} value={o.value}>
										{o.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-1.5">
						<Label>Assign to Agent</Label>
						<Select
							value={form.agentId || "__unassigned__"}
							onValueChange={(v) => setForm((p) => ({ ...p, agentId: v }))}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__unassigned__">— Unassigned —</SelectItem>
								{agents.map((a) => (
									<SelectItem key={a.agentId} value={a.agentId}>
										{a.agentName ?? a.agentEmail}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				{/* Summary banner when duplicates detected */}
				{hasDuplicate && (
					<div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-destructive text-sm">
						<RiErrorWarningLine className="mt-0.5 size-4 shrink-0" />
						<span>
							This lead cannot be saved — the{" "}
							{[
								dupeCheck?.emailTaken && "email",
								dupeCheck?.phoneTaken && "phone number",
							]
								.filter(Boolean)
								.join(" and ")}{" "}
							already exist in the system.
						</span>
					</div>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={handleClose}>
						Cancel
					</Button>
					<Button
						disabled={
							createMutation.isPending ||
							hasDuplicate ||
							dupeChecking ||
							!form.name ||
							!form.email ||
							!form.phone ||
							!form.source ||
							!form.property
						}
						onClick={() =>
							createMutation.mutate({
								...form,
								agentId:
									form.agentId === "__unassigned__"
										? undefined
										: form.agentId || undefined,
								stage: form.stage as PipelineStageValue,
							})
						}
					>
						{createMutation.isPending ? (
							<RiLoader4Line className="mr-1 size-4 animate-spin" />
						) : (
							<RiAddLine size={16} className="mr-1" />
						)}
						Create Lead
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ─── Bulk Stage Dialog ─────────────────────────────────────────────────────────

function BulkStageDialog({
	selectedIds,
	open,
	onClose,
	onSuccess,
}: {
	selectedIds: string[];
	open: boolean;
	onClose: () => void;
	onSuccess: () => void;
}) {
	const [stage, setStage] = useState("");

	const bulkMutation = trpc.adminLeads.bulkUpdateStage.useMutation({
		onSuccess: (data) => {
			toast.success(`Updated ${data.updated} lead(s)`);
			setStage("");
			onSuccess();
			onClose();
		},
		onError: (e) => toast.error(e.message),
	});

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Bulk Update Stage</DialogTitle>
					<DialogDescription>
						Move {selectedIds.length} selected lead(s) to a new pipeline stage.
					</DialogDescription>
				</DialogHeader>
				<Select value={stage} onValueChange={setStage}>
					<SelectTrigger>
						<SelectValue placeholder="Select new stage…" />
					</SelectTrigger>
					<SelectContent>
						{PIPELINE_STAGES.map((s) => (
							<SelectItem key={s.value} value={s.value}>
								{s.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={!stage || bulkMutation.isPending}
						onClick={() =>
							bulkMutation.mutate({
								ids: selectedIds,
								stage: stage as PipelineStageValue,
							})
						}
					>
						{bulkMutation.isPending && (
							<RiLoader4Line className="mr-1 size-4 animate-spin" />
						)}
						Apply
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ─── Stats Cards ───────────────────────────────────────────────────────────────

function StatsCards({
	leads,
	isLoading,
}: {
	leads: Lead[];
	isLoading: boolean;
}) {
	const stats = useMemo(() => {
		const total = leads.length;
		const active = leads.filter((l) => l.status === "active").length;
		const pending = leads.filter((l) => l.status === "pending").length;
		const inactive = leads.filter((l) => l.status === "inactive").length;
		const unclaimedCompany = leads.filter(
			(l) => l.leadType === "company" && !l.agentId,
		).length;
		const bookingsMade = leads.filter((l) => l.stage === "booking_made").length;
		const buyers = leads.filter((l) => l.type === "buyer").length;
		const tenants = leads.filter((l) => l.type === "tenant").length;
		const uniqueAgents = new Set(leads.map((l) => l.agentId).filter(Boolean))
			.size;
		return {
			total,
			active,
			pending,
			inactive,
			unclaimedCompany,
			bookingsMade,
			buyers,
			tenants,
			uniqueAgents,
		};
	}, [leads]);

	if (isLoading) {
		return (
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{[...Array(4)].map((_, i) => (
					<Card key={i} className="overflow-hidden">
						<CardHeader className="pb-2">
							<Skeleton className="h-3.5 w-28" />
							<Skeleton className="mt-2 h-9 w-16" />
						</CardHeader>
						<CardContent className="space-y-2">
							<Skeleton className="h-1.5 w-full rounded-full" />
							<Skeleton className="h-3 w-36" />
						</CardContent>
					</Card>
				))}
			</div>
		);
	}

	const activeRate = stats.total
		? Math.round((stats.active / stats.total) * 100)
		: 0;
	const bookingRate = stats.total
		? Math.round((stats.bookingsMade / stats.total) * 100)
		: 0;

	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<Card className="overflow-hidden">
				<CardHeader className="pb-2">
					<CardDescription>Total Leads</CardDescription>
					<CardTitle className="text-3xl">{stats.total}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-primary transition-all duration-500"
							style={{ width: "100%" }}
						/>
					</div>
					<p className="text-muted-foreground text-xs">
						{stats.buyers} buyers · {stats.tenants} tenants
					</p>
				</CardContent>
			</Card>
			<Card className="overflow-hidden">
				<CardHeader className="pb-2">
					<CardDescription>Active Leads</CardDescription>
					<CardTitle className="text-3xl">{stats.active}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-green-500 transition-all duration-500"
							style={{ width: `${activeRate}%` }}
						/>
					</div>
					<p className="text-muted-foreground text-xs">
						{activeRate}% active · {stats.pending} pending · {stats.inactive}{" "}
						inactive
					</p>
				</CardContent>
			</Card>
			<Card className="overflow-hidden">
				<CardHeader className="pb-2">
					<CardDescription>Bookings Made</CardDescription>
					<CardTitle className="text-3xl">{stats.bookingsMade}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-emerald-500 transition-all duration-500"
							style={{ width: `${bookingRate}%` }}
						/>
					</div>
					<p className="text-muted-foreground text-xs">
						{bookingRate}% conversion · {stats.unclaimedCompany} unclaimed co.
					</p>
				</CardContent>
			</Card>
			<Card className="overflow-hidden">
				<CardHeader className="pb-2">
					<CardDescription>Agents With Leads</CardDescription>
					<CardTitle className="text-3xl">{stats.uniqueAgents}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-blue-500 transition-all duration-500"
							style={{ width: stats.uniqueAgents ? "75%" : "0%" }}
						/>
					</div>
					<p className="text-muted-foreground text-xs">
						{stats.total} total leads tracked
					</p>
				</CardContent>
			</Card>
		</div>
	);
}

// ─── Charts Section ────────────────────────────────────────────────────────────

const CHART_COLORS = [
	"#60a5fa", // blue-400   - new_lead
	"#fbbf24", // amber-400  - follow_up_in_progress
	"#94a3b8", // slate-400  - no_pick_reply
	"#c084fc", // purple-400 - follow_up_for_appointment
	"#2dd4bf", // teal-400   - potential_lead
	"#fb923c", // orange-400 - consider_seen
	"#4ade80", // green-400  - appointment_made
	"#f87171", // red-400    - reject_project
	"#34d399", // emerald-400- booking_made
	"#f472b6", // pink-400   - spam_fake_lead
];

// Axis tick color — a fixed light-gray that looks sharp in both light and dark
const TICK_COLOR = "#94a3b8"; // slate-400

// Custom tooltip for area chart
function AreaTooltip({
	active,
	payload,
	label,
}: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
	if (!active || !payload?.length) return null;
	return (
		<div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
			<p className="mb-1 font-semibold text-foreground text-xs">{label}</p>
			<p className="text-muted-foreground text-xs">
				<span className="font-bold text-blue-400">{payload[0].value}</span>{" "}
				leads
			</p>
		</div>
	);
}

// Custom tooltip for pie/donut chart
function PieTooltip({
	active,
	payload,
}: {
	active?: boolean;
	payload?: Array<{ name: string; value: number; payload: { color: string } }>;
}) {
	if (!active || !payload?.length) return null;
	const item = payload[0];
	return (
		<div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
			<div className="flex items-center gap-2">
				<span
					className="size-2.5 shrink-0 rounded-full"
					style={{ backgroundColor: item.payload.color }}
				/>
				<p className="font-semibold text-foreground text-xs">{item.name}</p>
			</div>
			<p className="mt-0.5 text-muted-foreground text-xs">
				<span className="font-bold text-foreground">{item.value}</span> leads
			</p>
		</div>
	);
}

function LeadsCharts({
	leads,
	isLoading,
}: { leads: Lead[]; isLoading: boolean }) {
	const { stageData, monthlyData } = useMemo(() => {
		// Stage distribution — attach color to each datum for the custom tooltip
		const stageCounts: Record<string, number> = {};
		for (const lead of leads) {
			stageCounts[lead.stage] = (stageCounts[lead.stage] ?? 0) + 1;
		}
		const stageData = PIPELINE_STAGES.map((s, i) => ({
			name: s.label,
			value: stageCounts[s.value] ?? 0,
			color: CHART_COLORS[i % CHART_COLORS.length],
		})).filter((s) => s.value > 0);

		// Monthly trend (last 6 months)
		const now = new Date();
		const months: { key: string; label: string }[] = [];
		for (let i = 5; i >= 0; i--) {
			const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
			months.push({
				key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
				label: d.toLocaleDateString("en", { month: "short", year: "2-digit" }),
			});
		}
		const monthlyCounts: Record<string, number> = {};
		for (const lead of leads) {
			const d = new Date(lead.createdAt);
			const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
			monthlyCounts[key] = (monthlyCounts[key] ?? 0) + 1;
		}
		const monthlyData = months.map((m) => ({
			month: m.label,
			leads: monthlyCounts[m.key] ?? 0,
		}));

		return { stageData, monthlyData };
	}, [leads]);

	const totalLeads = stageData.reduce((s, d) => s + d.value, 0);

	if (isLoading) {
		return (
			<div className="grid gap-4 lg:grid-cols-3">
				<Card className="lg:col-span-2">
					<CardHeader className="pb-3">
						<Skeleton className="h-4 w-40" />
						<Skeleton className="h-3 w-56" />
					</CardHeader>
					<CardContent>
						<Skeleton className="h-[200px] w-full rounded-lg" />
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-3">
						<Skeleton className="h-4 w-36" />
						<Skeleton className="h-3 w-48" />
					</CardHeader>
					<CardContent className="flex items-center justify-center">
						<Skeleton className="h-[180px] w-[180px] rounded-full" />
					</CardContent>
				</Card>
			</div>
		);
	}

	if (leads.length === 0) return null;

	return (
		<div className="grid gap-4 lg:grid-cols-3">
			{/* ── Monthly trend — area chart ── */}
			<Card className="lg:col-span-2">
				<CardHeader className="pb-2">
					<div className="flex items-center gap-2">
						<RiBarChartLine size={16} className="text-blue-400" />
						<CardTitle className="font-semibold text-sm">
							Monthly Lead Trend
						</CardTitle>
					</div>
					<CardDescription className="text-xs">
						Leads created over the last 6 months
					</CardDescription>
				</CardHeader>
				<CardContent className="pr-4 pb-4 pl-0">
					<ResponsiveContainer width="100%" height={210}>
						<AreaChart
							data={monthlyData}
							margin={{ top: 8, right: 8, bottom: 0, left: 4 }}
						>
							<defs>
								<linearGradient id="leadsGradient" x1="0" y1="0" x2="0" y2="1">
									<stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
									<stop offset="95%" stopColor="#60a5fa" stopOpacity={0.02} />
								</linearGradient>
							</defs>
							<XAxis
								dataKey="month"
								tick={{ fontSize: 12, fill: TICK_COLOR, fontWeight: 500 }}
								axisLine={{ stroke: "#334155" }}
								tickLine={false}
								dy={6}
							/>
							<YAxis
								tick={{ fontSize: 12, fill: TICK_COLOR, fontWeight: 500 }}
								axisLine={false}
								tickLine={false}
								allowDecimals={false}
								width={32}
							/>
							{/* @ts-ignore — recharts custom tooltip */}
							<Tooltip
								content={<AreaTooltip />}
								cursor={{
									stroke: "#60a5fa",
									strokeWidth: 1,
									strokeDasharray: "4 4",
								}}
							/>
							<Area
								type="monotone"
								dataKey="leads"
								stroke="#60a5fa"
								strokeWidth={2.5}
								fill="url(#leadsGradient)"
								dot={{
									r: 4,
									fill: "#60a5fa",
									stroke: "#1e3a5f",
									strokeWidth: 2,
								}}
								activeDot={{
									r: 6,
									fill: "#60a5fa",
									stroke: "#fff",
									strokeWidth: 2,
								}}
							/>
						</AreaChart>
					</ResponsiveContainer>
				</CardContent>
			</Card>

			{/* ── Stage distribution — donut chart ── */}
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="font-semibold text-sm">
						Stage Distribution
					</CardTitle>
					<CardDescription className="text-xs">
						Leads by pipeline stage
					</CardDescription>
				</CardHeader>
				<CardContent className="pb-3">
					{/* Donut + center label */}
					<div className="relative">
						<ResponsiveContainer width="100%" height={180}>
							<PieChart>
								<Pie
									data={stageData}
									cx="50%"
									cy="50%"
									innerRadius={54}
									outerRadius={80}
									paddingAngle={3}
									dataKey="value"
									strokeWidth={0}
								>
									{stageData.map((entry, idx) => (
										<Cell key={`cell-${idx}`} fill={entry.color} />
									))}
								</Pie>
								{/* @ts-ignore */}
								<Tooltip content={<PieTooltip />} />
							</PieChart>
						</ResponsiveContainer>
						{/* Center total */}
						<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
							<span className="font-bold text-2xl text-foreground leading-none">
								{totalLeads}
							</span>
							<span className="mt-0.5 text-muted-foreground text-xs">
								total
							</span>
						</div>
					</div>

					{/* Legend — all visible stages */}
					<div className="mt-2 space-y-1.5">
						{stageData.map((s) => {
							const pct = totalLeads
								? Math.round((s.value / totalLeads) * 100)
								: 0;
							return (
								<div key={s.name} className="flex items-center gap-2">
									<span
										className="size-2.5 shrink-0 rounded-sm"
										style={{ backgroundColor: s.color }}
									/>
									<span
										className="min-w-0 flex-1 truncate font-medium text-foreground/90 text-xs"
										title={s.name}
									>
										{s.name}
									</span>
									<span className="shrink-0 text-muted-foreground text-xs">
										{pct}%
									</span>
									<span className="w-5 shrink-0 text-right font-semibold text-foreground text-xs">
										{s.value}
									</span>
								</div>
							);
						})}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

// ─── Sort Header Cell ──────────────────────────────────────────────────────────

function SortHeader({
	label,
	sortKey,
	current,
	order,
	onSort,
}: {
	label: string;
	sortKey: SortKey;
	current: SortKey;
	order: "asc" | "desc";
	onSort: (k: SortKey) => void;
}) {
	const active = current === sortKey;
	return (
		<TableHead
			className="cursor-pointer select-none hover:text-foreground"
			onClick={() => onSort(sortKey)}
		>
			<div className="flex items-center gap-1">
				{label}
				{active ? (
					order === "asc" ? (
						<RiArrowUpLine size={13} className="text-primary" />
					) : (
						<RiArrowDownLine size={13} className="text-primary" />
					)
				) : (
					<RiArrowDownLine size={13} className="text-muted-foreground/40" />
				)}
			</div>
		</TableHead>
	);
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminLeadsPage() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { data: session, isPending } = authClient.useSession();

	// ── Filters (all client-side, no backend re-fetch) ──────────────────────
	const [search, setSearch] = useState("");
	const [typeFilter, setTypeFilter] = useState("__all__");
	const [statusFilter, setStatusFilter] = useState("__all__");
	const [stageFilter, setStageFilter] = useState("__all__");
	const [leadTypeFilter, setLeadTypeFilter] = useState("__all__");
	const [agentFilter, setAgentFilter] = useState("__all__");
	const [sortKey, setSortKey] = useState<SortKey>("createdAt");
	const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);

	// ── Dialogs ────────────────────────────────────────────────────────────
	const [viewLead, setViewLead] = useState<Lead | null>(null);
	const [editLead, setEditLead] = useState<Lead | null>(null);
	const [deleteLead, setDeleteLead] = useState<Lead | null>(null);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isBulkStageOpen, setIsBulkStageOpen] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

	// ── Fetch ALL leads ONCE — no filter params sent to backend ─────────────
	// Backend returns the full dataset; all filtering/sorting/pagination
	// happens here on the client via useMemo (zero extra network requests).
	const {
		data: rawData,
		isLoading,
		refetch,
	} = trpc.adminLeads.list.useQuery(
		{ limit: 5000, page: 1 }, // fetch entire dataset in one shot
		{ enabled: !!session, staleTime: 60 * 1000 },
	);

	const { data: agentsData } = trpc.adminLeads.agentsWithLeads.useQuery(
		undefined,
		{ enabled: !!session, staleTime: 60 * 1000 },
	);

	const allLeads = (rawData?.leads ?? []) as Lead[];
	const agents = agentsData ?? [];

	// ── Sort handler (just updates state, no API call) ──────────────────────
	// Read sortKey directly from closure — avoids unreliable nested state setters
	const handleSort = useCallback(
		(key: SortKey) => {
			if (sortKey === key) {
				// Same column → toggle direction
				setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
			} else {
				// New column → default ascending
				setSortKey(key);
				setSortOrder("asc");
			}
			setPage(1);
		},
		[sortKey],
	);

	// ── All filtering + sorting + pagination via useMemo ────────────────────
	// Runs entirely in memory — instant, no network round-trips
	const { visibleLeads, totalFiltered } = useMemo(() => {
		const q = search.toLowerCase().trim();

		// 1. Filter
		let filtered = allLeads.filter((lead) => {
			if (
				q &&
				!(
					lead.name.toLowerCase().includes(q) ||
					lead.email.toLowerCase().includes(q) ||
					lead.phone.toLowerCase().includes(q) ||
					lead.property.toLowerCase().includes(q)
				)
			)
				return false;

			if (typeFilter !== "__all__" && lead.type !== typeFilter) return false;
			if (statusFilter !== "__all__" && lead.status !== statusFilter)
				return false;
			if (stageFilter !== "__all__" && lead.stage !== stageFilter) return false;
			if (leadTypeFilter !== "__all__" && lead.leadType !== leadTypeFilter)
				return false;

			if (agentFilter !== "__all__") {
				if (agentFilter === "__unassigned__") {
					if (lead.agentId) return false;
				} else {
					if (lead.agentId !== agentFilter) return false;
				}
			}

			return true;
		});

		// 2. Sort
		filtered = [...filtered].sort((a, b) => {
			let valA: string | number | Date;
			let valB: string | number | Date;

			if (sortKey === "createdAt" || sortKey === "updatedAt") {
				valA = new Date(a[sortKey]).getTime();
				valB = new Date(b[sortKey]).getTime();
			} else if (sortKey === "agentName") {
				valA = (a.agentName ?? "").toLowerCase();
				valB = (b.agentName ?? "").toLowerCase();
			} else {
				valA = String(a[sortKey] ?? "").toLowerCase();
				valB = String(b[sortKey] ?? "").toLowerCase();
			}

			if (valA < valB) return sortOrder === "asc" ? -1 : 1;
			if (valA > valB) return sortOrder === "asc" ? 1 : -1;
			return 0;
		});

		const totalFiltered = filtered.length;

		// 3. Paginate
		const start = (page - 1) * pageSize;
		const visibleLeads = filtered.slice(start, start + pageSize);

		return { visibleLeads, totalFiltered };
	}, [
		allLeads,
		search,
		typeFilter,
		statusFilter,
		stageFilter,
		leadTypeFilter,
		agentFilter,
		sortKey,
		sortOrder,
		page,
		pageSize,
	]);

	const totalPages = Math.ceil(totalFiltered / pageSize);

	// Reset page when filters change
	const setFilter = useCallback(
		(setter: React.Dispatch<React.SetStateAction<string>>) => (v: string) => {
			setter(v);
			setPage(1);
		},
		[],
	);

	const resetFilters = () => {
		setSearch("");
		setTypeFilter("__all__");
		setStatusFilter("__all__");
		setStageFilter("__all__");
		setLeadTypeFilter("__all__");
		setAgentFilter("__all__");
		setPage(1);
	};

	const hasFilters =
		search ||
		typeFilter !== "__all__" ||
		statusFilter !== "__all__" ||
		stageFilter !== "__all__" ||
		leadTypeFilter !== "__all__" ||
		agentFilter !== "__all__";

	const handleRefresh = () => {
		refetch();
		queryClient.invalidateQueries({ queryKey: [["adminLeads"]] });
		setSelectedIds(new Set());
	};

	// Selection
	const allSelected =
		visibleLeads.length > 0 && visibleLeads.every((l) => selectedIds.has(l.id));
	const toggleSelectAll = () => {
		if (allSelected) setSelectedIds(new Set());
		else setSelectedIds(new Set(visibleLeads.map((l) => l.id)));
	};
	const toggleSelect = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	// Guard
	if (isPending) {
		return (
			<div className="flex h-screen items-center justify-center">
				<RiLoader4Line className="size-8 animate-spin text-primary" />
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
				{/* Header */}
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
										<span className="sr-only">Dashboard</span>
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator className="hidden md:block" />
								<BreadcrumbItem className="hidden md:block">
									<BreadcrumbLink
										href="/admin"
										className="flex items-center gap-1"
									>
										<RiShieldUserLine size={16} />
										Admin Portal
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator className="hidden md:block" />
								<BreadcrumbItem>
									<BreadcrumbPage className="flex items-center gap-2">
										<RiFileList3Line size={20} aria-hidden="true" />
										Leads Management
									</BreadcrumbPage>
								</BreadcrumbItem>
							</BreadcrumbList>
						</Breadcrumb>
					</div>
					<div className="ml-auto flex gap-3">
						<HeaderActions />
					</div>
				</header>

				<div className="flex flex-1 flex-col gap-6 py-6">
					{/* Page Title */}
					<div className="flex items-center justify-between">
						<div>
							<h1 className="font-bold text-2xl tracking-tight">
								Leads Management
							</h1>
							{isLoading ? (
								<Skeleton className="mt-1.5 h-4 w-64" />
							) : (
								<p className="mt-0.5 text-muted-foreground text-sm">
									{allLeads.length} leads loaded · filters &amp; sorting are
									instant
								</p>
							)}
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={handleRefresh}
								disabled={isLoading}
							>
								<RiRefreshLine size={16} className="mr-1.5" />
								Refresh
							</Button>
							<Button size="sm" onClick={() => setIsCreateOpen(true)}>
								<RiAddLine size={16} className="mr-1.5" />
								New Lead
							</Button>
						</div>
					</div>

				{/* Stats */}
				<StatsCards leads={allLeads} isLoading={isLoading} />

				{/* Charts */}
				<LeadsCharts leads={allLeads} isLoading={isLoading} />

				{/* Today's Tasks */}
				<TodayTasksWidget
					onViewLead={(leadId) => {
						const lead = allLeads.find((l) => l.id === leadId);
						if (lead) setViewLead(lead);
					}}
				/>

				{/* Table */}
					<Card className="overflow-hidden">
						{/* ── Toolbar ── */}
						<div className="flex flex-col gap-2 border-b px-4 py-3">
							{/* Row 1: search + filters */}
							<div className="flex flex-wrap items-center gap-2">
								{/* Search */}
								<div className="relative min-w-[220px] flex-1">
									<RiSearchLine className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
									<Input
										placeholder="Search name, email, phone, property…"
										value={search}
										onChange={(e) => {
											setSearch(e.target.value);
											setPage(1);
										}}
										className="h-9 pl-9 text-sm"
									/>
								</div>

								{/* Divider */}
								<div className="hidden h-6 w-px bg-border sm:block" />

								{/* Filter dropdowns */}
								<div className="flex flex-wrap items-center gap-2">
									<Select
										value={agentFilter}
										onValueChange={setFilter(setAgentFilter)}
									>
										<SelectTrigger className="h-9 w-[130px] text-xs">
											<RiUserLine
												size={13}
												className="mr-1.5 shrink-0 text-muted-foreground"
											/>
											<SelectValue placeholder="Agent" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="__all__">All Agents</SelectItem>
											<SelectItem value="__unassigned__">Unassigned</SelectItem>
											{agents.map((a) => (
												<SelectItem key={a.agentId} value={a.agentId}>
													{a.agentName ?? a.agentEmail}
												</SelectItem>
											))}
										</SelectContent>
									</Select>

									<Select
										value={stageFilter}
										onValueChange={setFilter(setStageFilter)}
									>
										<SelectTrigger className="h-9 w-[140px] text-xs">
											<SelectValue placeholder="Stage" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="__all__">All Stages</SelectItem>
											{PIPELINE_STAGES.map((s) => (
												<SelectItem key={s.value} value={s.value}>
													{s.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>

									<Select
										value={statusFilter}
										onValueChange={setFilter(setStatusFilter)}
									>
										<SelectTrigger className="h-9 w-[120px] text-xs">
											<SelectValue placeholder="Status" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="__all__">All Statuses</SelectItem>
											{STATUS_OPTIONS.map((o) => (
												<SelectItem key={o.value} value={o.value}>
													{o.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>

									<Select
										value={typeFilter}
										onValueChange={setFilter(setTypeFilter)}
									>
										<SelectTrigger className="h-9 w-[110px] text-xs">
											<SelectValue placeholder="Type" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="__all__">All Types</SelectItem>
											{TYPE_OPTIONS.map((o) => (
												<SelectItem key={o.value} value={o.value}>
													{o.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>

									<Select
										value={leadTypeFilter}
										onValueChange={setFilter(setLeadTypeFilter)}
									>
										<SelectTrigger className="h-9 w-[120px] text-xs">
											<SelectValue placeholder="Lead Type" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="__all__">All Lead Types</SelectItem>
											{LEAD_TYPE_OPTIONS.map((o) => (
												<SelectItem key={o.value} value={o.value}>
													{o.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>

									{hasFilters && (
										<Button
											variant="ghost"
											size="sm"
											className="h-9 gap-1.5 text-muted-foreground text-xs hover:text-foreground"
											onClick={resetFilters}
										>
											<RiCloseLine size={13} />
											Clear filters
										</Button>
									)}
								</div>
							</div>

							{/* Row 2: active filter chips + result count + bulk actions */}
							<div className="flex items-center justify-between gap-2">
								<div className="flex flex-wrap items-center gap-1.5">
									{agentFilter !== "__all__" && (
										<span className="inline-flex items-center gap-1 rounded-md border bg-muted/60 px-2 py-0.5 text-xs">
											Agent:{" "}
											<span className="font-medium">
												{agentFilter === "__unassigned__"
													? "Unassigned"
													: (agents.find((a) => a.agentId === agentFilter)
															?.agentName ?? agentFilter)}
											</span>
											<button
												type="button"
												onClick={() => {
													setAgentFilter("__all__");
													setPage(1);
												}}
												className="ml-0.5 rounded-sm opacity-60 hover:opacity-100"
											>
												<RiCloseLine size={11} />
											</button>
										</span>
									)}
									{stageFilter !== "__all__" && (
										<span className="inline-flex items-center gap-1 rounded-md border bg-muted/60 px-2 py-0.5 text-xs">
											Stage:{" "}
											<span className="font-medium">
												{stageMap[stageFilter]?.label ?? stageFilter}
											</span>
											<button
												type="button"
												onClick={() => {
													setStageFilter("__all__");
													setPage(1);
												}}
												className="ml-0.5 rounded-sm opacity-60 hover:opacity-100"
											>
												<RiCloseLine size={11} />
											</button>
										</span>
									)}
									{statusFilter !== "__all__" && (
										<span className="inline-flex items-center gap-1 rounded-md border bg-muted/60 px-2 py-0.5 text-xs">
											Status:{" "}
											<span className="font-medium capitalize">
												{statusFilter}
											</span>
											<button
												type="button"
												onClick={() => {
													setStatusFilter("__all__");
													setPage(1);
												}}
												className="ml-0.5 rounded-sm opacity-60 hover:opacity-100"
											>
												<RiCloseLine size={11} />
											</button>
										</span>
									)}
									{typeFilter !== "__all__" && (
										<span className="inline-flex items-center gap-1 rounded-md border bg-muted/60 px-2 py-0.5 text-xs">
											Type:{" "}
											<span className="font-medium capitalize">
												{typeFilter}
											</span>
											<button
												type="button"
												onClick={() => {
													setTypeFilter("__all__");
													setPage(1);
												}}
												className="ml-0.5 rounded-sm opacity-60 hover:opacity-100"
											>
												<RiCloseLine size={11} />
											</button>
										</span>
									)}
									{leadTypeFilter !== "__all__" && (
										<span className="inline-flex items-center gap-1 rounded-md border bg-muted/60 px-2 py-0.5 text-xs">
											Lead Type:{" "}
											<span className="font-medium capitalize">
												{leadTypeFilter}
											</span>
											<button
												type="button"
												onClick={() => {
													setLeadTypeFilter("__all__");
													setPage(1);
												}}
												className="ml-0.5 rounded-sm opacity-60 hover:opacity-100"
											>
												<RiCloseLine size={11} />
											</button>
										</span>
									)}
									{search && (
										<span className="inline-flex items-center gap-1 rounded-md border bg-muted/60 px-2 py-0.5 text-xs">
											Search:{" "}
											<span className="font-medium">
												&ldquo;{search}&rdquo;
											</span>
											<button
												type="button"
												onClick={() => {
													setSearch("");
													setPage(1);
												}}
												className="ml-0.5 rounded-sm opacity-60 hover:opacity-100"
											>
												<RiCloseLine size={11} />
											</button>
										</span>
									)}
								</div>

								{/* Right side: count + bulk */}
								<div className="flex shrink-0 items-center gap-2">
									{selectedIds.size > 0 && (
										<>
											<span className="flex items-center gap-1.5 text-muted-foreground text-xs">
												<RiCheckboxMultipleLine
													size={13}
													className="text-primary"
												/>
												<span className="font-medium text-foreground">
													{selectedIds.size}
												</span>{" "}
												selected
											</span>
											<Button
												size="sm"
												variant="outline"
												className="h-7 text-xs"
												onClick={() => setIsBulkStageOpen(true)}
											>
												Update Stage
											</Button>
											<Button
												size="sm"
												variant="ghost"
												className="h-7 text-xs"
												onClick={() => setSelectedIds(new Set())}
											>
												<RiCloseLine size={13} className="mr-1" />
												Deselect
											</Button>
											<div className="h-4 w-px bg-border" />
										</>
									)}
									<span className="text-muted-foreground text-xs">
										{isLoading ? (
											"Loading…"
										) : totalFiltered === allLeads.length ? (
											<>
												Total leads:{" "}
												<span className="font-medium text-foreground">
													{totalFiltered}
												</span>
											</>
										) : (
											<>
												<span className="font-medium text-foreground">
													{totalFiltered}
												</span>{" "}
												of {allLeads.length} leads
											</>
										)}
									</span>
								</div>
							</div>
						</div>
						<CardContent className="p-0">
							{isLoading ? (
								<div className="overflow-x-auto">
									<Table>
										<TableHeader>
											<TableRow className="hover:bg-transparent">
												<TableHead className="w-10 pl-4">
													<Skeleton className="h-4 w-4 rounded" />
												</TableHead>
												<TableHead>
													<Skeleton className="h-3.5 w-12" />
												</TableHead>
												<TableHead className="hidden md:table-cell">
													<Skeleton className="h-3.5 w-16" />
												</TableHead>
												<TableHead className="hidden lg:table-cell">
													<Skeleton className="h-3.5 w-16" />
												</TableHead>
												<TableHead>
													<Skeleton className="h-3.5 w-12" />
												</TableHead>
												<TableHead>
													<Skeleton className="h-3.5 w-14" />
												</TableHead>
												<TableHead>
													<Skeleton className="h-3.5 w-12" />
												</TableHead>
												<TableHead className="hidden xl:table-cell">
													<Skeleton className="h-3.5 w-10" />
												</TableHead>
												<TableHead>
													<Skeleton className="h-3.5 w-16" />
												</TableHead>
												<TableHead className="w-[100px]" />
											</TableRow>
										</TableHeader>
										<TableBody>
											{[...Array(8)].map((_, i) => (
												<TableRow key={i} className="hover:bg-transparent">
													<TableCell className="pl-4">
														<Skeleton className="h-4 w-4 rounded" />
													</TableCell>
													<TableCell>
														<Skeleton className="mb-1 h-4 w-28" />
														<Skeleton className="h-3 w-36 md:hidden" />
													</TableCell>
													<TableCell className="hidden md:table-cell">
														<Skeleton className="mb-1 h-3.5 w-36" />
														<Skeleton className="h-3 w-24" />
													</TableCell>
													<TableCell className="hidden lg:table-cell">
														<Skeleton className="h-3.5 w-28" />
													</TableCell>
													<TableCell>
														<Skeleton className="h-5 w-24 rounded-full" />
													</TableCell>
													<TableCell>
														<Skeleton className="h-5 w-16 rounded-full" />
													</TableCell>
													<TableCell>
														<Skeleton className="h-3.5 w-20" />
													</TableCell>
													<TableCell className="hidden xl:table-cell">
														<Skeleton className="mb-1 h-3 w-12" />
														<Skeleton className="h-3 w-16" />
													</TableCell>
													<TableCell>
														<Skeleton className="h-3.5 w-16" />
													</TableCell>
													<TableCell className="w-[100px] pr-4">
														<div className="flex justify-center gap-1">
															<Skeleton className="h-7 w-7 rounded" />
															<Skeleton className="h-7 w-7 rounded" />
															<Skeleton className="h-7 w-7 rounded" />
														</div>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							) : visibleLeads.length === 0 ? (
								<div className="flex flex-col items-center justify-center py-16 text-center">
									<RiUserLine className="mb-3 size-12 text-muted-foreground/30" />
									<p className="font-medium">No leads found</p>
									<p className="mt-1 text-muted-foreground text-sm">
										{allLeads.length === 0
											? "Create your first lead to get started."
											: "Try adjusting or clearing your filters."}
									</p>
									{hasFilters && (
										<Button
											variant="link"
											size="sm"
											className="mt-2"
											onClick={resetFilters}
										>
											Clear filters
										</Button>
									)}
								</div>
							) : (
								<div className="overflow-x-auto">
									<Table>
										<TableHeader>
											<TableRow className="hover:bg-transparent">
												<TableHead className="w-10 pl-4">
													<input
														type="checkbox"
														checked={allSelected}
														onChange={toggleSelectAll}
														className="cursor-pointer rounded"
													/>
												</TableHead>
												<SortHeader
													label="Name"
													sortKey="name"
													current={sortKey}
													order={sortOrder}
													onSort={handleSort}
												/>
												<TableHead className="hidden md:table-cell">
													Contact
												</TableHead>
												<TableHead className="hidden lg:table-cell">
													Property
												</TableHead>
												<SortHeader
													label="Stage"
													sortKey="stage"
													current={sortKey}
													order={sortOrder}
													onSort={handleSort}
												/>
												<SortHeader
													label="Status"
													sortKey="status"
													current={sortKey}
													order={sortOrder}
													onSort={handleSort}
												/>
												<SortHeader
													label="Agent"
													sortKey="agentName"
													current={sortKey}
													order={sortOrder}
													onSort={handleSort}
												/>
												<TableHead className="hidden xl:table-cell">
													Type
												</TableHead>
												<SortHeader
													label="Created"
													sortKey="createdAt"
													current={sortKey}
													order={sortOrder}
													onSort={handleSort}
												/>
												<TableHead className="w-[100px] pr-4 text-center">
													Actions
												</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{visibleLeads.map((lead) => (
												<TableRow
													key={lead.id}
													className={`transition-colors ${selectedIds.has(lead.id) ? "bg-muted/50" : "hover:bg-muted/30"}`}
												>
													<TableCell className="pl-4">
														<input
															type="checkbox"
															checked={selectedIds.has(lead.id)}
															onChange={() => toggleSelect(lead.id)}
															className="cursor-pointer rounded"
														/>
													</TableCell>
													<TableCell>
														<p className="font-medium text-sm leading-snug">
															{lead.name}
														</p>
														<p className="text-muted-foreground text-xs md:hidden">
															{lead.email}
														</p>
													</TableCell>
													<TableCell className="hidden md:table-cell">
														<p className="text-sm">{lead.email}</p>
														<p className="text-muted-foreground text-xs">
															{lead.phone}
														</p>
													</TableCell>
													<TableCell className="hidden lg:table-cell">
														<p
															className="max-w-[140px] truncate text-sm"
															title={lead.property}
														>
															{lead.property}
														</p>
														{lead.projectName && (
															<p className="max-w-[140px] truncate text-muted-foreground text-xs">
																{lead.projectName}
															</p>
														)}
													</TableCell>
													<TableCell>
														<StageBadge stage={lead.stage} />
													</TableCell>
													<TableCell>
														<StatusBadge status={lead.status} />
													</TableCell>
													<TableCell>
														{lead.agentName ? (
															<div className="flex items-center gap-1.5">
																<RiUserLine
																	size={13}
																	className="shrink-0 text-muted-foreground"
																/>
																<span
																	className="max-w-[110px] truncate text-sm"
																	title={lead.agentName}
																>
																	{lead.agentName}
																</span>
															</div>
														) : (
															<span className="text-muted-foreground text-xs italic">
																Unassigned
															</span>
														)}
													</TableCell>
													<TableCell className="hidden xl:table-cell">
														<p className="text-xs capitalize">{lead.type}</p>
														<p className="text-muted-foreground text-xs capitalize">
															{lead.leadType}
														</p>
													</TableCell>
													<TableCell className="whitespace-nowrap text-muted-foreground text-xs">
														{new Date(lead.createdAt).toLocaleDateString()}
													</TableCell>
													<TableCell className="w-[100px] pr-4">
														<div className="flex items-center justify-center gap-0.5">
															<Button
																variant="ghost"
																size="sm"
																className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
																title="View details"
																onClick={() => setViewLead(lead)}
															>
																<RiEyeLine size={14} />
															</Button>
															<Button
																variant="ghost"
																size="sm"
																className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
																title="Edit lead"
																onClick={() => setEditLead(lead)}
															>
																<RiEditLine size={14} />
															</Button>
															<Button
																variant="ghost"
																size="sm"
																className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
																title="Delete lead"
																onClick={() => setDeleteLead(lead)}
															>
																<RiDeleteBinLine size={14} />
															</Button>
														</div>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							)}

							{/* Pagination */}
							{totalFiltered > 0 && (
								<div className="flex flex-wrap items-center justify-center gap-1.5 border-t px-4 py-3">
									{/* |◄ First */}
									<Button
										variant="outline"
										size="sm"
										className="h-8 w-8 p-0"
										disabled={page <= 1}
										onClick={() => setPage(1)}
										title="First page"
									>
										<span className="sr-only">First</span>
										<svg
											viewBox="0 0 16 16"
											className="size-3.5"
											fill="currentColor"
											aria-hidden="true"
										>
											<path d="M3 3h1.5v10H3zm2.5 5 6-5v10z" />
										</svg>
									</Button>

									{/* ◄ Prev */}
									<Button
										variant="outline"
										size="sm"
										className="h-8 w-8 p-0"
										disabled={page <= 1}
										onClick={() => setPage((p) => p - 1)}
										title="Previous page"
									>
										<span className="sr-only">Previous</span>
										<svg
											viewBox="0 0 16 16"
											className="size-3.5"
											fill="currentColor"
											aria-hidden="true"
										>
											<path d="M10.5 3 4 8l6.5 5z" />
										</svg>
									</Button>

									{/* Numbered pages with ellipsis */}
									{(() => {
										const delta = 2;
										const pages: (number | "…left" | "…right")[] = [];
										const left = Math.max(2, page - delta);
										const right = Math.min(totalPages - 1, page + delta);

										pages.push(1);
										if (left > 2) pages.push("…left");
										for (let i = left; i <= right; i++) pages.push(i);
										if (right < totalPages - 1) pages.push("…right");
										if (totalPages > 1) pages.push(totalPages);

										return pages.map((p) =>
											typeof p === "string" ? (
												<span
													key={p}
													className="flex h-8 w-6 select-none items-center justify-center text-muted-foreground text-xs"
												>
													…
												</span>
											) : (
												<Button
													key={p}
													variant={p === page ? "default" : "outline"}
													size="sm"
													className="h-8 w-8 p-0 text-xs"
													onClick={() => setPage(p)}
												>
													{p}
												</Button>
											),
										);
									})()}

									{/* ► Next */}
									<Button
										variant="outline"
										size="sm"
										className="h-8 w-8 p-0"
										disabled={page >= totalPages}
										onClick={() => setPage((p) => p + 1)}
										title="Next page"
									>
										<span className="sr-only">Next</span>
										<svg
											viewBox="0 0 16 16"
											className="size-3.5"
											fill="currentColor"
											aria-hidden="true"
										>
											<path d="M5.5 3 12 8l-6.5 5z" />
										</svg>
									</Button>

									{/* ►| Last */}
									<Button
										variant="outline"
										size="sm"
										className="h-8 w-8 p-0"
										disabled={page >= totalPages}
										onClick={() => setPage(totalPages)}
										title="Last page"
									>
										<span className="sr-only">Last</span>
										<svg
											viewBox="0 0 16 16"
											className="size-3.5"
											fill="currentColor"
											aria-hidden="true"
										>
											<path d="M11.5 3H13v10h-1.5zM4 3l6.5 5L4 13z" />
										</svg>
									</Button>

									{/* Items-per-page selector */}
									<div className="ml-2 flex items-center gap-1.5 border-l pl-2">
										<Select
											value={String(pageSize)}
											onValueChange={(v) => {
												setPageSize(Number(v));
												setPage(1);
											}}
										>
											<SelectTrigger className="h-8 w-16 px-2 text-xs">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{PAGE_SIZE_OPTIONS.map((n) => (
													<SelectItem
														key={n}
														value={String(n)}
														className="text-xs"
													>
														{n}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<span className="whitespace-nowrap text-muted-foreground text-xs">
											items per page
										</span>
									</div>
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</SidebarInset>

			{/* Dialogs & Sheets */}
			<LeadDetailSheet
				lead={viewLead}
				open={!!viewLead}
				onClose={() => setViewLead(null)}
				agents={agents}
				onRefresh={handleRefresh}
			/>
			<EditLeadDialog
				lead={editLead}
				open={!!editLead}
				onClose={() => setEditLead(null)}
				agents={agents}
				onSuccess={handleRefresh}
			/>
			<DeleteLeadDialog
				lead={deleteLead}
				open={!!deleteLead}
				onClose={() => setDeleteLead(null)}
				onSuccess={handleRefresh}
			/>
			<CreateLeadDialog
				open={isCreateOpen}
				onClose={() => setIsCreateOpen(false)}
				agents={agents}
				onSuccess={handleRefresh}
			/>
			<BulkStageDialog
				selectedIds={Array.from(selectedIds)}
				open={isBulkStageOpen}
				onClose={() => setIsBulkStageOpen(false)}
				onSuccess={() => {
					handleRefresh();
					setSelectedIds(new Set());
				}}
			/>
		</SidebarProvider>
	);
}
