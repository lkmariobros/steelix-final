"use client";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
	RiCheckLine,
	RiComputerLine,
	RiMoonLine,
	RiSunLine,
} from "@remixicon/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const THEME_OPTIONS = [
	{ value: "light", label: "Light", icon: RiSunLine },
	{ value: "dark", label: "Dark", icon: RiMoonLine },
	{ value: "system", label: "System", icon: RiComputerLine },
] as const;

interface ModeToggleProps {
	className?: string;
	align?: "start" | "center" | "end";
}

export function ModeToggle({ className, align = "end" }: ModeToggleProps) {
	const { theme, setTheme, resolvedTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const activeTheme = theme ?? "system";
	const isDark = mounted && resolvedTheme === "dark";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="icon"
					className={cn("relative size-9 shrink-0", className)}
					aria-label="Toggle color theme"
				>
					{mounted ? (
						isDark ? (
							<RiMoonLine className="size-4" aria-hidden="true" />
						) : (
							<RiSunLine className="size-4" aria-hidden="true" />
						)
					) : (
						<span className="size-4" aria-hidden="true" />
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align={align} className="min-w-40">
				{THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
					const selected = mounted && activeTheme === value;
					return (
						<DropdownMenuItem
							key={value}
							onClick={() => setTheme(value)}
							className="cursor-pointer gap-2"
						>
							<Icon className="size-4" aria-hidden="true" />
							<span className="flex-1">{label}</span>
							{selected ? (
								<RiCheckLine className="size-4 text-primary" aria-hidden="true" />
							) : (
								<span className="size-4" aria-hidden="true" />
							)}
						</DropdownMenuItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
