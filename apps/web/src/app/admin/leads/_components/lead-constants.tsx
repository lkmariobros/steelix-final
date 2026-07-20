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

/** Active pipeline stages — order matches Kanban columns (client feedback Slide 12). */
export const PIPELINE_STAGES = [
	{
		value: "new_lead",
		label: "New Lead",
		color: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
	},
	{
		value: "first_follow_up",
		label: "1 First Follow Up",
		color:
			"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
	},
	{
		value: "second_follow_up",
		label: "2 Second Follow Up",
		color:
			"bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400",
	},
	{
		value: "third_follow_up",
		label: "3 Third Follow Up",
		color:
			"bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
	},
	{
		value: "fourth_follow_up",
		label: "Last Follow Up (Can Recycle)",
		color:
			"bg-violet-100 text-violet-800 dark:bg-violet-900/20 dark:text-violet-400",
	},
	{
		value: "potential_lead",
		label: "Potential Lead",
		color: "bg-teal-100 text-teal-800 dark:bg-teal-900/20 dark:text-teal-400",
	},
	{
		value: "appointment_made",
		label: "Appointment Made",
		color:
			"bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400",
	},
	{
		value: "need_consider",
		label: "Need Consider",
		color:
			"bg-slate-100 text-slate-800 dark:bg-slate-900/20 dark:text-slate-400",
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
		label: "Spam/Fake Lead",
		color: "bg-neutral-100 text-neutral-800 dark:bg-neutral-900/20 dark:text-neutral-400",
	},
] as const;

export type PipelineStageValue =
	(typeof PIPELINE_STAGES)[number]["value"];

export const PIPELINE_STAGE_VALUES = PIPELINE_STAGES.map(
	(s) => s.value,
) as [PipelineStageValue, ...PipelineStageValue[]];

const FOLLOW_UP_STAGE_ORDER: PipelineStageValue[] = [
	"new_lead",
	"first_follow_up",
	"second_follow_up",
	"third_follow_up",
	"fourth_follow_up",
];

/** Next stage when logging a call / contact on a follow-up track lead. */
export function getNextFollowUpStage(
	current: string,
): PipelineStageValue | null {
	const idx = FOLLOW_UP_STAGE_ORDER.indexOf(current as PipelineStageValue);
	if (idx === -1 || idx >= FOLLOW_UP_STAGE_ORDER.length - 1) return null;
	return FOLLOW_UP_STAGE_ORDER[idx + 1] ?? null;
}

export function formatFollowUpStagePrompt(
	nextStage: PipelineStageValue,
): string {
	const match = PIPELINE_STAGES.find((s) => s.value === nextStage);
	return match ? `Move lead to ${match.label}?` : "Update lead stage?";
}

/** Retired stage slugs → active stage (for legacy DB rows & imports). */
export const RETIRED_PIPELINE_STAGE_LABELS: Record<string, string> = {
	follow_up_in_progress: "1 First Follow Up",
	no_pick_reply: "2 Second Follow Up",
	can_recycle: "Last Follow Up (Can Recycle)",
	follow_up_for_appointment: "3 Third Follow Up",
	consider_seen: "Need Consider",
	contacted: "1 First Follow Up",
	appointment_set: "Appointment Made",
	converted: "Booking Made",
};

/** Display label for any stage value (including legacy DB values). */
export function formatPipelineStageLabel(stage: string): string {
	if (RETIRED_PIPELINE_STAGE_LABELS[stage]) {
		return RETIRED_PIPELINE_STAGE_LABELS[stage];
	}
	return stageMap[stage]?.label ?? stage.replace(/_/g, " ");
}

export const stageMap: Record<
	string,
	{ value: string; label: string; color: string }
> = Object.fromEntries(
	PIPELINE_STAGES.map((s) => [s.value, s]),
) as Record<string, { value: string; label: string; color: string }>;

/** Canonical marketing/source options — admin & agent dropdowns should prefer these values. */
export const LEAD_SOURCE_OPTIONS = [
	{ value: "Direct WhatsApp", label: "Direct WhatsApp" },
	{ value: "Landing Page", label: "Landing Page" },
	{ value: "Facebook Ad", label: "Facebook Ad" },
	{ value: "Google Ad", label: "Google Ad" },
	{ value: "Referral", label: "Referral" },
	{ value: "Other", label: "Other" },
] as const;

export const STATUS_OPTIONS = [
	{ value: "active", label: "Active" },
	{ value: "inactive", label: "Inactive" },
] as const;

export const TYPE_OPTIONS = [
	{ value: "tenant", label: "Tenant" },
	{ value: "buyer", label: "Buyer" },
] as const;

export const LEAD_TYPE_OPTIONS = [
	{ value: "personal", label: "Personal Lead" },
	{ value: "company", label: "Company Lead" },
] as const;

export function formatLeadTypeLabel(
	leadType: "personal" | "company" | string,
): string {
	const match = LEAD_TYPE_OPTIONS.find((o) => o.value === leadType);
	return match?.label ?? String(leadType);
}

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

export const TASK_TYPE_ICONS: Record<
	"call" | "email" | "follow_up" | "meeting" | "other",
	React.ReactNode
> = {
	call: <RiPhoneLine className="size-3.5" />,
	email: <RiMailLine className="size-3.5" />,
	follow_up: <RiTodoLine className="size-3.5" />,
	meeting: <RiCalendar2Line className="size-3.5" />,
	other: <RiFileList3Line className="size-3.5" />,
};
