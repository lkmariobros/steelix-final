"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import {
	RiArrowRightLine,
	RiNotificationLine,
	RiPushpinLine,
	RiTimeLine,
} from "@remixicon/react";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";

interface AnnouncementWidgetProps {
	className?: string;
}

export function AnnouncementWidget({ className }: AnnouncementWidgetProps) {
	const router = useRouter();
	const { data: session } = authClient.useSession();

	const { data: announcementsData, isLoading } =
		trpc.calendar.listAnnouncements.useQuery(
			{ includeExpired: false, includeInactive: false },
			{
				enabled: !!session,
				refetchInterval: 60000, // Refetch every minute
			},
		);

	const announcements = announcementsData?.announcements || [];
	// Show only pinned announcements or the 3 most recent
	const displayAnnouncements = announcements
		.filter((a) => a.isPinned)
		.concat(announcements.filter((a) => !a.isPinned))
		.slice(0, 3);

	const formatDate = (date: Date | string) => {
		try {
			const dateObj = typeof date === "string" ? new Date(date) : date;
			return formatDistanceToNow(dateObj, { addSuffix: true });
		} catch {
			return "";
		}
	};

	const getPriorityColor = (priority: string) => {
		switch (priority) {
			case "urgent":
				return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
			case "high":
				return "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400";
			case "normal":
				return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
			case "low":
				return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
			default:
				return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
		}
	};

	return (
		<Card className={className}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<RiNotificationLine className="size-5 text-primary" />
						<div>
							<CardTitle className="text-lg">Office Announcements</CardTitle>
							<CardDescription>
								{announcements.length === 0
									? "No new announcements"
									: `${announcements.length} announcement${announcements.length !== 1 ? "s" : ""}`}
							</CardDescription>
						</div>
					</div>
					{announcements.length > 0 && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => router.push("/dashboard/calendar")}
							className="gap-1"
						>
							View All
							<RiArrowRightLine className="size-4" />
						</Button>
					)}
				</div>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<div className="flex flex-col items-center justify-center py-8 text-center">
						<div className="text-muted-foreground text-sm">
							Loading announcements...
						</div>
					</div>
				) : displayAnnouncements.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-8 text-center">
						<RiNotificationLine className="mb-4 size-12 text-muted-foreground" />
						<p className="font-medium text-sm">No announcements</p>
						<p className="mt-1 text-muted-foreground text-xs">
							Check back later for office updates
						</p>
					</div>
				) : (
					<div className="space-y-4">
						{displayAnnouncements.map((announcement) => (
							<div
								key={announcement.id}
								className="cursor-pointer rounded-lg border bg-muted/30 p-3 transition-colors hover:bg-muted/50"
								onClick={() => router.push("/dashboard/calendar")}
							>
								<div className="mb-2 flex items-start justify-between gap-2">
									<div className="flex min-w-0 flex-1 items-center gap-2">
										{announcement.isPinned && (
											<RiPushpinLine className="size-4 shrink-0 text-yellow-500" />
										)}
										<h4 className="truncate font-medium text-sm">
											{announcement.title}
										</h4>
									</div>
									<Badge
										className={`${getPriorityColor(announcement.priority || "normal")} shrink-0`}
									>
										{announcement.priority || "normal"}
									</Badge>
								</div>
								<p className="mb-2 line-clamp-2 text-muted-foreground text-xs">
									{announcement.content}
								</p>
								<div className="flex items-center gap-2 text-muted-foreground text-xs">
									<RiTimeLine className="size-3" />
									<span>{formatDate(announcement.createdAt)}</span>
									{announcement.expiresAt && (
										<>
											<span>•</span>
											<span>Expires {formatDate(announcement.expiresAt)}</span>
										</>
									)}
								</div>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
