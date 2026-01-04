"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ArrowRight } from "lucide-react";
import { useCallback, useEffect } from "react";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
// Issue #8 Fix: Import accessible date picker
import { AccessibleDatePicker } from "@/components/accessible-date-picker";
// Issue #9 Fix: Import required label components
import { RequiredLabel, RequiredFieldsNote } from "@/components/required-label";

import {
	type CompleteTransactionData,
	type InitiationData,
	initiationSchema,
	marketTypeOptions,
	transactionTypeOptions,
} from "../transaction-schema";

interface StepInitiationProps {
	data: Partial<CompleteTransactionData>;
	onUpdate: (data: InitiationData) => void;
	onNext: () => void;
}

export function StepInitiation({
	data,
	onUpdate,
	onNext,
}: StepInitiationProps) {
	const form = useForm<InitiationData>({
		resolver: zodResolver(initiationSchema),
		defaultValues: {
			marketType: data.marketType,
			transactionType: data.transactionType,
			transactionDate: data.transactionDate,
		},
	});

	// Auto-save on form changes (moved before useEffect to fix ReferenceError)
	const handleFormChange = useCallback(() => {
		const values = form.getValues();
		if (form.formState.isValid) {
			onUpdate(values);
		}
	}, [form, onUpdate]);

	const handleSubmit = useCallback((formData: InitiationData) => {
		onUpdate(formData);
		onNext();
	}, [onUpdate, onNext]);

	// Auto-selection: Primary Market → Sale
	useEffect(() => {
		const subscription = form.watch((value, { name }) => {
			if (name === "marketType" && value.marketType === "primary") {
				// Auto-select "sale" when primary market is chosen
				form.setValue("transactionType", "sale", {
					shouldValidate: true,
					shouldDirty: true,
					shouldTouch: true,
				});

				// Trigger form change to update parent state
				handleFormChange();
			}
		});

		return () => subscription.unsubscribe();
	}, [form, handleFormChange]);

	// Watch form values for summary display and auto-selection logic
	const watchedValues = form.watch();
	const isAutoSelected = watchedValues.marketType === "primary" && watchedValues.transactionType === "sale";

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Transaction Initiation</CardTitle>
					<CardDescription>
						Start by providing the basic details of your transaction
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(handleSubmit)}
							className="space-y-6"
						>
							{/* Issue #9 Fix: Required fields note */}
							<RequiredFieldsNote />

							<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
								{/* Market Type */}
								<FormField
									control={form.control}
									name="marketType"
									render={({ field }) => (
										<FormItem>
											<FormLabel><RequiredLabel>Market Type</RequiredLabel></FormLabel>
											<Select
												onValueChange={(value) => {
													field.onChange(value);
													handleFormChange();
												}}
												defaultValue={field.value}
											>
												<FormControl>
													<SelectTrigger>
														<SelectValue placeholder="Select market type" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													{marketTypeOptions.map((option) => (
														<SelectItem key={option.value} value={option.value}>
															{option.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<FormDescription>
												Choose whether this is a primary or secondary market
												transaction
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								{/* Transaction Type */}
								<FormField
									control={form.control}
									name="transactionType"
									render={({ field }) => (
										<FormItem>
											<FormLabel>
												<RequiredLabel>Transaction Type</RequiredLabel>
												{isAutoSelected && (
													<span className="ml-2 text-xs text-blue-600 font-medium">
														(Auto-selected for Primary Market)
													</span>
												)}
											</FormLabel>
											<Select
												onValueChange={(value) => {
													field.onChange(value);
													handleFormChange();
												}}
												defaultValue={field.value}
												disabled={watchedValues.marketType === "primary"}
											>
												<FormControl>
													<SelectTrigger className={cn(
														watchedValues.marketType === "primary" &&
														"bg-blue-50 border-blue-200"
													)}>
														<SelectValue placeholder="Select transaction type" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													{transactionTypeOptions.map((option) => (
														<SelectItem key={option.value} value={option.value}>
															{option.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<FormDescription>
												{watchedValues.marketType === "primary"
													? "Primary market transactions must be sales"
													: "Specify the type of transaction you're processing"
												}
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							{/* Issue #8 Fix: Accessible Transaction Date with manual input */}
							<FormField
								control={form.control}
								name="transactionDate"
								render={({ field }) => (
									<FormItem className="flex flex-col">
										<FormLabel id="transaction-date-label">
											<RequiredLabel>Transaction Date</RequiredLabel>
										</FormLabel>
										<FormControl>
											<AccessibleDatePicker
												value={field.value}
												onChange={(date) => {
													field.onChange(date);
													handleFormChange();
												}}
												disabled={(date) =>
													date > new Date() || date < new Date("1900-01-01")
												}
												placeholder="MM/DD/YYYY"
												aria-label="Transaction date"
												aria-describedby="transaction-date-description"
											/>
										</FormControl>
										<FormDescription id="transaction-date-description">
											Enter the date manually (MM/DD/YYYY) or use the calendar button.
											Date must be today or earlier.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							{/* Summary Card */}
							{(watchedValues.marketType ||
								watchedValues.transactionType ||
								watchedValues.transactionDate) && (
								<Card className="bg-muted/50">
									<CardHeader>
										<CardTitle className="text-lg">
											Transaction Summary
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-2">
										{watchedValues.marketType && (
											<div className="flex justify-between">
												<span className="text-muted-foreground">Market:</span>
												<span className="font-medium">
													{
														marketTypeOptions.find(
															(opt) => opt.value === watchedValues.marketType,
														)?.label
													}
												</span>
											</div>
										)}
										{watchedValues.transactionType && (
											<div className="flex justify-between">
												<span className="text-muted-foreground">Type:</span>
												<span className="font-medium">
													{
														transactionTypeOptions.find(
															(opt) =>
																opt.value === watchedValues.transactionType,
														)?.label
													}
												</span>
											</div>
										)}
										{watchedValues.transactionDate && (
											<div className="flex justify-between">
												<span className="text-muted-foreground">Date:</span>
												<span className="font-medium">
													{format(watchedValues.transactionDate, "PPP")}
												</span>
											</div>
										)}
									</CardContent>
								</Card>
							)}

							{/* Navigation */}
							<div className="flex justify-end">
								<Button
									type="submit"
									className="flex items-center gap-2"
									disabled={!form.formState.isValid}
								>
									Continue to Property Details
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
