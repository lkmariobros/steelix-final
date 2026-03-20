export type Lead = {
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

export type SortKey =
	| "name"
	| "stage"
	| "status"
	| "agentName"
	| "createdAt"
	| "updatedAt";

export type TaskType = "call" | "email" | "follow_up" | "meeting" | "other";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export type LeadTask = {
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

export type ActivityEventType =
	| "note_added"
	| "stage_changed"
	| "lead_assigned"
	| "lead_updated"
	| "call_logged"
	| "email_sent";

