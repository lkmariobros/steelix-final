"use client";

import { Building2 } from "lucide-react";

interface AuthLayoutProps {
	children: React.ReactNode;
	title: string;
	subtitle: string;
}

/**
 * Minimal auth shell: logo, title, subtitle, and form — no marketing column or stats.
 */
export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
			<div className="mb-8 flex flex-col items-center gap-2">
				<div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900">
					<Building2 className="h-6 w-6" aria-hidden />
				</div>
				<span className="font-semibold text-lg tracking-tight text-zinc-900 dark:text-zinc-50">
					Steelix
				</span>
			</div>

			<div className="w-full max-w-sm">
				<div className="mb-6 text-center">
					<h1 className="font-semibold text-xl text-zinc-900 dark:text-zinc-50">
						{title}
					</h1>
					<p className="mt-1.5 text-muted-foreground text-sm">{subtitle}</p>
				</div>

				<div className="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
					{children}
				</div>
			</div>
		</div>
	);
}
