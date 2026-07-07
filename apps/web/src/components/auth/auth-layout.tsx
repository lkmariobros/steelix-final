"use client";

import { BRAND_LOGO_SRC, BRAND_NAME } from "@/lib/brand";

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
				<img
					src={BRAND_LOGO_SRC}
					width={44}
					height={44}
					alt={`${BRAND_NAME} logo`}
					className="h-11 w-11 rounded-xl object-cover shadow-sm"
				/>
				<span className="font-semibold text-lg tracking-tight text-zinc-900 dark:text-zinc-50">
					{BRAND_NAME}
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
