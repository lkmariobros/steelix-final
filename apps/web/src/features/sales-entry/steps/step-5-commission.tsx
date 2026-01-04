"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
	AlertTriangle,
	ArrowLeft,
	ArrowRight,
	Badge as BadgeIcon,
	Calculator,
	DollarSign,
	Info,
	Percent,
	User,
	Users,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

import {
	type CommissionData,
	calculateCommission,
	calculateEnhancedCommission,
	commissionSchema,
	commissionTypeOptions,
	representationTypeOptions,
} from "../transaction-schema";
import { trpc } from "@/utils/trpc";
import type { CoBrokingData, RepresentationType } from "../transaction-schema";

// Issue #1 Fix: Updated props to receive representation type from Step 4
interface StepCommissionProps {
	data?: CommissionData;
	propertyPrice: number;
	coBrokingData?: CoBrokingData["coBrokingData"]; // Co-broker split info from Step 4
	onUpdate: (data: CommissionData) => void;
	onNext: () => void;
	onPrevious: () => void;
}

export function StepCommission({
	data,
	propertyPrice,
	coBrokingData,
	onUpdate,
	onNext,
	onPrevious,
}: StepCommissionProps) {
	// Local state for commission type
	const [localCommissionType, setLocalCommissionType] = useState<
		"percentage" | "fixed"
	>(data?.commissionType || "percentage");

	// Use representation type from data (set in Step 4)
	// Simplified to 2 options: direct or co_broking
	const representationType = data?.representationType || "direct";
	const coBrokerSplit = coBrokingData?.commissionSplit || 50;

	const form = useForm<CommissionData>({
		resolver: zodResolver(commissionSchema),
		defaultValues: {
			commissionType: data?.commissionType || "percentage",
			commissionValue: data?.commissionValue || 0,
			commissionAmount: data?.commissionAmount || 0,
			representationType: data?.representationType || "direct",
			agentTier: data?.agentTier,
			companyCommissionSplit: data?.companyCommissionSplit,
			breakdown: data?.breakdown,
		},
	});

	// Fetch real agent tier info from backend
	const { data: realAgentTierInfo, isLoading: isTierLoading } = trpc.agentTiers.getMyTierInfo.useQuery();
	const { data: uplineInfo } = trpc.agentTiers.getMyUpline.useQuery();

	// Agent tier info with fallback
	const agentTierInfo = realAgentTierInfo ? {
		agentTier: realAgentTierInfo.agentTier as "advisor" | "sales_leader" | "team_leader" | "group_leader" | "supreme_leader",
		companyCommissionSplit: realAgentTierInfo.companyCommissionSplit || 70,
		displayName: realAgentTierInfo.displayName,
		description: realAgentTierInfo.description,
		leadershipBonusRate: realAgentTierInfo.leadershipBonusRate || 0,
	} : {
		agentTier: "advisor" as const,
		companyCommissionSplit: 70,
		displayName: "Advisor",
		description: "Entry level agent",
		leadershipBonusRate: 0,
	};

	// Enhanced commission calculation with co-broker split and leadership bonus
	const watchedCommissionValue = form.watch("commissionValue") || 0;
	const enhancedCommission = React.useMemo(() => {
		if (propertyPrice > 0 && watchedCommissionValue > 0) {
			// Build upline info for leadership bonus calculation
			const uplineData = uplineInfo && uplineInfo.leadershipBonusRate > 0 ? {
				uplineTier: uplineInfo.uplineTier || "advisor",
				leadershipBonusRate: uplineInfo.leadershipBonusRate,
			} : null;

			const baseCommission = calculateEnhancedCommission(
				propertyPrice,
				localCommissionType,
				watchedCommissionValue,
				representationType,
				agentTierInfo.agentTier,
				agentTierInfo.companyCommissionSplit,
				coBrokerSplit,
				uplineData
			);

			return baseCommission;
		}
		return null;
	}, [propertyPrice, localCommissionType, watchedCommissionValue, representationType, coBrokerSplit, agentTierInfo, uplineInfo]);

	const isCalculating = isTierLoading;

	const handleSubmit = useCallback(
		(formData: CommissionData) => {
			onUpdate(formData);
			onNext();
		},
		[onUpdate, onNext],
	);

	const watchedValues = form.watch();
	const { commissionType, commissionValue } = watchedValues;

	// Auto-calculate commission amount when type, value, or representation type changes
	useEffect(() => {
		if (commissionType && commissionValue !== undefined && propertyPrice > 0 && enhancedCommission) {
			// Use enhanced commission calculation
			const calculatedAmount = enhancedCommission.totalCommission;

			// Only update if the value actually changed
			const currentAmount = form.getValues("commissionAmount");
			if (Math.abs(currentAmount - calculatedAmount) > 0.01) {
				form.setValue("commissionAmount", calculatedAmount, {
					shouldValidate: false,
					shouldDirty: false,
					shouldTouch: false,
				});

				// Update enhanced fields
				form.setValue("representationType", representationType);
				form.setValue("agentTier", agentTierInfo?.agentTier);
				form.setValue("companyCommissionSplit", agentTierInfo?.companyCommissionSplit);
				form.setValue("breakdown", enhancedCommission.breakdown);

				// Auto-save after calculation
				setTimeout(() => {
					const values = form.getValues();
					onUpdate(values);
				}, 0);
			}
		}
	}, [commissionType, commissionValue, propertyPrice, representationType, enhancedCommission, agentTierInfo]);

	return (
		<div className="space-y-6">
			{/* Agent Tier Display */}
			{agentTierInfo && (
				<Card className="border-l-4 border-l-blue-500">
					<CardHeader>
						<div className="flex items-center justify-between">
							<CardTitle className="flex items-center gap-2">
								<BadgeIcon className="h-5 w-5" />
								Your Commission Tier
							</CardTitle>
							<Badge variant="outline" className="bg-blue-50">
								{agentTierInfo.displayName}
							</Badge>
						</div>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							<p className="text-sm text-gray-600">
								{agentTierInfo.description}
							</p>
							<div className="flex items-center gap-4 text-sm">
								<span className="flex items-center gap-1">
									<DollarSign className="h-4 w-4" />
									Commission Split: {agentTierInfo.companyCommissionSplit}%
								</span>
								<span className="flex items-center gap-1">
									<Users className="h-4 w-4" />
									Tier: {agentTierInfo.agentTier}
								</span>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			<Card>
				<CardHeader>
					<CardTitle>Commission Calculation</CardTitle>
					<CardDescription>
						Configure how your commission will be calculated for this
						transaction
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(handleSubmit)}
							className="space-y-6"
						>
							{/* Property Price Reference */}
							<Card className="bg-muted/50">
								<CardContent className="pt-6">
									<div className="flex items-center justify-between">
										<span className="text-muted-foreground">
											Property Price:
										</span>
										<span className="font-bold text-2xl">
											${propertyPrice.toLocaleString()}
										</span>
									</div>
								</CardContent>
							</Card>

							{/* Commission Type */}
							<div className="space-y-3">
								<Label className="text-base">Commission Type</Label>
								<RadioGroup
									value={localCommissionType}
									onValueChange={(value: "percentage" | "fixed") => {
										setLocalCommissionType(value);
										form.setValue("commissionType", value);
									}}
									className="flex flex-col space-y-2"
								>
									{commissionTypeOptions.map((option) => (
										<div
											key={option.value}
											className="flex items-center space-x-2"
										>
											<RadioGroupItem value={option.value} id={option.value} />
											<Label
												htmlFor={option.value}
												className="flex cursor-pointer items-center gap-2"
											>
												{option.value === "percentage" ? (
													<Percent className="h-4 w-4" />
												) : (
													<DollarSign className="h-4 w-4" />
												)}
												{option.label}
											</Label>
										</div>
									))}
								</RadioGroup>
								<p className="text-muted-foreground text-sm">
									Choose whether your commission is a percentage of the property
									price or a fixed amount
								</p>
							</div>

							<Separator />

							{/* Representation Type Display (set in Step 4) */}
							<div className="space-y-2">
								<Label className="text-base">Representation Type</Label>
								<div className="p-3 border rounded-lg bg-muted/30">
									<div className="flex items-center gap-2">
										<User className="h-4 w-4 text-muted-foreground" />
										<span className="font-medium">
											{representationType === "co_broking" ? "Co-Broking" : "Direct Representation"}
										</span>
									</div>
									<p className="text-sm text-muted-foreground mt-1">
										{representationType === "co_broking"
											? `Commission split with co-broker (${coBrokerSplit}% to co-broker)`
											: "You receive your full agent share of the commission"
										}
									</p>
								</div>
								<p className="text-xs text-muted-foreground">
									To change representation type, go back to the previous step.
								</p>
							</div>

							<Separator />

							{/* Commission Value */}
							<FormField
								control={form.control}
								name="commissionValue"
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											Commission{" "}
											{commissionType === "percentage"
												? "Percentage"
												: "Amount"}
										</FormLabel>
										<FormControl>
											<div className="flex items-center gap-2">
												{commissionType === "percentage" && (
													<Percent className="h-4 w-4 text-muted-foreground" />
												)}
												{commissionType === "fixed" && (
													<DollarSign className="h-4 w-4 text-muted-foreground" />
												)}
												<Input
													type="number"
													step={commissionType === "percentage" ? "0.1" : "1"}
													min="0"
													max={
														commissionType === "percentage" ? "100" : undefined
													}
													placeholder={
														commissionType === "percentage" ? "5.0" : "10000"
													}
													{...field}
													onChange={(e) => {
														const value = Number(e.target.value);
														field.onChange(value);
													}}
												/>
											</div>
										</FormControl>
										<FormDescription>
											{commissionType === "percentage"
												? "Enter the percentage rate (e.g., 5.0 for 5%)"
												: "Enter the fixed commission amount"}
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							{/* Calculated Commission Amount */}
							<FormField
								control={form.control}
								name="commissionAmount"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Calculated Commission Amount</FormLabel>
										<FormControl>
											<div className="flex items-center gap-2">
												<DollarSign className="h-4 w-4 text-muted-foreground" />
												<Input
													type="number"
													{...field}
													readOnly
													className="bg-muted"
												/>
											</div>
										</FormControl>
										<FormDescription>
											This amount is automatically calculated based on your
											commission type and value
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							{/* Enhanced Commission Summary */}
							{/* Issue #6 Fix: Improved commission breakdown with clear visual indicators */}
							{commissionValue > 0 && enhancedCommission && !isCalculating && (
								<Card className="border-green-200 bg-green-50">
									<CardHeader>
										<CardTitle className="flex items-center gap-2 text-green-800 text-lg">
											<Calculator className="h-5 w-5" />
											Commission Breakdown
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-4 text-green-800">
										{/* Issue #6 Fix: Prominent "Your Share" display at top */}
										<div className="bg-green-600 text-white p-4 rounded-lg text-center">
											<p className="text-sm opacity-90 mb-1">💰 Your Final Earnings</p>
											<p className="text-3xl font-bold">
												${enhancedCommission.agentEarnings.toLocaleString()}
											</p>
											<p className="text-xs opacity-75 mt-1">
												After all splits and deductions
											</p>
										</div>

										{/* Level 1: Property Commission */}
										<div className="space-y-2">
											<h4 className="font-semibold flex items-center gap-2">
												<span className="bg-green-200 text-green-800 rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
												Property Commission
											</h4>
											<div className="grid grid-cols-3 gap-4 text-center bg-white/50 p-3 rounded">
												<div>
													<p className="text-sm text-green-600">Property Price</p>
													<p className="font-bold">${propertyPrice.toLocaleString()}</p>
												</div>
												<div>
													<p className="text-sm text-green-600">Commission Rate</p>
													<p className="font-bold">
														{commissionType === "percentage"
															? `${commissionValue}%`
															: `$${commissionValue.toLocaleString()}`}
													</p>
												</div>
												<div>
													<p className="text-sm text-green-600">Total Commission</p>
													<p className="font-bold text-lg">
														${enhancedCommission.totalCommission.toLocaleString()}
													</p>
												</div>
											</div>
										</div>

										{/* Level 2: Representation Split - Issue #6 Fix: Visual flow indicator */}
										<div className="space-y-2">
											<h4 className="font-semibold flex items-center gap-2">
												<span className="bg-green-200 text-green-800 rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
												Commission Distribution
												{enhancedCommission.coBrokerShare && (
													<Badge variant="outline" className="ml-2 text-xs">Co-Broking</Badge>
												)}
											</h4>
											<div className="bg-white/50 p-3 rounded space-y-2">
												{/* Issue #6 Fix: Visual split indicator */}
												<div className="flex items-center gap-2 mb-3">
													<div className="flex-1 h-3 bg-green-400 rounded-l" style={{ width: enhancedCommission.coBrokerShare ? '50%' : '100%' }} />
													{enhancedCommission.coBrokerShare && (
														<div className="flex-1 h-3 bg-gray-300 rounded-r" style={{ width: '50%' }} />
													)}
												</div>
												<div className="flex justify-between">
													<span className="flex items-center gap-2">
														<span className="w-3 h-3 bg-green-400 rounded" />
														Your Commission Share:
													</span>
													<span className="font-semibold">
														${enhancedCommission.agentCommissionShare.toLocaleString()}
													</span>
												</div>
												{enhancedCommission.coBrokerShare && (
													<div className="flex justify-between text-sm">
														<span className="flex items-center gap-2">
															<span className="w-3 h-3 bg-gray-300 rounded" />
															Co-broker Share ({coBrokerSplit}%):
														</span>
														<span>${enhancedCommission.coBrokerShare.toLocaleString()}</span>
													</div>
												)}
											</div>
										</div>

										{/* Level 3: Company-Agent Split - Issue #6 Fix: Clear direction */}
										{agentTierInfo && (
											<div className="space-y-2">
												<h4 className="font-semibold flex items-center gap-2">
													<span className="bg-green-200 text-green-800 rounded-full w-6 h-6 flex items-center justify-center text-sm">3</span>
													Company-Agent Split ({agentTierInfo.displayName} Tier)
												</h4>
												<div className="bg-white/50 p-3 rounded space-y-2">
													{/* Issue #6 Fix: Visual split bar */}
													<div className="flex items-center gap-2 mb-3">
														<div className="h-3 bg-gray-300 rounded-l" style={{ width: `${100 - agentTierInfo.companyCommissionSplit}%` }} />
														<div className="h-3 bg-green-500 rounded-r" style={{ width: `${agentTierInfo.companyCommissionSplit}%` }} />
													</div>
													<div className="flex justify-between text-sm">
														<span className="flex items-center gap-2">
															<span className="w-3 h-3 bg-gray-300 rounded" />
															Company Share ({100 - agentTierInfo.companyCommissionSplit}%):
														</span>
														<span>${enhancedCommission.companyShare.toLocaleString()}</span>
													</div>
													<div className="flex justify-between text-sm">
														<span className="flex items-center gap-2">
															<span className="w-3 h-3 bg-green-500 rounded" />
															You Keep ({agentTierInfo.companyCommissionSplit}%):
														</span>
														<span className="font-semibold">${enhancedCommission.agentEarnings.toLocaleString()}</span>
													</div>
												</div>
											</div>
										)}

										{/* Level 4: Leadership Bonus (if applicable) */}
										{enhancedCommission.leadershipBonus && uplineInfo && (
											<div className="space-y-2">
												<h4 className="font-semibold flex items-center gap-2">
													<span className="bg-blue-200 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-sm">4</span>
													Leadership Bonus to Upline
												</h4>
												<div className="bg-blue-50 p-3 rounded space-y-2">
													<div className="flex justify-between text-sm">
														<span className="flex items-center gap-2">
															<span className="w-3 h-3 bg-blue-400 rounded" />
															Your Upline ({uplineInfo.uplineName}):
														</span>
														<span className="font-semibold text-blue-600">
															+${enhancedCommission.leadershipBonus.bonusAmount.toLocaleString()}
														</span>
													</div>
													<p className="text-xs text-blue-600">
														{enhancedCommission.leadershipBonus.bonusRate}% leadership bonus from company's share
													</p>
													<div className="flex justify-between text-sm border-t pt-2">
														<span>Company Net Share:</span>
														<span>${enhancedCommission.companyNetShare.toLocaleString()}</span>
													</div>
												</div>
											</div>
										)}
									</CardContent>
								</Card>
							)}

							{/* Representation Type Alerts */}
							{representationType === "co_broking" && commissionValue > 0 && (
								<Alert>
									<Info className="h-4 w-4" />
									<AlertDescription>
										<strong>Co-broking Transaction:</strong> You will split the commission with the co-broker ({coBrokerSplit}% to co-broker).
										Your share will be ${enhancedCommission?.agentCommissionShare.toLocaleString() || "0"}.
									</AlertDescription>
								</Alert>
							)}

							{representationType === "direct" && commissionValue > 0 && (
								<Alert className="border-green-200 bg-green-50">
									<Info className="h-4 w-4 text-green-600" />
									<AlertDescription>
										<strong>Direct Representation:</strong> You receive your full agent share of the commission.
									</AlertDescription>
								</Alert>
							)}

							{/* Loading State */}
							{isCalculating && (
								<Alert>
									<Calculator className="h-4 w-4" />
									<AlertDescription>
										Calculating enhanced commission breakdown...
									</AlertDescription>
								</Alert>
							)}

							{/* Validation Warning */}
							{propertyPrice === 0 && (
								<Card className="border-yellow-200 bg-yellow-50">
									<CardContent className="pt-6">
										<div className="text-center text-yellow-800">
											<Calculator className="mx-auto mb-2 h-12 w-12 opacity-50" />
											<p className="font-medium">Property price is required</p>
											<p className="text-sm">
												Please go back and enter the property price to calculate
												commission.
											</p>
										</div>
									</CardContent>
								</Card>
							)}

							{/* Navigation */}
							<div className="flex justify-between">
								<Button
									type="button"
									variant="outline"
									onClick={onPrevious}
									className="flex items-center gap-2"
								>
									<ArrowLeft className="h-4 w-4" />
									Back to Co-Broking
								</Button>
								<Button
									type="submit"
									className="flex items-center gap-2"
									disabled={!form.formState.isValid || propertyPrice === 0}
								>
									Continue to Documents
									<ArrowRight className="h-4 w-4" />
								</Button>
							</div>
						</form>
					</Form>
				</CardContent>
			</Card>
		</div>
	);
}
