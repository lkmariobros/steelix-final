"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { TierBadge } from "./tier-badge";
import {
	type AgentTier,
	AGENT_TIER_CONFIG,
	TIER_ORDER,
	TIER_COLORS,
} from "@/lib/agent-tier-config";
import {
	RiUserLine,
	RiLoader4Line,
	RiArrowUpLine,
	RiShieldStarLine,
} from "@remixicon/react";

const tierManagementSchema = z.object({
	newTier: z.enum([
		"advisor",
		"sales_leader",
		"team_leader",
		"group_leader",
		"supreme_leader",
	]),
	primaryCommission: z.coerce
		.number()
		.min(0, "Min 0%")
		.max(100, "Max 100%"),
	secondaryCommission: z.coerce
		.number()
		.min(0, "Min 0%")
		.max(100, "Max 100%"),
	reason: z
		.string()
		.min(10, "Please provide a detailed reason (at least 10 characters)"),
	monthlySales: z.coerce.number().min(0).optional(),
	teamMembers: z.coerce.number().min(0).optional(),
});

type TierManagementFormValues = z.infer<typeof tierManagementSchema>;

interface AgentManagementDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	agent: {
		id: string;
		name: string;
		email: string;
		agentTier: AgentTier | null;
		role: string | null;
		companyCommissionSplit?: number | null;
		primaryCommissionSplit?: number | null;
	};
	onSuccess?: () => void;
}

export function AgentManagementDialog({
	open,
	onOpenChange,
	agent,
	onSuccess,
}: AgentManagementDialogProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const currentTier = (agent.agentTier || "advisor") as AgentTier;
	const defaultSecondary =
		agent.companyCommissionSplit ??
		AGENT_TIER_CONFIG[currentTier].commissionSplit;
	const defaultPrimary = agent.primaryCommissionSplit ?? 100;

	const utils = trpc.useUtils();
	const promoteMutation = trpc.agentTiers.promoteAgent.useMutation({
		onSuccess: () => {
			toast.success(`Successfully updated ${agent.name}'s tier!`, {
				description: "The agent has been notified of their tier change.",
			});
			utils.agents.list.invalidate();
			utils.agents.getById.invalidate({ id: agent.id });
			onSuccess?.();
			onOpenChange(false);
		},
		onError: (error) => {
			toast.error("Failed to update tier", {
				description: error.message,
			});
		},
	});

	const form = useForm<TierManagementFormValues>({
		resolver: zodResolver(tierManagementSchema),
		defaultValues: {
			newTier: currentTier,
			primaryCommission: defaultPrimary,
			secondaryCommission: defaultSecondary,
			reason: "",
			monthlySales: 0,
			teamMembers: 0,
		},
	});

	useEffect(() => {
		if (!open) return;
		form.reset({
			newTier: currentTier,
			primaryCommission: defaultPrimary,
			secondaryCommission: defaultSecondary,
			reason: "",
			monthlySales: 0,
			teamMembers: 0,
		});
	}, [
		open,
		currentTier,
		defaultPrimary,
		defaultSecondary,
		form,
		agent.id,
	]);

	const watchedTier = form.watch("newTier");
	const watchedPrimary = form.watch("primaryCommission");
	const watchedSecondary = form.watch("secondaryCommission");
	const watchedSales = form.watch("monthlySales") || 0;
	const watchedTeam = form.watch("teamMembers") || 0;

	const isTierChange = watchedTier !== currentTier;
	const isCommissionChange =
		Number(watchedPrimary) !== Number(defaultPrimary) ||
		Number(watchedSecondary) !== Number(defaultSecondary);
	const hasChanges = isTierChange || isCommissionChange;
	const isPromotion =
		TIER_ORDER.indexOf(watchedTier) > TIER_ORDER.indexOf(currentTier);

	async function onSubmit(values: TierManagementFormValues) {
		if (!hasChanges) {
			toast.info("No changes to save");
			return;
		}

		setIsSubmitting(true);
		try {
			await promoteMutation.mutateAsync({
				agentId: agent.id,
				newTier: values.newTier,
				reason: values.reason,
				secondaryCommissionSplit: values.secondaryCommission,
				primaryCommissionSplit: values.primaryCommission,
				performanceMetrics: {
					monthlySales: values.monthlySales || 0,
					teamMembers: values.teamMembers || 0,
				},
			});
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<RiShieldStarLine className="h-5 w-5 text-primary" />
						Manage Agent Tier
					</DialogTitle>
					<DialogDescription>
						Update tier and commission split for {agent.name}
					</DialogDescription>
				</DialogHeader>

				<div className="flex items-center gap-4 rounded-lg border bg-muted/50 p-4">
					<div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
						<RiUserLine className="h-6 w-6 text-primary" />
					</div>
					<div className="flex-1">
						<h3 className="font-semibold">{agent.name}</h3>
						<p className="text-muted-foreground text-sm">{agent.email}</p>
					</div>
					<TierBadge tier={currentTier} />
				</div>

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
						{/* Section 1 — Select Tier */}
						<section className="space-y-3 rounded-lg border p-4">
							<h4 className="font-semibold text-sm">Select Tier</h4>
							<FormField
								control={form.control}
								name="newTier"
								render={({ field }) => (
									<FormItem>
										<div className="mt-1 grid grid-cols-5 gap-2">
											{TIER_ORDER.map((tier) => {
												const config = AGENT_TIER_CONFIG[tier];
												const colors = TIER_COLORS[tier];
												const isSelected = field.value === tier;
												const isCurrent = tier === currentTier;

												return (
													<button
														key={tier}
														type="button"
														onClick={() => {
															field.onChange(tier);
															form.setValue(
																"secondaryCommission",
																config.commissionSplit,
																{ shouldDirty: true },
															);
														}}
														className={`rounded-lg border-2 p-3 text-center transition-all ${
															isSelected
																? `${colors.border} ${colors.bg} ring-2 ring-primary`
																: "border-muted hover:border-primary/50"
														} ${isCurrent ? "relative" : ""}`}
													>
														<span className="mb-1 block text-2xl">
															{colors.icon}
														</span>
														<span className="block truncate font-medium text-xs">
															{config.displayName}
														</span>
														<span className="block text-muted-foreground text-xs">
															{config.commissionSplit}%
														</span>
														{isCurrent ? (
															<span className="-top-2 -right-2 absolute rounded bg-blue-500 px-1 text-white text-xs">
																Current
															</span>
														) : null}
													</button>
												);
											})}
										</div>
										<FormMessage />
									</FormItem>
								)}
							/>
						</section>

						{/* Section 2 — Primary / Secondary Commission */}
						<section className="space-y-3 rounded-lg border p-4">
							<div>
								<h4 className="font-semibold text-sm">Commission</h4>
								<p className="text-muted-foreground text-xs">
									Edit primary and secondary commission percentages for this
									agent
								</p>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<FormField
									control={form.control}
									name="primaryCommission"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Primary Commission (%)</FormLabel>
											<FormControl>
												<Input type="number" min={0} max={100} {...field} />
											</FormControl>
											<FormDescription className="text-xs">
												Primary market agent entitlement
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="secondaryCommission"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Secondary Commission (%)</FormLabel>
											<FormControl>
												<Input type="number" min={0} max={100} {...field} />
											</FormControl>
											<FormDescription className="text-xs">
												Secondary market agent split (tier default{" "}
												{AGENT_TIER_CONFIG[watchedTier].commissionSplit}%)
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>
						</section>

						{hasChanges ? (
							<div
								className={`rounded-lg border-2 p-4 ${
									isPromotion
										? "border-green-500 bg-green-50 dark:bg-green-950/30"
										: "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
								}`}
							>
								<div className="mb-2 flex items-center gap-2">
									{isPromotion ? (
										<RiArrowUpLine className="h-5 w-5 text-green-600" />
									) : (
										<RiArrowUpLine className="h-5 w-5 rotate-180 text-amber-600" />
									)}
									<span className="font-semibold">
										{isTierChange
											? isPromotion
												? "Promotion"
												: "Tier Change"
											: "Commission Update"}
									</span>
								</div>
								<div className="space-y-1 text-sm">
									{isTierChange ? (
										<div className="flex items-center justify-between">
											<span>Tier:</span>
											<span className="font-medium">
												{AGENT_TIER_CONFIG[currentTier].displayName} →{" "}
												{AGENT_TIER_CONFIG[watchedTier].displayName}
											</span>
										</div>
									) : null}
									<div className="flex items-center justify-between">
										<span>Primary Commission:</span>
										<span className="font-bold tabular-nums">
											{defaultPrimary}% → {watchedPrimary}%
										</span>
									</div>
									<div className="flex items-center justify-between">
										<span>Secondary Commission:</span>
										<span className="font-bold tabular-nums">
											{defaultSecondary}% → {watchedSecondary}%
										</span>
									</div>
								</div>
							</div>
						) : null}

						<div className="grid grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="monthlySales"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Monthly Sales (Optional)</FormLabel>
										<FormControl>
											<Input type="number" placeholder="0" {...field} />
										</FormControl>
										<FormDescription className="text-xs">
											Current month sales count
											{watchedSales > 0 ? ` · ${watchedSales}` : ""}
										</FormDescription>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="teamMembers"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Team Members (Optional)</FormLabel>
										<FormControl>
											<Input type="number" placeholder="0" {...field} />
										</FormControl>
										<FormDescription className="text-xs">
											Direct team size
											{watchedTeam > 0 ? ` · ${watchedTeam}` : ""}
										</FormDescription>
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name="reason"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Reason for Change *</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Explain why this tier change is being made..."
											className="min-h-[80px]"
											{...field}
										/>
									</FormControl>
									<FormDescription className="text-xs">
										This will be recorded in the audit log
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={isSubmitting || !hasChanges}
								className={
									isPromotion ? "bg-green-600 hover:bg-green-700" : ""
								}
							>
								{isSubmitting ? (
									<RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
								) : null}
								{hasChanges
									? isTierChange
										? isPromotion
											? "Promote Agent"
											: "Update Tier"
										: "Save Commission"
									: "No Changes"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
