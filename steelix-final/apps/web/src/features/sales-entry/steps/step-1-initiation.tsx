"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ArrowRight, CalendarIcon } from "lucide-react";
import { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
							<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
								{/* Market Type */}
								<FormField
									control={form.control}
									name="marketType"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Market Type</FormLabel>
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
												Transaction Type
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

							{/* Transaction Date */}
							<FormField
								control={form.control}
								name="transactionDate"
								render={({ field }) => (
									<FormItem className="flex flex-col">
										<FormLabel>Transaction Date</FormLabel>
										<Popover>
											<PopoverTrigger asChild>
												<FormControl>
													<Button
														variant="outline"
														className={cn(
															"w-full pl-3 text-left font-normal",
															!field.value && "text-muted-foreground",
														)}
													>
														{field.value ? (
															format(field.value, "PPP")
														) : (
															<span>Pick a date</span>
														)}
														<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
													</Button>
												</FormControl>
											</PopoverTrigger>
											<PopoverContent className="w-auto p-0" align="start">
												<Calendar
													mode="single"
													selected={field.value}
													onSelect={(date) => {
														field.onChange(date);
														handleFormChange();
													}}
													disabled={(date) =>
														date > new Date() || date < new Date("1900-01-01")
													}
													initialFocus
												/>
											</PopoverContent>
										</Popover>
										<FormDescription>
											Select the date when the transaction occurred or will
											occur
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
