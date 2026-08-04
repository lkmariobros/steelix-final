"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/utils/trpc";
import { Plus, Search, Trash2, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
	buildCoBrokingDataFromAgents,
	createEmptyCoBrokeAgent,
	normalizeCoBrokingAgents,
	totalCoBrokerSplit,
	yourShareFromCoBrokeAgents,
	type CoBrokeAgentEntry,
	type CoBrokingDataShape,
} from "../utils/co-broking-utils";

function formatAgentPickerLabel(agent: {
	name: string | null;
	nickName?: string | null;
	agentCode: string | null;
	email?: string | null;
}) {
	const name = agent.name?.trim() || "Unnamed";
	const code = agent.agentCode?.trim();
	return code ? `${name} (${code})` : name;
}

interface CoBrokeAgentsFieldsProps {
	value?: CoBrokingDataShape | null;
	onChange: (next: CoBrokingDataShape) => void;
	marketType?: "primary" | "secondary";
	disabled?: boolean;
}

export function CoBrokeAgentsFields({
	value,
	onChange,
	marketType,
	disabled,
}: CoBrokeAgentsFieldsProps) {
	const agents = useMemo(() => normalizeCoBrokingAgents(value), [value]);
	const [searchById, setSearchById] = useState<Record<string, string>>({});
	const [openPickerId, setOpenPickerId] = useState<string | null>(null);

	const activeSearch = openPickerId
		? (searchById[openPickerId] ?? "").trim()
		: "";

	const { data: coBrokingAgents = [], isLoading: coBrokingAgentsLoading } =
		trpc.agents.searchForCoBroking.useQuery(
			{ search: activeSearch || undefined, limit: 50 },
			{
				enabled: Boolean(openPickerId),
				staleTime: 30_000,
			},
		);

	const commit = (nextAgents: CoBrokeAgentEntry[]) => {
		onChange(buildCoBrokingDataFromAgents(nextAgents));
	};

	const updateAgent = (
		id: string,
		patch: Partial<CoBrokeAgentEntry>,
	) => {
		commit(
			agents.map((a) => (a.id === id ? { ...a, ...patch } : a)),
		);
	};

	const addAgent = () => {
		const remaining = Math.max(0, 100 - totalCoBrokerSplit(agents));
		const suggested = remaining > 0 ? Math.min(50, remaining) : 0;
		commit([...agents, createEmptyCoBrokeAgent(suggested)]);
	};

	const removeAgent = (id: string) => {
		if (agents.length <= 1) {
			commit([createEmptyCoBrokeAgent(50)]);
			return;
		}
		commit(agents.filter((a) => a.id !== id));
	};

	const selectInternalAgent = (
		entryId: string,
		agent: {
			id: string;
			name: string | null;
			nickName?: string | null;
			email: string | null;
			phone: string | null;
			branch: string | null;
			agentCode: string | null;
		},
	) => {
		updateAgent(entryId, {
			internalAgentId: agent.id,
			agentName: agent.name ?? "",
			agentEmail: agent.email ?? "",
			agentPhone: agent.phone ?? "",
			agencyName: agent.branch ?? "Devots",
			contactInfo: [agent.email, agent.phone].filter(Boolean).join(" · "),
		});
		setSearchById((prev) => ({ ...prev, [entryId]: "" }));
		setOpenPickerId(null);
		toast.success(`Co-broke agent: ${agent.name ?? "Selected"}`);
	};

	const clearInternalAgent = (entryId: string) => {
		updateAgent(entryId, {
			internalAgentId: undefined,
			agentName: "",
			agentEmail: "",
			agentPhone: "",
			agencyName: "",
			contactInfo: "",
		});
		setOpenPickerId(entryId);
	};

	const yourShare = yourShareFromCoBrokeAgents(agents);
	const coTotal = totalCoBrokerSplit(agents);
	const isSecondary = marketType === "secondary";

	return (
		<div className="mt-4 space-y-4 rounded-lg border p-4">
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<UserPlus className="h-4 w-4" />
					<p className="font-medium text-sm">Co-broke Agents</p>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="gap-1"
					disabled={disabled || coTotal >= 100}
					onClick={addAgent}
				>
					<Plus className="h-3.5 w-3.5" />
					Add co-broke
				</Button>
			</div>

			<p className="text-muted-foreground text-xs">
				Add one or more co-broke agents and set each share. Your remaining
				share updates automatically.
			</p>

			{agents.map((agent, index) => {
				const search = searchById[agent.id] ?? "";
				const showPicker = openPickerId === agent.id;
				const selectedLabel = agent.internalAgentId
					? agent.agentName || "Selected agent"
					: null;

				return (
					<div
						key={agent.id}
						className="space-y-3 rounded-md border bg-muted/20 p-3"
					>
						<div className="flex items-center justify-between gap-2">
							<p className="font-medium text-sm">
								Co-broke {index + 1}
							</p>
							{agents.length > 1 ? (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-8 text-destructive"
									disabled={disabled}
									onClick={() => removeAgent(agent.id)}
								>
									<Trash2 className="mr-1 h-3.5 w-3.5" />
									Remove
								</Button>
							) : null}
						</div>

						{selectedLabel ? (
							<div className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm">
								<span>
									<span className="text-muted-foreground">Selected: </span>
									{selectedLabel}
								</span>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									disabled={disabled}
									onClick={() => clearInternalAgent(agent.id)}
								>
									Change
								</Button>
							</div>
						) : (
							<div className="relative">
								<Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
								<Input
									className="pl-8"
									placeholder="Search internal agents…"
									disabled={disabled}
									value={search}
									onChange={(e) => {
										setSearchById((prev) => ({
											...prev,
											[agent.id]: e.target.value,
										}));
										setOpenPickerId(agent.id);
									}}
									onFocus={() => setOpenPickerId(agent.id)}
									onKeyDown={(e) => {
										if (e.key === "Enter") e.preventDefault();
									}}
								/>
							</div>
						)}

						{showPicker && !selectedLabel ? (
							<ul className="max-h-40 space-y-1 overflow-y-auto rounded border bg-background p-2">
								{coBrokingAgentsLoading ? (
									<li className="px-2 py-1.5 text-muted-foreground text-sm">
										Loading agents…
									</li>
								) : coBrokingAgents.length === 0 ? (
									<li className="px-2 py-1.5 text-muted-foreground text-sm">
										No agents found
									</li>
								) : (
									coBrokingAgents.map((a) => (
										<li key={a.id}>
											<button
												type="button"
												className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
												onMouseDown={(e) => e.preventDefault()}
												onClick={(e) => {
													e.preventDefault();
													e.stopPropagation();
													selectInternalAgent(agent.id, a);
												}}
											>
												{formatAgentPickerLabel(a)}
											</button>
										</li>
									))
								)}
							</ul>
						) : null}

						<div className="grid gap-3 sm:grid-cols-2">
							<div className="space-y-1.5">
								<Label>Co-broker share (%)</Label>
								<Input
									type="number"
									min={0}
									max={100}
									disabled={disabled}
									value={agent.commissionSplit ?? 50}
									onChange={(e) =>
										updateAgent(agent.id, {
											commissionSplit: Number(e.target.value),
										})
									}
								/>
							</div>
						</div>

						{isSecondary ? (
							<div className="space-y-3 border-t pt-3">
								<p className="font-medium text-sm">Co-agency (external)</p>
								<p className="text-muted-foreground text-xs">
									For external co-agency, enter agency and agent name instead of
									selecting an internal agent.
								</p>
								<div className="grid gap-3 sm:grid-cols-2">
									<div className="space-y-1.5">
										<Label>Agency name</Label>
										<Input
											disabled={disabled || Boolean(agent.internalAgentId)}
											value={agent.agencyName ?? ""}
											onChange={(e) =>
												updateAgent(agent.id, {
													agencyName: e.target.value,
													internalAgentId: undefined,
												})
											}
										/>
									</div>
									<div className="space-y-1.5">
										<Label>Agent name</Label>
										<Input
											disabled={disabled || Boolean(agent.internalAgentId)}
											value={agent.agentName ?? ""}
											onChange={(e) =>
												updateAgent(agent.id, {
													agentName: e.target.value,
													internalAgentId: undefined,
												})
											}
										/>
									</div>
									<div className="space-y-1.5">
										<Label>Phone</Label>
										<Input
											disabled={disabled || Boolean(agent.internalAgentId)}
											value={agent.agentPhone ?? ""}
											onChange={(e) =>
												updateAgent(agent.id, {
													agentPhone: e.target.value,
												})
											}
										/>
									</div>
									<div className="space-y-1.5">
										<Label>Email</Label>
										<Input
											disabled={disabled || Boolean(agent.internalAgentId)}
											value={agent.agentEmail ?? ""}
											onChange={(e) =>
												updateAgent(agent.id, {
													agentEmail: e.target.value,
												})
											}
										/>
									</div>
								</div>
							</div>
						) : null}
					</div>
				);
			})}

			<div className="rounded-md border bg-primary/5 px-3 py-2 text-sm">
				<span className="text-muted-foreground">Your share: </span>
				<span className="font-medium">{yourShare}%</span>
				<span className="mx-2 text-muted-foreground">·</span>
				<span className="text-muted-foreground">Co-broke total: </span>
				<span
					className={
						coTotal > 100 ? "font-medium text-destructive" : "font-medium"
					}
				>
					{coTotal}%
				</span>
				{coTotal > 100 ? (
					<p className="mt-1 text-destructive text-xs">
						Combined co-broker shares cannot exceed 100%.
					</p>
				) : null}
			</div>
		</div>
	);
}
