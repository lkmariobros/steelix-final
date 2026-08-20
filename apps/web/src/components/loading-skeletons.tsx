"use client";

import type { ReactNode } from "react";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ROW_IDS = [
	"sk-row-1",
	"sk-row-2",
	"sk-row-3",
	"sk-row-4",
	"sk-row-5",
	"sk-row-6",
] as const;

/** Summary / KPI card grid (commissions, lead stats, etc.). */
export function StatsCardsSkeleton({
	count = 3,
	className,
}: {
	count?: number;
	className?: string;
}) {
	const ids = ROW_IDS.slice(0, Math.max(1, Math.min(count, ROW_IDS.length)));
	return (
		<div
			className={cn(
				"grid gap-3",
				count === 1 && "grid-cols-1",
				count === 2 && "sm:grid-cols-2",
				count === 3 && "sm:grid-cols-3",
				count >= 4 && "sm:grid-cols-2 lg:grid-cols-4",
				className,
			)}
		>
			{ids.map((id) => (
				<Card key={id}>
					<CardContent className="space-y-2 pt-4">
						<Skeleton className="h-3 w-24" />
						<Skeleton className="h-7 w-32" />
					</CardContent>
				</Card>
			))}
		</div>
	);
}

/** Storage used label + progress bar — Files page. */
export function StorageUsageSkeleton({ className }: { className?: string }) {
	return (
		<div className={cn("space-y-1.5", className)}>
			<div className="flex justify-between gap-3">
				<Skeleton className="h-4 w-24" />
				<Skeleton className="h-4 w-32" />
			</div>
			<Skeleton className="h-2 w-full rounded-full" />
		</div>
	);
}

/** Folder / card tile grid — matches Files folder layout. */
export function FolderGridSkeleton({
	count = 4,
	className,
}: {
	count?: number;
	className?: string;
}) {
	const ids = ROW_IDS.slice(0, Math.max(1, Math.min(count, ROW_IDS.length)));
	return (
		<div
			className={cn(
				"grid gap-2 sm:grid-cols-2 lg:grid-cols-4",
				className,
			)}
		>
			{ids.map((id) => (
				<div
					key={id}
					className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-card p-3 shadow-sm"
				>
					<div className="flex min-w-0 flex-1 items-center gap-2">
						<Skeleton className="size-5 shrink-0 rounded-md" />
						<Skeleton className="h-4 w-24" />
					</div>
					<Skeleton className="size-8 shrink-0 rounded-full" />
				</div>
			))}
		</div>
	);
}

/** Full files table skeleton (header + rows) matching File drive columns. */
export function FilesTableSkeleton({
	rows = 6,
	className,
}: {
	rows?: number;
	className?: string;
}) {
	const ids = ROW_IDS.slice(0, Math.max(1, Math.min(rows, ROW_IDS.length)));
	return (
		<div
			className={cn(
				"overflow-hidden rounded-xl border border-border/60",
				className,
			)}
		>
			<Table>
				<TableHeader>
					<TableRow className="hover:bg-transparent">
						{(["Name", "Source", "Type", "Size", "Uploaded", "Actions"] as const).map(
							(label) => (
								<TableHead
									key={label}
									className={cn(
										"bg-muted/50 font-semibold text-foreground/80 text-xs",
										label === "Actions" && "text-right",
									)}
								>
									{label}
								</TableHead>
							),
						)}
					</TableRow>
				</TableHeader>
				<TableBody>
					{ids.map((id) => (
						<TableRow key={id} className="hover:bg-transparent">
							<TableCell>
								<Skeleton className="h-4 w-36" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-5 w-16 rounded-full" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-5 w-14 rounded-full" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-4 w-14" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-4 w-28" />
							</TableCell>
							<TableCell className="text-right">
								<div className="flex justify-end gap-1">
									<Skeleton className="size-8 rounded-full" />
									<Skeleton className="size-8 rounded-full" />
									<Skeleton className="size-8 rounded-full" />
								</div>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

type TableColumnSkeleton =
	| "text"
	| "text-sm"
	| "double"
	| "badge"
	| "amount"
	| "actions"
	| "actions-3";

const COLUMN_RENDER: Record<TableColumnSkeleton, () => ReactNode> = {
	text: () => <Skeleton className="h-4 w-28" />,
	"text-sm": () => <Skeleton className="h-4 w-20" />,
	double: () => (
		<>
			<Skeleton className="mb-1 h-4 w-36" />
			<Skeleton className="h-3 w-24" />
		</>
	),
	badge: () => <Skeleton className="h-5 w-20 rounded-full" />,
	amount: () => <Skeleton className="ml-auto h-4 w-20" />,
	actions: () => (
		<div className="flex justify-end gap-1">
			<Skeleton className="size-8 rounded-full" />
			<Skeleton className="size-8 rounded-full" />
		</div>
	),
	"actions-3": () => (
		<div className="flex justify-end gap-1">
			<Skeleton className="size-8 rounded-full" />
			<Skeleton className="size-8 rounded-full" />
			<Skeleton className="size-8 rounded-full" />
		</div>
	),
};

/** Table body skeleton rows that match real column shapes.
 *  Returns `<tr>` rows only (no `<tbody>`) so it can sit inside an existing TableBody.
 *  Use `showHeader` for a standalone bordered table with its own body. */
export function TableRowsSkeleton({
	columns,
	rows = 6,
	showHeader = false,
	headers,
}: {
	columns: TableColumnSkeleton[];
	rows?: number;
	showHeader?: boolean;
	headers?: string[];
}) {
	const ids = ROW_IDS.slice(0, Math.max(1, Math.min(rows, ROW_IDS.length)));
	const rowEls = ids.map((id) => (
		<TableRow key={id}>
			{columns.map((col, i) => (
				<TableCell
					key={`${id}-${col}-${i}`}
					className={
						col === "amount" || col === "actions" || col === "actions-3"
							? "text-right"
							: undefined
					}
				>
					{COLUMN_RENDER[col]()}
				</TableCell>
			))}
		</TableRow>
	));

	if (!showHeader) return <>{rowEls}</>;

	return (
		<div className="rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						{(headers ?? columns.map((_, i) => `col-${i}`)).map((h) => (
							<TableHead key={h}>
								<Skeleton className="h-3.5 w-20" />
							</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>{rowEls}</TableBody>
			</Table>
		</div>
	);
}

/** Listings-style 12-col grid rows. */
export function ListGridRowsSkeleton({
	rows = 6,
	className,
}: {
	rows?: number;
	className?: string;
}) {
	const ids = ROW_IDS.slice(0, Math.max(1, Math.min(rows, ROW_IDS.length)));
	return (
		<div className={cn("divide-y", className)}>
			{ids.map((id) => (
				<div
					key={id}
					className="grid grid-cols-12 items-center gap-2 px-4 py-3"
				>
					<div className="col-span-4">
						<Skeleton className="h-4 w-3/4" />
					</div>
					<div className="col-span-2">
						<Skeleton className="h-4 w-16" />
					</div>
					<div className="col-span-2">
						<Skeleton className="h-5 w-20 rounded-full" />
					</div>
					<div className="col-span-2">
						<Skeleton className="h-4 w-16" />
					</div>
					<div className="col-span-1 flex justify-end">
						<Skeleton className="h-4 w-12" />
					</div>
					<div className="col-span-1 flex justify-end">
						<Skeleton className="h-8 w-8 rounded-md" />
					</div>
				</div>
			))}
		</div>
	);
}

/** Detail page content (commission / transaction style). */
export function DetailCardsSkeleton({ className }: { className?: string }) {
	return (
		<div className={cn("flex flex-col gap-4", className)}>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-6 w-24 rounded-full" />
			</div>
			<div className="grid gap-4 lg:grid-cols-2">
				{["sk-detail-a", "sk-detail-b"].map((id) => (
					<Card key={id}>
						<CardHeader>
							<Skeleton className="h-5 w-28" />
						</CardHeader>
						<CardContent className="space-y-3">
							{[1, 2, 3, 4].map((n) => (
								<div key={`${id}-${n}`} className="flex justify-between gap-4">
									<Skeleton className="h-4 w-24" />
									<Skeleton className="h-4 w-32" />
								</div>
							))}
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}

/** Chat / message thread placeholder cards. */
export function MessageListSkeleton({
	count = 4,
	className,
}: {
	count?: number;
	className?: string;
}) {
	const ids = ROW_IDS.slice(0, Math.max(1, Math.min(count, ROW_IDS.length)));
	return (
		<div className={cn("space-y-3", className)}>
			{ids.map((id) => (
				<div key={id} className="space-y-2 rounded-lg border bg-muted/20 p-3">
					<div className="flex flex-wrap items-center gap-2">
						<Skeleton className="h-4 w-28" />
						<Skeleton className="h-5 w-16 rounded-full" />
						<Skeleton className="h-5 w-20 rounded-full" />
					</div>
					<Skeleton className="h-3 w-full" />
					<Skeleton className="h-3 w-4/5" />
				</div>
			))}
		</div>
	);
}

/** Document list rows. */
export function DocumentListSkeleton({
	count = 4,
	className,
}: {
	count?: number;
	className?: string;
}) {
	const ids = ROW_IDS.slice(0, Math.max(1, Math.min(count, ROW_IDS.length)));
	return (
		<ul className={cn("space-y-2", className)}>
			{ids.map((id) => (
				<li
					key={id}
					className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
				>
					<Skeleton className="size-4 shrink-0 rounded" />
					<div className="min-w-0 flex-1 space-y-1.5">
						<Skeleton className="h-4 w-2/3" />
						<Skeleton className="h-3 w-20" />
					</div>
					<Skeleton className="h-5 w-16 shrink-0 rounded-full" />
				</li>
			))}
		</ul>
	);
}

/** Announcement / feed card skeletons. */
export function FeedCardsSkeleton({
	count = 3,
	className,
}: {
	count?: number;
	className?: string;
}) {
	const ids = ROW_IDS.slice(0, Math.max(1, Math.min(count, ROW_IDS.length)));
	return (
		<div className={cn("space-y-4", className)}>
			{ids.map((id) => (
				<div key={id} className="space-y-2 rounded-lg border bg-muted/30 p-3">
					<div className="flex items-center justify-between gap-2">
						<Skeleton className="h-4 w-40" />
						<Skeleton className="h-5 w-16 rounded-full" />
					</div>
					<Skeleton className="h-3 w-full" />
					<Skeleton className="h-3 w-3/4" />
					<Skeleton className="h-3 w-24" />
				</div>
			))}
		</div>
	);
}
