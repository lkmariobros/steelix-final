"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
	RiAddLine,
	RiLoader4Line,
	RiRefreshLine,
} from "@remixicon/react";

export function AdminLeadsPageHeader({
	isLoading,
	leadCount,
	isRefreshing,
	viewMode,
	onRefresh,
	onViewMode,
	onNewLead,
}: {
	isLoading: boolean;
	leadCount: number;
	isRefreshing: boolean;
	viewMode: "table" | "kanban";
	onRefresh: () => void;
	onViewMode: (mode: "table" | "kanban") => void;
	onNewLead: () => void;
}) {
	return (
		<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div className="min-w-0 flex-1">
				<h1 className="font-bold text-2xl tracking-tight">Leads Management</h1>
				{isLoading ? (
					<Skeleton className="mt-1.5 h-4 w-64" />
				) : (
					<p className="mt-0.5 text-muted-foreground text-sm">
						{leadCount} leads loaded · filters &amp; sorting are instant
					</p>
				)}
			</div>
			<div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
				<Button
					variant="outline"
					size="sm"
					onClick={onRefresh}
					disabled={isRefreshing}
					className="h-9 gap-1.5"
				>
					{isRefreshing ? (
						<RiLoader4Line className="size-4 animate-spin" aria-hidden />
					) : (
						<RiRefreshLine size={16} className="mr-0.5" aria-hidden />
					)}
					<span>Refresh</span>
				</Button>

				<div className="inline-flex items-center rounded-md border bg-background p-1 shadow-sm">
					<Button
						variant="ghost"
						size="sm"
						aria-pressed={viewMode === "table"}
						onClick={() => onViewMode("table")}
						className={
							viewMode === "table"
								? "h-9 rounded-md bg-primary px-3 text-primary-foreground hover:bg-primary/90"
								: "h-9 rounded-md px-3 text-muted-foreground hover:bg-muted hover:text-foreground"
						}
					>
						List View
					</Button>
					<Button
						variant="ghost"
						size="sm"
						aria-pressed={viewMode === "kanban"}
						onClick={() => onViewMode("kanban")}
						className={
							viewMode === "kanban"
								? "h-9 rounded-md bg-primary px-3 text-primary-foreground hover:bg-primary/90"
								: "h-9 rounded-md px-3 text-muted-foreground hover:bg-muted hover:text-foreground"
						}
					>
						Board View
					</Button>
				</div>

				<Button size="sm" onClick={onNewLead} className="h-9">
					<RiAddLine size={16} className="mr-1.5" aria-hidden />
					New Lead
				</Button>
			</div>
		</div>
	);
}
