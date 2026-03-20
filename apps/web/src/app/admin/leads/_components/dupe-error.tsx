"use client";

import { RiErrorWarningLine } from "@remixicon/react";

export function DupeError({ name }: { name: string | null }) {
	return (
		<p className="flex items-center gap-1 text-destructive text-xs">
			<RiErrorWarningLine className="size-3.5 shrink-0" />
			Already used by <strong>{name}</strong>
		</p>
	);
}

