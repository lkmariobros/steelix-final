"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Mail, Phone, User } from "lucide-react";
import { useEffect } from "react";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import {
	type ClientData,
	clientSchema,
	clientSourceOptions,
	clientTypeOptions,
} from "../transaction-schema";
// Issue #9 Fix: Import required label components
import { RequiredLabel, RequiredFieldsNote } from "@/components/required-label";

interface StepClientProps {
	data?: ClientData;
	marketType?: "primary" | "secondary";
	transactionType?: "sale" | "lease";
	onUpdate: (data: ClientData) => void;
	onNext: () => void;
	onPrevious: () => void;
}

export function StepClient({
	data,
	marketType,
	transactionType,
	onUpdate,
	onNext,
	onPrevious,
}: StepClientProps) {
	const form = useForm<ClientData>({
		resolver: zodResolver(clientSchema),
		defaultValues: {
			name: data?.name || "",
			email: data?.email || "",
			phone: data?.phone || "",
			type: data?.type || undefined,
			source: data?.source || "",
			notes: data?.notes || "",
		},
	});

	// Auto-save on form changes (moved before useEffect to fix ReferenceError)
	const handleFormChange = () => {
		const values = form.getValues();
		if (form.formState.isValid) {
			onUpdate(values);
		}
	};

	const handleSubmit = (formData: ClientData) => {
		onUpdate(formData);
		onNext();
	};

	// Auto-classification logic based on market type and transaction type
	useEffect(() => {
		if (marketType && transactionType) {
			let suggestedType: "buyer" | "seller" | "tenant" | "landlord" | undefined;

			if (transactionType === "sale") {
				// For sales, suggest buyer (most common scenario)
				suggestedType = "buyer";
			} else if (transactionType === "lease") {
				// For leases, suggest tenant (most common scenario)
				suggestedType = "tenant";
			}

			if (suggestedType) {
				// Only auto-suggest if no type is currently selected or if it's different from suggestion
				const currentType = form.getValues("type");

				if (!currentType || currentType !== suggestedType) {
					// Auto-suggest but don't force - user can still override
					form.setValue("type", suggestedType, {
						shouldValidate: true,
						shouldDirty: true,
						shouldTouch: true,
					});

					// Trigger form change to update parent state
					handleFormChange();
				}
			}
		}
	}, [marketType, transactionType, form, handleFormChange]);

	const watchedValues = form.watch();

	// Check if current client type matches auto-classification suggestion
	const getAutoSuggestedType = () => {
		if (!marketType || !transactionType) return null;
		if (transactionType === "sale") return "buyer";
		if (transactionType === "lease") return "tenant";
		return null;
	};

	const isAutoSuggested = watchedValues.type === getAutoSuggestedType();

	// Filter client type options based on transaction type
	const getFilteredClientTypes = () => {
		if (transactionType === "sale") {
			return clientTypeOptions.filter(opt => opt.value === "buyer" || opt.value === "seller");
		}
		if (transactionType === "lease") {
			return clientTypeOptions.filter(opt => opt.value === "tenant" || opt.value === "landlord");
		}
		return clientTypeOptions;
	};

	const filteredClientTypes = getFilteredClientTypes();

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Client Information</CardTitle>
					<CardDescription>
						Enter the details of the client involved in this transaction
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

							{/* Basic Client Information */}
							<div className="space-y-4">
								<h3 className="font-medium text-lg">Contact Details</h3>

								{/* Client Name */}
								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel><RequiredLabel>Full Name</RequiredLabel></FormLabel>
											<FormControl>
												<Input
													placeholder="Enter client&apos;s full name"
													{...field}
													onChange={(e) => {
														field.onChange(e);
														handleFormChange();
													}}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
									{/* Email */}
									<FormField
										control={form.control}
										name="email"
										render={({ field }) => (
											<FormItem>
												<FormLabel><RequiredLabel>Email Address</RequiredLabel></FormLabel>
												<FormControl>
													<Input
														type="email"
														placeholder="client@example.com"
														{...field}
														onChange={(e) => {
															field.onChange(e);
															handleFormChange();
														}}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									{/* Phone */}
									<FormField
										control={form.control}
										name="phone"
										render={({ field }) => (
											<FormItem>
												<FormLabel><RequiredLabel>Phone Number</RequiredLabel></FormLabel>
												<FormControl>
													<Input
														type="tel"
														placeholder="+1 (555) 123-4567"
														{...field}
														onChange={(e) => {
															field.onChange(e);
															handleFormChange();
														}}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>
							</div>

							{/* Client Classification */}
							<div className="space-y-4">
								<h3 className="font-medium text-lg">Client Classification</h3>

								<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
									{/* Client Type */}
									<FormField
										control={form.control}
										name="type"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Client Type</FormLabel>
												<Select
													onValueChange={(value) => {
														field.onChange(value);
														handleFormChange();
													}}
													defaultValue={field.value}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select client type" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														{filteredClientTypes.map((option) => (
															<SelectItem
																key={option.value}
																value={option.value}
															>
																{option.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<FormDescription>
													{isAutoSuggested && marketType && transactionType ? (
														<span className="text-blue-600 font-medium">
															✨ Auto-suggested based on {transactionType} transaction
														</span>
													) : (
														"Specify the client's role in this transaction"
													)}
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>

									{/* Client Source */}
									<FormField
										control={form.control}
										name="source"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Client Source</FormLabel>
												<Select
													onValueChange={(value) => {
														field.onChange(value);
														handleFormChange();
													}}
													defaultValue={field.value}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="How did you find this client?" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														{clientSourceOptions.map((option) => (
															<SelectItem
																key={option.value}
																value={option.value}
															>
																{option.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<FormDescription>
													How did you acquire this client?
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>
							</div>

							{/* Additional Notes */}
							<FormField
								control={form.control}
								name="notes"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Additional Notes</FormLabel>
										<FormControl>
											<Textarea
												placeholder="Enter any additional notes about the client..."
												className="min-h-[100px]"
												{...field}
												onChange={(e) => {
													field.onChange(e);
													handleFormChange();
												}}
											/>
										</FormControl>
										<FormDescription>
											Optional: Add any relevant information about the client
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							{/* Client Summary */}
							{watchedValues.name && watchedValues.email && (
								<Card className="bg-muted/50">
									<CardHeader>
										<CardTitle className="flex items-center gap-2 text-lg">
											<User className="h-5 w-5" />
											Client Summary
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-3">
										<div className="flex items-center gap-3">
											<User className="h-4 w-4 text-muted-foreground" />
											<div>
												<div className="font-medium">{watchedValues.name}</div>
												{watchedValues.type && (
													<div className="text-muted-foreground text-sm">
														{
															clientTypeOptions.find(
																(opt) => opt.value === watchedValues.type,
															)?.label
														}
													</div>
												)}
											</div>
										</div>

										<div className="flex items-center gap-3">
											<Mail className="h-4 w-4 text-muted-foreground" />
											<span className="text-sm">{watchedValues.email}</span>
										</div>

										{watchedValues.phone && (
											<div className="flex items-center gap-3">
												<Phone className="h-4 w-4 text-muted-foreground" />
												<span className="text-sm">{watchedValues.phone}</span>
											</div>
										)}

										{watchedValues.source && (
											<div className="flex justify-between">
												<span className="text-muted-foreground text-sm">
													Source:
												</span>
												<span className="font-medium text-sm">
													{
														clientSourceOptions.find(
															(opt) => opt.value === watchedValues.source,
														)?.label
													}
												</span>
											</div>
										)}
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
									Back to Property
								</Button>
								<Button
									type="submit"
									className="flex items-center gap-2"
									disabled={!form.formState.isValid}
								>
									Continue to Co-Broking
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
