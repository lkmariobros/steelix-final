"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { trpc } from "@/utils/trpc";
import { RiCheckLine, RiCloseLine, RiPriceTagLine } from "@remixicon/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Tag {
	id: string;
	name: string;
}

interface TagSelectorProps {
	value: string[]; // Array of tag IDs
	onChange: (tagIds: string[]) => void;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
}

export function TagSelector({
	value,
	onChange,
	placeholder = "Select tags...",
	disabled = false,
	className,
}: TagSelectorProps) {
	const [open, setOpen] = useState(false);

	// Fetch all tags (Command component handles search internally)
	const { data: tagsData, isLoading } = trpc.tags.list.useQuery(
		{
			page: 1,
			limit: 100, // Get all tags for selection
		},
		{
			enabled: open, // Only fetch when popover is open
			staleTime: 30000,
		},
	);

	const tags = tagsData?.tags || [];
	const selectedTags = tags.filter((tag) => value.includes(tag.id));

	const handleToggleTag = (tagId: string) => {
		if (value.includes(tagId)) {
			// Remove tag
			onChange(value.filter((id) => id !== tagId));
		} else {
			// Add tag
			onChange([...value, tagId]);
		}
	};

	const handleRemoveTag = (tagId: string, e: React.MouseEvent) => {
		e.stopPropagation();
		onChange(value.filter((id) => id !== tagId));
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					disabled={disabled}
					className={cn(
						"w-full justify-start min-h-9 h-auto py-2",
						!value.length && "text-muted-foreground",
						className,
					)}
				>
					<RiPriceTagLine className="mr-2 h-4 w-4 shrink-0" />
					<div className="flex flex-1 flex-wrap gap-1">
						{selectedTags.length > 0 ? (
							selectedTags.map((tag) => (
								<Badge
									key={tag.id}
									variant="secondary"
									className="mr-1 mb-1"
									onClick={(e) => handleRemoveTag(tag.id, e)}
								>
									{tag.name}
									<RiCloseLine className="ml-1 h-3 w-3 cursor-pointer" />
								</Badge>
							))
						) : (
							<span>{placeholder}</span>
						)}
					</div>
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[400px] p-0" align="start">
				<Command shouldFilter={true}>
					<CommandInput placeholder="Search tags..." />
					<CommandList>
						<CommandEmpty>
							{isLoading ? "Loading tags..." : "No tags found."}
						</CommandEmpty>
						<CommandGroup>
							{tags.map((tag) => {
								const isSelected = value.includes(tag.id);
								return (
									<CommandItem
										key={tag.id}
										value={tag.name}
										onSelect={() => handleToggleTag(tag.id)}
										className="cursor-pointer"
									>
										<RiCheckLine
											className={cn(
												"mr-2 h-4 w-4",
												isSelected ? "opacity-100" : "opacity-0",
											)}
										/>
										{tag.name}
									</CommandItem>
								);
							})}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
