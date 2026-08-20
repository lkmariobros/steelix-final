"use client";

import { BRAND_LOGO_SRC, BRAND_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
	size?: "sm" | "md" | "lg";
	className?: string;
	text?: string;
}

/** Compact inline spinner — for small UI slots only. */
export function LoadingSpinner({
	size = "md",
	className,
	text,
}: LoadingSpinnerProps) {
	const sizeClasses = {
		sm: "size-4 border-2",
		md: "size-6 border-2",
		lg: "size-8 border-[2.5px]",
	};

	return (
		<div
			className={cn("inline-flex items-center justify-center gap-2.5", className)}
			role="status"
			aria-live="polite"
		>
			<span
				className={cn(
					"animate-spin rounded-full border-primary/25 border-t-primary",
					sizeClasses[size],
				)}
				aria-hidden="true"
			/>
			{text ? (
				<span className="font-medium text-muted-foreground text-sm">{text}</span>
			) : (
				<span className="sr-only">Loading</span>
			)}
		</div>
	);
}

interface LoadingScreenProps {
	text?: string;
	className?: string;
}

/**
 * Full-viewport branded loader used across admin/dashboard auth gates.
 * Fast wind-style motion — logo + Devots wordmark, high contrast.
 */
export function LoadingScreen({
	text = "Loading...",
	className,
}: LoadingScreenProps) {
	return (
		<div
			className={cn(
				"loading-screen relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-background",
				className,
			)}
			role="status"
			aria-live="polite"
			aria-busy="true"
		>
			{/* Atmosphere */}
			<div
				className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--primary)_18%,transparent)_0%,transparent_62%)]"
				aria-hidden="true"
			/>
			<div
				className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-50"
				aria-hidden="true"
			>
				<div className="loading-wind-band loading-wind-band-1" />
				<div className="loading-wind-band loading-wind-band-2" />
				<div className="loading-wind-band loading-wind-band-3" />
				<div className="loading-wind-band loading-wind-band-4" />
			</div>

			<div className="relative z-10 flex flex-col items-center px-6">
				{/* Orbital mark */}
				<div className="relative mb-7 flex size-[7.5rem] items-center justify-center sm:size-36">
					<span className="loading-orbit loading-orbit-outer" aria-hidden="true" />
					<span className="loading-orbit loading-orbit-mid" aria-hidden="true" />
					<span className="loading-orbit loading-orbit-inner" aria-hidden="true" />
					<span className="loading-wind-arc" aria-hidden="true" />

					<div className="loading-logo-pulse relative z-10 flex size-[4.25rem] items-center justify-center rounded-2xl border border-primary/25 bg-card shadow-[0_0_40px_color-mix(in_oklab,var(--primary)_35%,transparent)] sm:size-[4.75rem]">
						<img
							src={BRAND_LOGO_SRC}
							width={56}
							height={56}
							alt=""
							className="size-10 object-contain sm:size-12"
							draggable={false}
						/>
					</div>
				</div>

				{/* Wordmark */}
				<p className="loading-wordmark font-bold text-2xl tracking-[0.22em] text-foreground uppercase sm:text-3xl">
					{BRAND_NAME}
				</p>
				<p className="mt-2 max-w-[16rem] text-center font-medium text-muted-foreground text-sm tracking-wide sm:text-[15px]">
					{text}
				</p>

				{/* Speed dashes */}
				<div
					className="mt-6 flex h-1 w-40 items-center justify-center gap-1.5 overflow-hidden sm:w-48"
					aria-hidden="true"
				>
					<span className="loading-dash loading-dash-1" />
					<span className="loading-dash loading-dash-2" />
					<span className="loading-dash loading-dash-3" />
					<span className="loading-dash loading-dash-4" />
					<span className="loading-dash loading-dash-5" />
				</div>
			</div>
		</div>
	);
}
