"use client";

import { RiArrowDownLine, RiArrowUpLine } from "@remixicon/react";
import { TableHead } from "@/components/table";
import type { SortKey } from "./lead-models";

export function SortHeader({
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

