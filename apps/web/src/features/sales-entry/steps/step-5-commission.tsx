"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
	ArrowLeft,
	ArrowRight,
	Calculator,
	DollarSign,
	Percent,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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

import {
	type CommissionData,
	calculateCommission,
	commissionSchema,
	commissionTypeOptions,
} from "../transaction-schema";

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
	// Local state for commission type to avoid form conflicts
	const [localCommissionType, setLocalCommissionType] = useState<
		"percentage" | "fixed"
	>(data?.commissionType || "percentage");

	const form = useForm<CommissionData>({
		resolver: zodResolver(commissionSchema),
		defaultValues: {
			commissionType: data?.commissionType || "percentage",
			commissionValue: data?.commissionValue || 0,
			commissionAmount: data?.commissionAmount || 0,
		},
	});

	const handleSubmit = useCallback(
		(formData: CommissionData) => {
			onUpdate(formData);
			onNext();
		},
		[onUpdate, onNext],
	);

	const watchedValues = form.watch();
	const { commissionType, commissionValue } = watchedValues;

	// Auto-calculate commission amount when type or value changes
	useEffect(() => {
		if (commissionType && commissionValue !== undefined && propertyPrice > 0) {
			const calculatedAmount = calculateCommission(
				propertyPrice,
				commissionType,
				commissionValue,
			);

			// Only update if the value actually changed
			const currentAmount = form.getValues("commissionAmount");
			if (Math.abs(currentAmount - calculatedAmount) > 0.01) {
				form.setValue("commissionAmount", calculatedAmount, {
					shouldValidate: false,
					shouldDirty: false,
					shouldTouch: false,
				});

				// Auto-save after calculation
				setTimeout(() => {
					const values = form.getValues();
					onUpdate(values);
				}, 0);
			}
		}
	}, [commissionType, commissionValue, propertyPrice, form, onUpdate]);

	return (
		<div className="space-y-6">
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

							{/* Commission Summary */}
							{commissionValue > 0 && watchedValues.commissionAmount > 0 && (
								<Card className="border-green-200 bg-green-50">
									<CardHeader>
										<CardTitle className="flex items-center gap-2 text-green-800 text-lg">
											<Calculator className="h-5 w-5" />
											Commission Summary
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-3 text-green-800">
										<div className="flex justify-between">
											<span>Property Price:</span>
											<span className="font-medium">
												${propertyPrice.toLocaleString()}
											</span>
										</div>
										<div className="flex justify-between">
											<span>Commission Rate:</span>
											<span className="font-medium">
												{commissionType === "percentage"
													? `${commissionValue}%`
													: `$${commissionValue.toLocaleString()}`}
											</span>
										</div>
										<Separator className="bg-green-200" />
										<div className="flex justify-between font-bold text-lg">
											<span>Total Commission:</span>
											<span>
												${watchedValues.commissionAmount.toLocaleString()}
											</span>
										</div>
										{commissionType === "percentage" && (
											<div className="text-green-600 text-sm">
												Calculation: ${propertyPrice.toLocaleString()} ×{" "}
												{commissionValue}% = $
												{watchedValues.commissionAmount.toLocaleString()}
											</div>
										)}
									</CardContent>
								</Card>
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
