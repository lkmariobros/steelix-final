"use client";

import { cn } from "@/lib/utils";
import {
	RiCheckLine,
	RiComputerLine,
	RiMoonLine,
	RiSunLine,
} from "@remixicon/react";
import { useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";

export function formatSettingsLabel(value: string | null | undefined) {
	if (!value?.trim()) return null;
	return value.replaceAll("_", " ");
}

export function titleCaseWords(value: string) {
	return value
		.split(/\s+/)
		.map((part) =>
			part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part,
		)
		.join(" ");
}

export function SettingsSectionTitle({
	title,
	description,
}: {
	title: string;
	description?: string;
}) {
	return (
		<div className="space-y-1">
			<h2 className="font-semibold text-foreground text-lg">{title}</h2>
			{description ? (
				<p className="text-foreground/70 text-sm leading-relaxed">
					{description}
				</p>
			) : null}
		</div>
	);
}

export function SettingsFieldRow({
	label,
	value,
	emptyLabel = "Not assigned",
	valueClassName,
}: {
	label: string;
	value?: string | null;
	emptyLabel?: string;
	valueClassName?: string;
}) {
	const display = value?.trim() ? value : null;
	return (
		<div className="grid gap-1 border-b border-border/80 py-3.5 last:border-b-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center sm:gap-6">
			<p className="font-medium text-foreground/80 text-sm">{label}</p>
			{display ? (
				<p
					className={cn(
						"break-all font-semibold text-base text-foreground",
						valueClassName,
					)}
				>
					{display}
				</p>
			) : (
				<span className="inline-flex w-fit items-center rounded-md border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 font-semibold text-amber-800 text-sm dark:text-amber-300">
					{emptyLabel}
				</span>
			)}
		</div>
	);
}

const THEME_CHOICES = [
	{
		value: "light",
		label: "Light",
		hint: "Bright workspace",
		icon: RiSunLine,
	},
	{
		value: "dark",
		label: "Dark",
		hint: "Low-glare view",
		icon: RiMoonLine,
	},
	{
		value: "system",
		label: "System",
		hint: "Match device",
		icon: RiComputerLine,
	},
] as const;

export function ThemePicker() {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const active = mounted ? (theme ?? "system") : "system";

	return (
		<div className="grid gap-3 sm:grid-cols-3">
			{THEME_CHOICES.map(({ value, label, hint, icon: Icon }) => {
				const selected = active === value;
				return (
					<button
						key={value}
						type="button"
						onClick={() => setTheme(value)}
						className={cn(
							"flex min-h-[88px] items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors",
							selected
								? "border-primary bg-primary/10"
								: "border-border bg-background hover:border-foreground/25 hover:bg-muted/50",
						)}
					>
						<span
							className={cn(
								"flex size-10 shrink-0 items-center justify-center rounded-lg",
								selected
									? "bg-primary text-primary-foreground"
									: "bg-muted text-foreground",
							)}
						>
							<Icon className="size-5" />
						</span>
						<span className="min-w-0">
							<span className="flex items-center gap-2 font-semibold text-foreground text-sm">
								{label}
								{selected ? (
									<RiCheckLine className="size-4 text-primary" />
								) : null}
							</span>
							<span className="mt-0.5 block text-foreground/70 text-sm">
								{hint}
							</span>
						</span>
					</button>
				);
			})}
		</div>
	);
}

export function SettingsPageIntro({
	icon,
	title,
	description,
	actions,
}: {
	icon: ReactNode;
	title: string;
	description: string;
	actions?: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
			<div className="flex items-start gap-3">
				<div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
					{icon}
				</div>
				<div>
					<h1 className="font-bold text-2xl tracking-tight sm:text-3xl">
						{title}
					</h1>
					<p className="mt-1 max-w-xl text-foreground/75 text-sm leading-relaxed">
						{description}
					</p>
				</div>
			</div>
			{actions}
		</div>
	);
}
