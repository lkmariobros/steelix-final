import { RiLoader4Line } from "@remixicon/react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
	size?: "sm" | "md" | "lg";
	className?: string;
	text?: string;
}

export function LoadingSpinner({ 
	size = "md", 
	className,
	text = "Loading..." 
}: LoadingSpinnerProps) {
	const sizeClasses = {
		sm: "h-4 w-4",
		md: "h-6 w-6", 
		lg: "h-8 w-8"
	};

	const iconSizes = {
		sm: 16,
		md: 24,
		lg: 32
	};

	return (
		<div className={cn("flex items-center justify-center", className)}>
			<RiLoader4Line 
				className={cn("animate-spin text-muted-foreground", sizeClasses[size])}
				size={iconSizes[size]}
				aria-hidden="true"
			/>
			{text && (
				<span className="ml-2 text-muted-foreground text-sm" aria-live="polite">
					{text}
				</span>
			)}
		</div>
	);
}

interface LoadingScreenProps {
	text?: string;
	className?: string;
}

export function LoadingScreen({ 
	text = "Loading...", 
	className 
}: LoadingScreenProps) {
	return (
		<div className={cn("flex h-screen items-center justify-center", className)}>
			<div className="text-center">
				<LoadingSpinner size="lg" text={text} />
			</div>
		</div>
	);
}
