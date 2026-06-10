"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, MapPin } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/utils/trpc";

// Issue #10 Fix: Import currency input component
import { CurrencyInput } from "@/components/currency-input";
// Issue #9 Fix: Import required label components
import { RequiredFieldsNote, RequiredLabel } from "@/components/required-label";
import {
	type PropertyData,
	propertySchema,
	propertyTypeOptions,
} from "../transaction-schema";

const NO_PROJECT = "__none__";

/** Map internal listing `property_type` enum to sales form dropdown values */
function mapListingPropertyTypeToForm(
	listingPropertyType: string,
): string {
	const map: Record<string, string> = {
		landed: "house",
		condo: "condo",
		apartment: "apartment",
		commercial: "commercial",
		industrial: "commercial",
		other: "other",
	};
	return map[listingPropertyType] ?? "other";
}

import type { StepNavigationOptions } from "./step-nav";

interface StepPropertyProps extends StepNavigationOptions {
	data?: PropertyData;
	/** Prefer listings that match the transaction (sale vs rent) */
	listingTypeFilter?: "sale" | "rent" | "all";
	onUpdate: (data: PropertyData) => void;
	onNext: () => void;
	onPrevious: () => void;
}

export function StepProperty({
	data,
	listingTypeFilter = "all",
	onUpdate,
	onNext,
	onPrevious,
	hideNavigation = false,
	hidePrevious = false,
	nextLabel = "Continue to Client Details",
	previousLabel = "Back to Initiation",
	beforeNext,
}: StepPropertyProps) {
	const form = useForm<PropertyData>({
		resolver: zodResolver(propertySchema),
		defaultValues: {
			listingId: data?.listingId || undefined,
			listingTitle: data?.listingTitle || "",
			listingReferralShareType: data?.listingReferralShareType,
			listingReferralShareValue: data?.listingReferralShareValue,
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
		if (beforeNext && !beforeNext()) return;
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
	const listingId = form.watch("listingId");
	const { data: listingData } = trpc.listings.list.useQuery({
		status: "active",
		listingType: listingTypeFilter,
		page: 1,
		limit: 100,
	});

	// If a block/listing exists but doesn't show up here, the common causes are:
	// - Listing is not "active"
	// - Listing type doesn't match the transaction type (sale vs rent)

	const { data: selectedListingDetails } = trpc.listings.getById.useQuery(
		{ id: listingId! },
		{ enabled: Boolean(listingId) },
	);

	// When full listing + referral rule loads, snapshot preset commission fields for step 5
	useEffect(() => {
		if (!selectedListingDetails) return;
		const rule = selectedListingDetails.referralRule;
		if (rule) {
			form.setValue("listingReferralShareType", rule.shareType);
			form.setValue("listingReferralShareValue", Number(rule.shareValue));
		} else {
			form.setValue("listingReferralShareType", undefined);
			form.setValue("listingReferralShareValue", undefined);
		}
		queueMicrotask(() => onUpdate(form.getValues()));
		// eslint-disable-next-line react-hooks/exhaustive-deps -- sync snapshot when listing details load
	}, [selectedListingDetails]);

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Property Information</CardTitle>
					<CardDescription>
						Select an internal project listing to load property details and optional
						admin commission defaults, or enter a property address manually.
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

							{/* Project selection (internal marketplace) — optional; use address below if none */}
							<FormField
								control={form.control}
								name="listingId"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Project / listing</FormLabel>
										<FormControl>
											<Select
												value={field.value ?? NO_PROJECT}
												onValueChange={(value) => {
													if (value === NO_PROJECT) {
														field.onChange(undefined);
														form.setValue("listingTitle", "");
														form.setValue("listingReferralShareType", undefined);
														form.setValue("listingReferralShareValue", undefined);
														handleFormChange();
														return;
													}
													field.onChange(value);
													const selected = listingData?.listings.find(
														(x) => x.id === value,
													);
													if (selected) {
														form.setValue("listingTitle", selected.title);
														form.setValue(
															"address",
															selected.addressLine1 || selected.title,
														);
														form.setValue(
															"propertyType",
															mapListingPropertyTypeToForm(selected.propertyType),
														);
														form.setValue("price", Number(selected.price));
														if (selected.bedrooms !== null)
															form.setValue("bedrooms", selected.bedrooms || undefined);
														if (selected.bathrooms !== null)
															form.setValue("bathrooms", selected.bathrooms || undefined);
														if (selected.builtUpSqft !== null)
															form.setValue("area", selected.builtUpSqft || undefined);
													}
													handleFormChange();
												}}
											>
												<SelectTrigger>
													<SelectValue placeholder="Select project (optional)" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value={NO_PROJECT}>
														None — enter property manually
													</SelectItem>
													{(listingData?.listings || []).map((listing) => (
														<SelectItem key={listing.id} value={listing.id}>
															{listing.title}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</FormControl>
										<FormDescription>
											Choose an admin listing to load property details and optional
											commission preset. Or select “None” and fill the address
											yourself.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="address"
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											<RequiredLabel>Property address</RequiredLabel>
										</FormLabel>
										<FormControl>
											<Input
												placeholder="Full address or location"
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

							<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
								{/* Property Type */}
								<FormField
									control={form.control}
									name="propertyType"
									render={({ field }) => (
										<FormItem>
											<FormLabel>
												<RequiredLabel>Property Type</RequiredLabel>
											</FormLabel>
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
											<FormLabel>
												<RequiredLabel>Property Price</RequiredLabel>
											</FormLabel>
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

							{!hideNavigation && (
								<div
									className={`flex ${hidePrevious ? "justify-end" : "justify-between"}`}
								>
									{!hidePrevious && (
										<Button
											type="button"
											variant="outline"
											onClick={onPrevious}
											className="flex items-center gap-2"
										>
											<ArrowLeft className="h-4 w-4" />
											{previousLabel}
										</Button>
									)}
									<Button
										type="submit"
										className="flex items-center gap-2"
										disabled={!form.formState.isValid}
									>
										{nextLabel}
										<ArrowRight className="h-4 w-4" />
									</Button>
								</div>
							)}
						</form>
					</Form>
				</CardContent>
			</Card>
		</div>
	);
}
