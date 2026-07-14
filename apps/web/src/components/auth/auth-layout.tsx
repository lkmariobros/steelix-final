"use client";

import { ModeToggle } from "@/components/mode-toggle";
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
		<div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
			<div className="absolute top-4 right-4">
				<ModeToggle />
			</div>

			<div className="mb-10 flex flex-col items-center gap-2.5">
				<img
					src={BRAND_LOGO_SRC}
					width={48}
					height={48}
					alt={`${BRAND_NAME} logo`}
					className="h-12 w-12 rounded-xl object-cover shadow-sm"
				/>
				<span className="font-semibold text-xl tracking-tight text-foreground">
					{BRAND_NAME}
				</span>
			</div>

			<div className="w-full max-w-sm">
				<div className="mb-7 text-center">
					<h1 className="font-semibold text-2xl tracking-tight text-foreground">
						{title}
					</h1>
					<p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
						{subtitle}
					</p>
				</div>

				<div className="rounded-2xl border border-border bg-card p-7 text-card-foreground shadow-sm">
					{children}
				</div>
			</div>
		</div>
	);
}
