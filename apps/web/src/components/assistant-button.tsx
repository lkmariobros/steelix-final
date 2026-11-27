"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
	RiAlarmWarningLine,
	RiArrowRightLine,
	RiBriefcaseLine,
	RiCalendarCheckLine,
	RiCalendarEventLine,
	RiCheckboxCircleLine,
	RiCloseLine,
	RiFileWarningLine,
	RiFileList3Line,
	RiFlag2Line,
	RiFolderOpenLine,
	RiInformationLine,
	RiLoader4Line,
	RiMoneyDollarCircleLine,
	RiSendPlane2Fill,
	RiSparkling2Line,
	RiTimeLine,
	RiTodoLine,
	RiUserLine,
} from "@remixicon/react";
import type { inferRouterOutputs } from "@trpc/server";
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { TASK_PRIORITY_CONFIG } from "@/app/admin/leads/_components/lead-constants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import type { AppRouter } from "../../../server/src/routers";

type AssistantAnswer = inferRouterOutputs<AppRouter>["assistant"]["ask"];
type QuickIntent =
	| "today"
	| "upcoming"
	| "overdue"
	| "urgent"
	| "leads_by_stage"
	| "cases_pending"
	| "cases_by_status"
	| "completed_cases"
	| "commission_summary"
	| "missing_documents"
	| "case_files";

type ChatMessage =
	| { id: number; role: "user"; text: string; at: Date }
	| { id: number; role: "assistant"; answer: AssistantAnswer; at: Date }
	| { id: number; role: "error"; text: string; at: Date };

type NewChatMessage = ChatMessage extends infer M
	? M extends ChatMessage
		? Omit<M, "id" | "at">
		: never
	: never;

const QUICK_ACTIONS: Array<{
	intent: QuickIntent;
	label: string;
	icon: typeof RiTimeLine;
}> = [
	{ intent: "today", label: "Today", icon: RiCalendarCheckLine },
	{ intent: "upcoming", label: "Next 3 days", icon: RiCalendarEventLine },
	{ intent: "overdue", label: "Overdue", icon: RiTimeLine },
	{ intent: "urgent", label: "Urgent", icon: RiFlag2Line },
	{ intent: "leads_by_stage", label: "My pipeline", icon: RiUserLine },
	{ intent: "cases_pending", label: "Pending cases", icon: RiBriefcaseLine },
	{ intent: "cases_by_status", label: "All cases", icon: RiFolderOpenLine },
	{ intent: "completed_cases", label: "Completed", icon: RiCheckboxCircleLine },
	{ intent: "commission_summary", label: "Commission", icon: RiMoneyDollarCircleLine },
	{ intent: "missing_documents", label: "Missing docs", icon: RiFileWarningLine },
	{ intent: "case_files", label: "Case files", icon: RiFileList3Line },
];

const INTENT_LABELS: Record<AssistantAnswer["intent"], string> = {
	today: "Today's work",
	upcoming: "Next 3 days",
	overdue: "Overdue tasks",
	urgent: "Urgent tasks",
	leads_by_stage: "Leads by stage",
	cases_pending: "Pending cases",
	cases_by_status: "Cases by status",
	completed_cases: "Completed cases",
	commission_summary: "Commission summary",
	missing_documents: "Missing documents",
	case_files: "Case files",
	unsupported: "Not a supported question yet",
};

const PRIORITY_BADGE: Record<string, string> = {
	low: "bg-muted text-muted-foreground",
	normal: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
	high: "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400",
	urgent: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
};

const SHOW_DEMO_BADGE = process.env.NEXT_PUBLIC_ASSISTANT_DEMO === "true";

const BUSINESS_INTENTS = new Set([
	"leads_by_stage",
	"cases_pending",
	"cases_by_status",
	"completed_cases",
	"commission_summary",
	"missing_documents",
	"case_files",
]);

const FINANCE_INTENTS = new Set(["completed_cases", "commission_summary"]);
const DOCS_INTENTS = new Set(["missing_documents", "case_files"]);

function formatClock(at: Date): string {
	return at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function sourceCaption(intent: AssistantAnswer["intent"]): string {
	if (intent === "leads_by_stage") return "From your CRM leads (personal).";
	if (
		intent === "cases_pending" ||
		intent === "cases_by_status" ||
		intent === "completed_cases"
	) {
		return "From your visible cases/projects.";
	}
	if (intent === "commission_summary") {
		return "From your case commission share and payouts.";
	}
	if (intent === "missing_documents" || intent === "case_files") {
		return "From case documents (same rules as submit).";
	}
	return "From your portal tasks and calendar.";
}

function itemKindLabel(kind: AssistantAnswer["groups"][number]["items"][number]["kind"]) {
	switch (kind) {
		case "task":
			return "Task";
		case "event":
			return "Calendar";
		case "lead":
			return "Lead";
		case "case":
			return "Case";
		case "stat":
			return "Finance";
		case "file":
			return "File";
	}
}

function itemOpenLabel(kind: AssistantAnswer["groups"][number]["items"][number]["kind"]) {
	switch (kind) {
		case "task":
			return "Open lead";
		case "event":
			return "Open calendar";
		case "lead":
			return "Open lead";
		case "case":
			return "Open case";
		case "stat":
			return "Open";
		case "file":
			return "Open case";
	}
}

function ItemIcon({
	kind,
}: {
	kind: AssistantAnswer["groups"][number]["items"][number]["kind"];
}) {
	if (kind === "task") return <RiTodoLine className="size-4" />;
	if (kind === "event") return <RiCalendarEventLine className="size-4" />;
	if (kind === "lead") return <RiUserLine className="size-4" />;
	if (kind === "stat") return <RiMoneyDollarCircleLine className="size-4" />;
	if (kind === "file") return <RiFileList3Line className="size-4" />;
	return <RiBriefcaseLine className="size-4" />;
}

function IntentNote({ answer }: { answer: AssistantAnswer }) {
	if (answer.source === "button") return null;
	if (answer.source === "keyword") {
		return (
			<p className="mt-2 text-[0.7rem] text-muted-foreground">
				Keyword fallback · {INTENT_LABELS[answer.intent]}
			</p>
		);
	}
	return (
		<p className="mt-2 inline-flex flex-wrap items-center gap-x-1.5 rounded-md bg-primary/10 px-2 py-1 text-[0.7rem] text-primary">
			<RiSparkling2Line className="size-3" />
			<span>
				JEV understood: <strong>{INTENT_LABELS[answer.intent]}</strong>
			</span>
			{answer.jev ? (
				<span className="text-primary/80">
					· confidence {Math.round(answer.jev.confidence * 100)}% ·{" "}
					{answer.jev.latencyMs} ms
				</span>
			) : null}
		</p>
	);
}

function AnswerBlock({
	answer,
	onNavigate,
}: {
	answer: AssistantAnswer;
	onNavigate: () => void;
}) {
	return (
		<div className="space-y-3">
			<div className="rounded-xl rounded-tl-sm border bg-muted/40 px-3 py-2.5 text-sm">
				<p className="font-medium">{answer.summary}</p>
				{answer.intent !== "unsupported" && answer.totalCount > 0 ? (
					<p className="mt-0.5 text-muted-foreground text-xs">
						{sourceCaption(answer.intent)}
					</p>
				) : null}
				<IntentNote answer={answer} />
			</div>

			{answer.groups.map((group) => (
				<section key={group.key} className="space-y-2">
					<h4
						className={cn(
							"flex items-center gap-1.5 font-semibold text-xs uppercase tracking-wide",
							group.key === "overdue"
								? "text-red-600 dark:text-red-400"
								: "text-muted-foreground",
						)}
					>
						{group.key === "overdue" ? (
							<RiAlarmWarningLine className="size-3.5" />
						) : DOCS_INTENTS.has(answer.intent) ? (
							answer.intent === "missing_documents" ? (
								<RiFileWarningLine className="size-3.5" />
							) : (
								<RiFileList3Line className="size-3.5" />
							)
						) : FINANCE_INTENTS.has(answer.intent) ? (
							answer.intent === "commission_summary" ? (
								<RiMoneyDollarCircleLine className="size-3.5" />
							) : (
								<RiCheckboxCircleLine className="size-3.5" />
							)
						) : BUSINESS_INTENTS.has(answer.intent) ? (
							answer.intent === "leads_by_stage" ? (
								<RiUserLine className="size-3.5" />
							) : (
								<RiBriefcaseLine className="size-3.5" />
							)
						) : (
							<RiCalendarEventLine className="size-3.5" />
						)}
						{group.label}
						{!/\(\d+\)$/.test(group.label) ? ` (${group.items.length})` : null}
					</h4>
					<ul className="space-y-2">
						{group.items.map((item) => (
							<li
								key={`${item.kind}-${item.id}`}
								className="flex gap-3 rounded-lg border bg-card p-3"
							>
								<div
									className={cn(
										"mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md",
										item.kind === "task" && "bg-primary/10 text-primary",
										item.kind === "event" &&
											"bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400",
										item.kind === "lead" &&
											"bg-teal-100 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400",
										item.kind === "case" &&
											"bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300",
										item.kind === "stat" &&
											"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300",
										item.kind === "file" &&
											"bg-sky-100 text-sky-800 dark:bg-sky-900/20 dark:text-sky-300",
									)}
								>
									<ItemIcon kind={item.kind} />
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex items-start justify-between gap-2">
										<p className="line-clamp-2 font-medium text-sm leading-snug">
											{item.title}
										</p>
										{item.priority ? (
											<span
												className={cn(
													"shrink-0 rounded-full px-2 py-0.5 font-medium text-[0.65rem]",
													PRIORITY_BADGE[item.priority],
												)}
											>
												{TASK_PRIORITY_CONFIG[item.priority].label}
											</span>
										) : null}
									</div>
									{item.subtitle ? (
										<p className="mt-0.5 line-clamp-1 text-muted-foreground text-xs">
											{item.subtitle}
										</p>
									) : null}
									<div className="mt-2 flex items-center justify-between gap-2">
										<div className="flex min-w-0 items-center gap-1.5 text-xs">
											<span className="rounded bg-muted px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">
												{itemKindLabel(item.kind)}
											</span>
											<span
												className={cn(
													"truncate",
													group.key === "overdue"
														? "font-medium text-red-600 dark:text-red-400"
														: "text-muted-foreground",
												)}
											>
												{item.timeLabel}
											</span>
										</div>
										<Link
											href={item.href}
											onClick={onNavigate}
											className="inline-flex shrink-0 items-center gap-0.5 font-medium text-primary text-xs hover:underline"
										>
											{itemOpenLabel(item.kind)}
											<RiArrowRightLine className="size-3" />
										</Link>
									</div>
								</div>
							</li>
						))}
					</ul>
				</section>
			))}
		</div>
	);
}

export function AssistantButton() {
	const [open, setOpen] = useState(false);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [text, setText] = useState("");
	const nextId = useRef(1);
	const scrollRef = useRef<HTMLDivElement>(null);

	const { data: status } = trpc.assistant.status.useQuery(undefined, {
		enabled: open,
		staleTime: 60_000,
	});
	const askMutation = trpc.assistant.ask.useMutation();

	useEffect(() => {
		if (!open) return;
		const el = scrollRef.current;
		if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
	}, [messages, open, askMutation.isPending]);

	const push = (message: NewChatMessage) => {
		const id = nextId.current++;
		setMessages((prev) => [
			...prev,
			{ ...message, id, at: new Date() } as ChatMessage,
		]);
	};

	const send = (
		input:
			| { mode: "button"; intent: QuickIntent }
			| { mode: "text"; text: string },
		userText: string,
	) => {
		if (askMutation.isPending) return;
		push({ role: "user", text: userText });
		askMutation.mutate(input, {
			onSuccess: (answer) => push({ role: "assistant", answer }),
			onError: () =>
				push({
					role: "error",
					text: "Sorry, I couldn't load your portal data right now. Please try again.",
				}),
		});
	};

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		const question = text.trim();
		if (!question) return;
		setText("");
		send({ mode: "text", text: question }, question);
	};

	return (
		<DialogPrimitive.Root open={open} onOpenChange={setOpen}>
			<DialogPrimitive.Trigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className={cn(
						"gap-2 text-muted-foreground hover:text-foreground",
						open && "bg-primary/10 text-primary",
					)}
					aria-label="Open assistant"
				>
					<RiSparkling2Line className="size-4" />
					<span className="hidden sm:inline">Assistant</span>
				</Button>
			</DialogPrimitive.Trigger>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Overlay className="data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/30 data-[state=closed]:animate-out data-[state=open]:animate-in" />
				<DialogPrimitive.Content
					className="data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l bg-background shadow-xl duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in sm:max-w-md"
					aria-describedby="assistant-description"
				>
					<header className="flex items-start justify-between gap-3 border-b px-4 py-3">
						<div className="flex items-start gap-3">
							<span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
								<RiSparkling2Line className="size-5" />
							</span>
							<div>
								<DialogPrimitive.Title className="font-semibold text-base leading-tight">
									Devots Assistant
								</DialogPrimitive.Title>
								<DialogPrimitive.Description
									id="assistant-description"
									className="text-muted-foreground text-xs"
								>
									Read-only · Based on your permitted records
								</DialogPrimitive.Description>
							</div>
						</div>
						<DialogPrimitive.Close asChild>
							<Button
								variant="ghost"
								size="icon"
								className="size-8"
								aria-label="Close assistant"
							>
								<RiCloseLine className="size-4" />
							</Button>
						</DialogPrimitive.Close>
					</header>

					<div className="grid grid-cols-4 gap-2 border-b px-4 py-3">
						{QUICK_ACTIONS.map(({ intent, label, icon: Icon }) => (
							<Button
								key={intent}
								variant="outline"
								size="sm"
								className="h-auto flex-col gap-1 px-1 py-2 text-xs"
								disabled={askMutation.isPending}
								onClick={() => send({ mode: "button", intent }, label)}
							>
								<Icon
									className={cn(
										"size-4",
										intent === "urgent" && "text-red-500",
										intent === "overdue" && "text-amber-500",
										intent === "leads_by_stage" && "text-teal-600",
										(intent === "cases_pending" || intent === "cases_by_status") &&
											"text-amber-700",
										intent === "completed_cases" && "text-emerald-600",
										intent === "commission_summary" && "text-emerald-700",
										intent === "missing_documents" && "text-rose-600",
										intent === "case_files" && "text-sky-600",
									)}
								/>
								{label}
							</Button>
						))}
					</div>

					<div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
						{messages.length === 0 ? (
							<div className="space-y-2 rounded-xl border border-dashed p-4 text-sm">
								<p className="font-medium">Hi! What would you like to check?</p>
								<p className="text-muted-foreground text-xs">
									Tap a quick button, or ask about tasks, leads, cases, commission,
									missing docs, or case files. I only show records you can already
									see in the portal.
								</p>
							</div>
						) : null}

						{messages.map((message) => {
							if (message.role === "user") {
								return (
									<div key={message.id} className="flex flex-col items-end gap-1">
										<p className="max-w-[85%] rounded-xl rounded-tr-sm bg-primary px-3 py-2 text-primary-foreground text-sm">
											{message.text}
										</p>
										<span className="text-[0.65rem] text-muted-foreground">
											{formatClock(message.at)}
										</span>
									</div>
								);
							}
							if (message.role === "error") {
								return (
									<p
										key={message.id}
										className="rounded-xl rounded-tl-sm border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-400"
									>
										{message.text}
									</p>
								);
							}
							return (
								<AnswerBlock
									key={message.id}
									answer={message.answer}
									onNavigate={() => setOpen(false)}
								/>
							);
						})}

						{askMutation.isPending ? (
							<div className="flex items-center gap-2 text-muted-foreground text-xs">
								<RiLoader4Line className="size-4 animate-spin" />
								Checking your portal data…
							</div>
						) : null}
					</div>

					<form onSubmit={handleSubmit} className="space-y-2 border-t px-4 py-3">
						<div className="flex items-center gap-2">
							<input
								value={text}
								onChange={(e) => setText(e.target.value)}
								maxLength={300}
								placeholder="Ask about tasks, cases, commission, or documents…"
								className="h-10 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
								aria-label="Ask the assistant"
							/>
							<Button
								type="submit"
								size="icon"
								className="size-10"
								disabled={askMutation.isPending || !text.trim()}
								aria-label="Send question"
							>
								<RiSendPlane2Fill className="size-4" />
							</Button>
						</div>
						<div className="flex items-center justify-between gap-2 text-[0.65rem] text-muted-foreground">
							<span className="inline-flex items-center gap-1">
								<RiInformationLine className="size-3" />
								Tasks · cases · commission · docs
								{status ? (
									<span>· JEV {status.jevAvailable ? "connected" : "offline (keyword mode)"}</span>
								) : null}
							</span>
							{SHOW_DEMO_BADGE ? (
								<span className="rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary">
									Sample data
								</span>
							) : null}
						</div>
					</form>
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}
