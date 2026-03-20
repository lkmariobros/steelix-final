"use client";

import { cn } from "@/lib/utils";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Calendar,
	type DateRange,
} from "@/components/ui/calendar";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { RiCalendar2Line } from "@remixicon/react";

// Static arrays defined once outside the component
const DTP_HOURS = Array.from({ length: 12 }, (_, i) =>
	String(i + 1).padStart(2, "0"),
);
const DTP_MINUTES = Array.from({ length: 60 }, (_, i) =>
	String(i).padStart(2, "0"),
);

export function DateTimePicker({
	value,
	onChange,
	placeholder = "Pick date & time",
}: {
	value: string; // "YYYY-MM-DDTHH:mm"
	onChange: (v: string) => void;
	placeholder?: string;
}) {
	const [open, setOpen] = useState(false);

	const dateObj = value ? new Date(value) : undefined;
	const isValid = dateObj && !Number.isNaN(dateObj.getTime());

	const timePart = value?.split("T")[1]?.slice(0, 5) ?? "09:00";
	const [rawH, rawM] = timePart.split(":").map(Number);
	const currentAmPm: "AM" | "PM" = rawH >= 12 ? "PM" : "AM";
	const hour12Num = rawH % 12 === 0 ? 12 : rawH % 12;
	const currentHour12 = String(hour12Num).padStart(2, "0");
	const currentMinute = String(rawM).padStart(2, "0");

	const displayValue = isValid
		? dateObj.toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
				year: "numeric",
			}) +
			" · " +
			dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
		: null;

	const handleDaySelect = (day: Date | undefined) => {
		if (!day) return;
		const pad = (n: number) => String(n).padStart(2, "0");
		const dateStr = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
		onChange(`${dateStr}T${timePart}`);
	};

	const applyTime = (
		hour12: string,
		minute: string,
		amPm: "AM" | "PM",
	) => {
		let datePart = value?.split("T")[0];
		if (!datePart) {
			const today = new Date();
			const pad = (n: number) => String(n).padStart(2, "0");
			datePart = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
		}
		let h = parseInt(hour12, 10);
		if (amPm === "AM" && h === 12) h = 0;
		else if (amPm === "PM" && h !== 12) h += 12;
		onChange(`${datePart}T${String(h).padStart(2, "0")}:${minute}`);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						"flex h-8 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-xs transition-colors hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring",
						!displayValue && "text-muted-foreground",
					)}
				>
					<RiCalendar2Line className="size-3.5 shrink-0 text-muted-foreground" />
					{displayValue ?? placeholder}
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="start">
				<Calendar
					mode="single"
					selected={isValid ? dateObj : undefined}
					onSelect={handleDaySelect}
					captionLayout="label"
				/>
				{/* ── Time Picker ── */}
				<div className="border-t px-3 py-3">
					<p className="mb-2.5 font-medium text-muted-foreground text-xs">Time</p>
					<div className="flex items-center gap-2">
						{/* Hour */}
						<Select
							value={currentHour12}
							onValueChange={(v) => applyTime(v, currentMinute, currentAmPm)}
						>
							<SelectTrigger className="h-8 w-[4.5rem] text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="max-h-44">
								{DTP_HOURS.map((h) => (
									<SelectItem key={h} value={h} className="text-xs">
										{h}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<span className="font-bold text-muted-foreground text-sm">:</span>

						{/* Minute */}
						<Select
							value={currentMinute}
							onValueChange={(v) => applyTime(currentHour12, v, currentAmPm)}
						>
							<SelectTrigger className="h-8 w-[4.5rem] text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="max-h-44">
								{DTP_MINUTES.map((m) => (
									<SelectItem key={m} value={m} className="text-xs">
										{m}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						{/* AM / PM toggle */}
						<div className="flex overflow-hidden rounded-md border">
							<button
								type="button"
								className={cn(
									"px-2.5 py-1 text-xs font-medium transition-colors",
									currentAmPm === "AM"
										? "bg-primary text-primary-foreground"
										: "bg-background text-muted-foreground hover:bg-accent",
								)}
								onClick={() => applyTime(currentHour12, currentMinute, "AM")}
							>
								AM
							</button>
							<button
								type="button"
								className={cn(
									"border-l px-2.5 py-1 text-xs font-medium transition-colors",
									currentAmPm === "PM"
										? "bg-primary text-primary-foreground"
										: "bg-background text-muted-foreground hover:bg-accent",
								)}
								onClick={() => applyTime(currentHour12, currentMinute, "PM")}
							>
								PM
							</button>
						</div>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}

