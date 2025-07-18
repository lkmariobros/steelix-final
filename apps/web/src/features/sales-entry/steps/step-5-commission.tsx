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

interface StepCommissionProps {
	data?: CommissionData;
	propertyPrice: number;
	onUpdate: (data: CommissionData) => void;
	onNext: () => void;
	onPrevious: () => void;
}

export function StepCommission({
	data,
	propertyPrice,
	onUpdate,
	onNext,
	onPrevious,
}: StepCommissionProps) {
	// Local state for commission type and representation type
	const [localCommissionType, setLocalCommissionType] = useState<
		"percentage" | "fixed"
	>(data?.commissionType || "percentage");

	const [representationType, setRepresentationType] = useState<
		"single_side" | "dual_agency"
	>(data?.representationType || "single_side");

	const form = useForm<CommissionData>({
		resolver: zodResolver(commissionSchema),
		defaultValues: {
			commissionType: data?.commissionType || "percentage",
			commissionValue: data?.commissionValue || 0,
			commissionAmount: data?.commissionAmount || 0,
			representationType: data?.representationType || "single_side",
			agentTier: data?.agentTier,
			companyCommissionSplit: data?.companyCommissionSplit,
			breakdown: data?.breakdown,
		},
	});

	// Mock enhanced commission calculation for now (will be replaced with real tRPC call)
	const watchedCommissionValue = form.watch("commissionValue") || 0;
	const enhancedCommission = React.useMemo(() => {
		if (propertyPrice > 0 && watchedCommissionValue > 0) {
			return calculateEnhancedCommission(
				propertyPrice,
				localCommissionType,
				watchedCommissionValue,
				representationType,
				"advisor",
				60
			);
		}
		return null;
	}, [propertyPrice, localCommissionType, watchedCommissionValue, representationType]);

	const isCalculating = false;

	// Mock agent tier info for now (will be replaced with real data from session)
	const agentTierInfo = {
		agentTier: "advisor" as const,
		companyCommissionSplit: 60,
		displayName: "Advisor",
		description: "Entry level agent",
	};

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

							{/* Representation Type */}
							<div className="space-y-3">
								<Label className="text-base">Representation Type</Label>
								<RadioGroup
									value={representationType}
									onValueChange={(value: "single_side" | "dual_agency") => {
										setRepresentationType(value);
									}}
									className="flex flex-col space-y-3"
								>
									{representationTypeOptions.map((option) => (
										<div
											key={option.value}
											className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50"
										>
											<RadioGroupItem value={option.value} id={option.value} className="mt-1" />
											<div className="flex-1">
												<Label
													htmlFor={option.value}
													className="flex cursor-pointer items-center gap-2 font-medium"
												>
													{option.value === "dual_agency" ? (
														<Users className="h-4 w-4" />
													) : (
														<Users className="h-4 w-4" />
													)}
													{option.label}
												</Label>
												<p className="text-sm text-gray-600 mt-1">
													{option.description}
												</p>
											</div>
										</div>
									))}
								</RadioGroup>
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
							{commissionValue > 0 && enhancedCommission && !isCalculating && (
								<Card className="border-green-200 bg-green-50">
									<CardHeader>
										<CardTitle className="flex items-center gap-2 text-green-800 text-lg">
											<Calculator className="h-5 w-5" />
											Enhanced Commission Breakdown
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-4 text-green-800">
										{/* Level 1: Property Commission */}
										<div className="space-y-2">
											<h4 className="font-semibold">Property Commission</h4>
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

										{/* Level 2: Representation Split */}
										<div className="space-y-2">
											<h4 className="font-semibold">Commission Distribution</h4>
											<div className="bg-white/50 p-3 rounded space-y-2">
												<div className="flex justify-between">
													<span>Your Commission Share:</span>
													<span className="font-semibold">
														${enhancedCommission.agentCommissionShare.toLocaleString()}
													</span>
												</div>
												{enhancedCommission.coBrokerShare && (
													<div className="flex justify-between text-sm">
														<span>Co-broker Share (50%):</span>
														<span>${enhancedCommission.coBrokerShare.toLocaleString()}</span>
													</div>
												)}
											</div>
										</div>

										{/* Level 3: Company-Agent Split */}
										{agentTierInfo && (
											<div className="space-y-2">
												<h4 className="font-semibold">Your Earnings ({agentTierInfo.displayName})</h4>
												<div className="bg-white/50 p-3 rounded space-y-2">
													<div className="flex justify-between text-sm">
														<span>Company Share ({100 - agentTierInfo.companyCommissionSplit}%):</span>
														<span>${enhancedCommission.companyShare.toLocaleString()}</span>
													</div>
													<div className="flex justify-between text-sm">
														<span>Your Share ({agentTierInfo.companyCommissionSplit}%):</span>
														<span>${enhancedCommission.agentEarnings.toLocaleString()}</span>
													</div>
													<Separator className="bg-green-200" />
													<div className="flex justify-between font-bold text-lg">
														<span>Final Earnings:</span>
														<span className="text-green-700">
															${enhancedCommission.agentEarnings.toLocaleString()}
														</span>
													</div>
												</div>
											</div>
										)}
									</CardContent>
								</Card>
							)}

							{/* Representation Type Alerts */}
							{representationType === "single_side" && commissionValue > 0 && (
								<Alert>
									<Info className="h-4 w-4" />
									<AlertDescription>
										<strong>Co-broking Transaction:</strong> You will split the commission 50/50 with the co-broker.
										Your share will be ${enhancedCommission?.agentCommissionShare.toLocaleString() || "0"}.
									</AlertDescription>
								</Alert>
							)}

							{representationType === "dual_agency" && commissionValue > 0 && (
								<Alert className="border-orange-200 bg-orange-50">
									<AlertTriangle className="h-4 w-4" />
									<AlertDescription>
										<strong>Dual Agency:</strong> You represent both buyer and seller and receive the full commission.
										Legal disclosure may be required in your jurisdiction.
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
