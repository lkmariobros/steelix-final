"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, MapPin, Search } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

import {
	type PropertyData,
	propertySchema,
	propertyTypeOptions,
} from "../transaction-schema";
// Issue #9 Fix: Import required label components
import { RequiredLabel, RequiredFieldsNote } from "@/components/required-label";
// Issue #10 Fix: Import currency input component
import { CurrencyInput } from "@/components/currency-input";

interface StepPropertyProps {
	data?: PropertyData;
	onUpdate: (data: PropertyData) => void;
	onNext: () => void;
	onPrevious: () => void;
}

export function StepProperty({
	data,
	onUpdate,
	onNext,
	onPrevious,
}: StepPropertyProps) {
	const form = useForm<PropertyData>({
		resolver: zodResolver(propertySchema),
		defaultValues: {
			address: data?.address || "",
			propertyType: data?.propertyType || "",
			bedrooms: data?.bedrooms || undefined,
			bathrooms: data?.bathrooms || undefined,
			area: data?.area || undefined,
			price: data?.price || 0,
			description: data?.description || "",
		},
	});

	const handleSubmit = (formData: PropertyData) => {
		onUpdate(formData);
		onNext();
	};

	// Auto-save on form changes
	const handleFormChange = () => {
		const values = form.getValues();
		if (form.formState.isValid) {
			onUpdate(values);
		}
	};

	const watchedValues = form.watch();

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Property Information</CardTitle>
					<CardDescription>
						Enter the details of the property involved in this transaction
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

							{/* Property Search/Address */}
							<FormField
								control={form.control}
								name="address"
								render={({ field }) => (
									<FormItem>
										<FormLabel><RequiredLabel>Property Address</RequiredLabel></FormLabel>
										<div className="flex gap-2">
											<FormControl>
												<Input
													placeholder="Enter property address"
													{...field}
													onChange={(e) => {
														field.onChange(e);
														handleFormChange();
													}}
													className="flex-1"
												/>
											</FormControl>
											<Button type="button" variant="outline" size="icon">
												<Search className="h-4 w-4" />
											</Button>
										</div>
										<FormDescription>
											Enter the full address or search for the property
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
								{/* Property Type */}
								<FormField
									control={form.control}
									name="propertyType"
									render={({ field }) => (
										<FormItem>
											<FormLabel><RequiredLabel>Property Type</RequiredLabel></FormLabel>
											<Select
												onValueChange={(value) => {
													field.onChange(value);
													handleFormChange();
												}}
												defaultValue={field.value}
											>
												<FormControl>
													<SelectTrigger>
														<SelectValue placeholder="Select property type" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													{propertyTypeOptions.map((option) => (
														<SelectItem key={option.value} value={option.value}>
															{option.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>

								{/* Issue #10 Fix: Property Price with currency formatting */}
								<FormField
									control={form.control}
									name="price"
									render={({ field }) => (
										<FormItem>
											<FormLabel><RequiredLabel>Property Price</RequiredLabel></FormLabel>
											<FormControl>
												<CurrencyInput
													value={field.value}
													onChange={(value) => {
														field.onChange(value);
														handleFormChange();
													}}
													placeholder="Enter price"
													aria-label="Property price"
												/>
											</FormControl>
											<FormDescription>
												Enter the transaction price (e.g., 500000 for $500,000)
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							<Separator />

							{/* Property Specifications */}
							<div className="space-y-4">
								<h3 className="font-medium text-lg">Property Specifications</h3>
								<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
									{/* Bedrooms */}
									<FormField
										control={form.control}
										name="bedrooms"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Bedrooms</FormLabel>
												<FormControl>
													<Input
														type="number"
														placeholder="0"
														{...field}
														onChange={(e) => {
															field.onChange(
																e.target.value
																	? Number(e.target.value)
																	: undefined,
															);
															handleFormChange();
														}}
														value={field.value || ""}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									{/* Bathrooms */}
									<FormField
										control={form.control}
										name="bathrooms"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Bathrooms</FormLabel>
												<FormControl>
													<Input
														type="number"
														placeholder="0"
														{...field}
														onChange={(e) => {
															field.onChange(
																e.target.value
																	? Number(e.target.value)
																	: undefined,
															);
															handleFormChange();
														}}
														value={field.value || ""}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									{/* Area */}
									<FormField
										control={form.control}
										name="area"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Area (sq ft)</FormLabel>
												<FormControl>
													<Input
														type="number"
														placeholder="0"
														{...field}
														onChange={(e) => {
															field.onChange(
																e.target.value
																	? Number(e.target.value)
																	: undefined,
															);
															handleFormChange();
														}}
														value={field.value || ""}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>
							</div>

							{/* Description */}
							<FormField
								control={form.control}
								name="description"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Property Description</FormLabel>
										<FormControl>
											<Textarea
												placeholder="Enter additional property details..."
												className="min-h-[100px]"
												{...field}
												onChange={(e) => {
													field.onChange(e);
													handleFormChange();
												}}
											/>
										</FormControl>
										<FormDescription>
											Optional: Add any additional details about the property
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							{/* Property Summary */}
							{watchedValues.address && watchedValues.propertyType && (
								<Card className="bg-muted/50">
									<CardHeader>
										<CardTitle className="flex items-center gap-2 text-lg">
											<MapPin className="h-5 w-5" />
											Property Summary
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-2">
										<div className="flex justify-between">
											<span className="text-muted-foreground">Address:</span>
											<span className="text-right font-medium">
												{watchedValues.address}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-muted-foreground">Type:</span>
											<span className="font-medium">
												{
													propertyTypeOptions.find(
														(opt) => opt.value === watchedValues.propertyType,
													)?.label
												}
											</span>
										</div>
										{watchedValues.price > 0 && (
											<div className="flex justify-between">
												<span className="text-muted-foreground">Price:</span>
												<span className="font-medium">
													${watchedValues.price.toLocaleString()}
												</span>
											</div>
										)}
										{(watchedValues.bedrooms ||
											watchedValues.bathrooms ||
											watchedValues.area) && (
											<div className="flex justify-between">
												<span className="text-muted-foreground">Specs:</span>
												<span className="font-medium">
													{[
														watchedValues.bedrooms &&
															`${watchedValues.bedrooms} bed`,
														watchedValues.bathrooms &&
															`${watchedValues.bathrooms} bath`,
														watchedValues.area && `${watchedValues.area} sq ft`,
													]
														.filter(Boolean)
														.join(", ")}
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
									Back to Initiation
								</Button>
								<Button
									type="submit"
									className="flex items-center gap-2"
									disabled={!form.formState.isValid}
								>
									Continue to Client Details
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
