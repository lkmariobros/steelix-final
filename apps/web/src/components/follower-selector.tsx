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
import { RiCheckLine, RiCloseLine, RiTeamLine } from "@remixicon/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type AgentOption = {
	agentId: string;
	agentName: string | null;
	agentEmail: string;
};

interface FollowerSelectorProps {
	value: string[];
	onChange: (followerIds: string[]) => void;
	agents: AgentOption[];
	placeholder?: string;
	disabled?: boolean;
	className?: string;
}

export function FollowerSelector({
	value,
	onChange,
	agents,
	placeholder = "Add followers…",
	disabled = false,
	className,
}: FollowerSelectorProps) {
	const [open, setOpen] = useState(false);

	const options = agents;
	const selectedAgents = options.filter((a) => value.includes(a.agentId));

	const handleToggle = (agentId: string) => {
		if (value.includes(agentId)) {
			onChange(value.filter((id) => id !== agentId));
		} else {
			onChange([...value, agentId]);
		}
	};

	const handleRemove = (agentId: string, e: React.MouseEvent) => {
		e.stopPropagation();
		onChange(value.filter((id) => id !== agentId));
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
					<RiTeamLine className="mr-2 h-4 w-4 shrink-0" />
					<div className="flex flex-1 flex-wrap gap-1">
						{selectedAgents.length > 0 ? (
							selectedAgents.map((agent) => (
								<Badge
									key={agent.agentId}
									variant="secondary"
									className="mr-1 mb-1"
									onClick={(e) => handleRemove(agent.agentId, e)}
								>
									{agent.agentName ?? agent.agentEmail}
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
				<Command shouldFilter>
					<CommandInput placeholder="Search agents…" />
					<CommandList>
						<CommandEmpty>No agents found.</CommandEmpty>
						<CommandGroup>
							{options.map((agent) => {
								const isSelected = value.includes(agent.agentId);
								const label = agent.agentName ?? agent.agentEmail;
								return (
									<CommandItem
										key={agent.agentId}
										value={label}
										onSelect={() => handleToggle(agent.agentId)}
										className="cursor-pointer"
									>
										<RiCheckLine
											className={cn(
												"mr-2 h-4 w-4",
												isSelected ? "opacity-100" : "opacity-0",
											)}
										/>
										{label}
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
