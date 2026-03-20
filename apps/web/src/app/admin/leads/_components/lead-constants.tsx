"use client";

import type React from "react";
import {
	RiCalendar2Line,
	RiEditLine,
	RiFileList3Line,
	RiHistoryLine,
	RiMailLine,
	RiPhoneLine,
	RiStickyNoteLine,
	RiTodoLine,
	RiUserLine,
} from "@remixicon/react";

export const PIPELINE_STAGES = [
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
		color: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
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

export type PipelineStageValue =
	(typeof PIPELINE_STAGES)[number]["value"];

export const stageMap: Record<
	string,
	{ value: string; label: string; color: string }
> = Object.fromEntries(
	PIPELINE_STAGES.map((s) => [s.value, s]),
) as Record<string, { value: string; label: string; color: string }>;

export const STATUS_OPTIONS = [
	{ value: "active", label: "Active" },
	{ value: "inactive", label: "Inactive" },
	{ value: "pending", label: "Pending" },
] as const;

export const TYPE_OPTIONS = [
	{ value: "tenant", label: "Tenant" },
	{ value: "buyer", label: "Buyer" },
] as const;

export const LEAD_TYPE_OPTIONS = [
	{ value: "personal", label: "Personal" },
	{ value: "company", label: "Company" },
] as const;

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export const TASK_TYPE_LABELS = {
	call: "Call",
	email: "Email",
	follow_up: "Follow-up",
	meeting: "Meeting",
	other: "Other",
} as const;

export const TASK_PRIORITY_CONFIG = {
	low: { label: "Low", color: "text-muted-foreground" },
	normal: { label: "Normal", color: "text-blue-600 dark:text-blue-400" },
	high: { label: "High", color: "text-orange-600 dark:text-orange-400" },
	urgent: { label: "Urgent", color: "text-red-600 dark:text-red-400" },
} as const;

export const ACTIVITY_CONFIG: Record<
	| "note_added"
	| "stage_changed"
	| "lead_assigned"
	| "lead_updated"
	| "call_logged"
	| "email_sent",
	{
		icon: React.ReactNode;
		label: string;
		color: string;
		dotColor: string;
	}
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
		color:
			"bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300",
		dotColor: "bg-teal-400",
	},
};

// Icon map used in TodayTasksWidget
export const TASK_TYPE_ICONS: Record<
	| "call"
	| "email"
	| "follow_up"
	| "meeting"
	| "other",
	React.ReactNode
> = {
	call: <RiPhoneLine className="size-3.5" />,
	email: <RiMailLine className="size-3.5" />,
	follow_up: <RiTodoLine className="size-3.5" />,
	meeting: <RiCalendar2Line className="size-3.5" />,
	other: <RiFileList3Line className="size-3.5" />,
};

