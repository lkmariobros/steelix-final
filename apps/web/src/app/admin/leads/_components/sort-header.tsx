"use client";

import { RiArrowDownSLine, RiArrowUpDownLine, RiArrowUpSLine } from "@remixicon/react";
import { TableHead } from "@/components/table";
import { cn } from "@/lib/utils";
import type { SortKey } from "./lead-models";

export function SortHeader({
	label,
	sortKey,
	current,
	order,
	onSort,
	className,
}: {
	label: string;
	sortKey: SortKey;
	current: SortKey;
	order: "asc" | "desc";
	onSort: (k: SortKey) => void;
	className?: string;
}) {
	const active = current === sortKey;
	return (
		<TableHead
			className={cn(
				"h-11 cursor-pointer select-none bg-muted/50 px-4 font-semibold text-foreground/80 text-xs tracking-wide hover:text-foreground",
				className,
			)}
			onClick={() => onSort(sortKey)}
		>
			<div className="flex items-center gap-1.5">
				{label}
				{active ? (
					order === "asc" ? (
						<RiArrowUpSLine size={14} className="text-primary" />
					) : (
						<RiArrowDownSLine size={14} className="text-primary" />
					)
				) : (
					<RiArrowUpDownLine
						size={12}
						className="text-muted-foreground/45"
					/>
				)}
			</div>
		</TableHead>
	);
}
