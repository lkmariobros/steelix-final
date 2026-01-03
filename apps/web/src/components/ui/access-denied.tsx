import { RiShieldUserLine } from "@remixicon/react";
import { Button } from "./button";
import { useRouter } from "next/navigation";

interface AccessDeniedProps {
	title?: string;
	message?: string;
	userRole?: string;
	redirectPath?: string;
	redirectLabel?: string;
	className?: string;
}

export function AccessDenied({
	title = "Access Denied",
	message = "You don't have permission to access this resource.",
	userRole,
	redirectPath = "/dashboard",
	redirectLabel = "Go to Dashboard",
	className
}: AccessDeniedProps) {
	const router = useRouter();

	return (
		<div className={`flex h-screen items-center justify-center ${className || ""}`}>
			<div className="text-center max-w-md">
				<RiShieldUserLine size={48} className="mx-auto text-muted-foreground mb-4" />
				<h1 className="text-2xl font-semibold mb-2">{title}</h1>
				<p className="text-muted-foreground mb-4">{message}</p>
				{userRole && (
					<p className="text-muted-foreground text-sm mb-4">
						Current role: {userRole}
					</p>
				)}
				<Button
					onClick={() => router.push(redirectPath)}
					className="gap-2"
				>
					{redirectLabel}
				</Button>
			</div>
		</div>
	);
}
