"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
	RiArrowLeftDoubleLine,
	RiArrowLeftSLine,
	RiArrowRightDoubleLine,
	RiArrowRightSLine,
} from "@remixicon/react";

interface TablePaginationProps {
	page: number;
	pageSize: number;
	total: number;
	onPageChange: (page: number) => void;
	className?: string;
}

export function TablePagination({
	page,
	pageSize,
	total,
	onPageChange,
	className,
}: TablePaginationProps) {
	const pageCount = Math.max(1, Math.ceil(total / pageSize));
	const from = total === 0 ? 0 : page * pageSize + 1;
	const to = Math.min((page + 1) * pageSize, total);

	const maxButtons = 5;
	let start = Math.max(0, page - Math.floor(maxButtons / 2));
	const end = Math.min(pageCount, start + maxButtons);
	start = Math.max(0, end - maxButtons);

	const pages = Array.from({ length: end - start }, (_, i) => start + i);

	return (
		<div
			className={cn(
				"flex flex-wrap items-center justify-between gap-3 pt-1",
				className,
			)}
		>
			<p className="text-muted-foreground text-sm">
				Showing {from} to {to} of {total} entries
			</p>
			<div className="flex items-center gap-1">
				<Button
					type="button"
					size="sm"
					variant="outline"
					className="size-8 rounded-lg p-0"
					disabled={page <= 0}
					onClick={() => onPageChange(0)}
					aria-label="First page"
				>
					<RiArrowLeftDoubleLine size={14} />
				</Button>
				<Button
					type="button"
					size="sm"
					variant="outline"
					className="size-8 rounded-lg p-0"
					disabled={page <= 0}
					onClick={() => onPageChange(page - 1)}
					aria-label="Previous page"
				>
					<RiArrowLeftSLine size={16} />
				</Button>
				{pages.map((p) => (
					<Button
						key={p}
						type="button"
						size="sm"
						variant={p === page ? "default" : "outline"}
						className="size-8 rounded-lg p-0"
						onClick={() => onPageChange(p)}
					>
						{p + 1}
					</Button>
				))}
				<Button
					type="button"
					size="sm"
					variant="outline"
					className="size-8 rounded-lg p-0"
					disabled={page >= pageCount - 1}
					onClick={() => onPageChange(page + 1)}
					aria-label="Next page"
				>
					<RiArrowRightSLine size={16} />
				</Button>
				<Button
					type="button"
					size="sm"
					variant="outline"
					className="size-8 rounded-lg p-0"
					disabled={page >= pageCount - 1}
					onClick={() => onPageChange(pageCount - 1)}
					aria-label="Last page"
				>
					<RiArrowRightDoubleLine size={14} />
				</Button>
			</div>
		</div>
	);
}
