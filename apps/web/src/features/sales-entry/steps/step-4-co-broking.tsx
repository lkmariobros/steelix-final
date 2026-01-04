"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ArrowLeft, ArrowRight, Building, Mail, Percent, Phone, User, Users } from "lucide-react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";

import {
	type CoBrokingData,
	type RepresentationType,
	createCoBrokingSchema,
	representationTypeOptions
} from "../transaction-schema";

// Props for representation step - now includes market type for context-aware display
interface StepCoBrokingProps {
	data?: CoBrokingData;
	marketType?: "primary" | "secondary";
	onUpdate: (data: CoBrokingData) => void;
	onNext: () => void;
	onPrevious: () => void;
}

// Simplified representation type component - 2 options only
export function StepCoBroking({
	data,
	marketType,
	onUpdate,
	onNext,
	onPrevious,
}: StepCoBrokingProps) {
	const form = useForm<CoBrokingData>({
		resolver: zodResolver(createCoBrokingSchema()),
		mode: "onChange",
		defaultValues: {
			representationType: data?.representationType || "direct",
			isCoBroking: data?.representationType === "co_broking",
			coBrokingData: data?.coBrokingData || {
				agentName: "",
				agencyName: "",
				commissionSplit: 50,
				agentEmail: "",
				agentPhone: "",
				contactInfo: "", // Legacy field
			},
		},
	});

	const handleSubmit = (formData: CoBrokingData) => {
		// Validation is handled by Zod schema via zodResolver
		// Derive isCoBroking from representationType for backward compatibility
		const updatedData = {
			...formData,
			isCoBroking: formData.representationType === "co_broking",
		};

		onUpdate(updatedData);
		onNext();
	};

	// Auto-save on form changes
	const handleFormChange = () => {
		const values = form.getValues();
		// Derive isCoBroking from representationType
		const updatedValues = {
			...values,
			isCoBroking: values.representationType === "co_broking",
		};
		onUpdate(updatedValues);
	};

	const watchedValues = form.watch();
	const representationType = watchedValues.representationType;
	const isCoBroking = representationType === "co_broking";
	const isDirectRepresentation = representationType === "direct";

	// Calculate your commission share for display
	const coBrokerSplit = watchedValues.coBrokingData?.commissionSplit || 50;
	const yourSplit = 100 - coBrokerSplit;

	// Get context-aware description for direct representation
	const getDirectRepresentationContext = () => {
		if (marketType === "primary") {
			return "You represent the buyer/tenant. The developer represents their project.";
		}
		if (marketType === "secondary") {
			return "You represent the buyer/tenant. The owner represents themselves (or has their own agent).";
		}
		return "You represent your client exclusively in this transaction.";
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Users className="h-5 w-5" />
						Representation Type
					</CardTitle>
					<CardDescription>
						How are you representing this transaction?
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(handleSubmit)}
							className="space-y-6"
						>
							{/* Simplified Representation Type Selection - 2 options */}
							<FormField
								control={form.control}
								name="representationType"
								render={({ field }) => (
									<FormItem className="space-y-4">
										<FormLabel className="text-base font-medium">
											Select your representation type
										</FormLabel>
										<FormControl>
											<RadioGroup
												onValueChange={(value) => {
													field.onChange(value as RepresentationType);
													handleFormChange();
												}}
												value={field.value}
												className="grid gap-4"
											>
												{representationTypeOptions.map((option) => (
													<div key={option.value} className="relative">
														<RadioGroupItem
															value={option.value}
															id={option.value}
															className="peer sr-only"
														/>
														<Label
															htmlFor={option.value}
															className="flex cursor-pointer items-start gap-4 rounded-lg border-2 p-4 transition-all hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
														>
															<div className="flex-1 space-y-1">
																<p className="font-medium leading-none">
																	{option.label}
																</p>
																<p className="text-sm text-muted-foreground">
																	{option.value === "direct"
																		? getDirectRepresentationContext()
																		: option.description
																	}
																</p>
																<p className="text-xs text-muted-foreground/80 mt-1">
																	{option.commissionInfo}
																</p>
															</div>
														</Label>
													</div>
												))}
											</RadioGroup>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							{/* Co-Broking Details (only show if co-broking selected) */}
							{isCoBroking && (
								<>
									<Separator />

									<div className="space-y-4">
										<h3 className="flex items-center gap-2 font-medium text-lg">
											<Building className="h-5 w-5" />
											Co-Broking Partner Details
										</h3>

										<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
											{/* Agent Name */}
											<FormField
												control={form.control}
												name="coBrokingData.agentName"
												render={({ field }) => (
													<FormItem>
														<FormLabel className="flex items-center gap-2">
															<User className="h-4 w-4" />
															Agent Name *
														</FormLabel>
														<FormControl>
															<Input
																placeholder="Enter agent's full name"
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

											{/* Agency Name */}
											<FormField
												control={form.control}
												name="coBrokingData.agencyName"
												render={({ field }) => (
													<FormItem>
														<FormLabel className="flex items-center gap-2">
															<Building className="h-4 w-4" />
															Agency Name *
														</FormLabel>
														<FormControl>
															<Input
																placeholder="Enter agency name"
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

											{/* Agent Phone */}
											<FormField
												control={form.control}
												name="coBrokingData.agentPhone"
												render={({ field }) => (
													<FormItem>
														<FormLabel className="flex items-center gap-2">
															<Phone className="h-4 w-4" />
															Phone Number *
														</FormLabel>
														<FormControl>
															<Input
																type="tel"
																placeholder="Enter phone number"
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

											{/* Agent Email */}
											<FormField
												control={form.control}
												name="coBrokingData.agentEmail"
												render={({ field }) => (
													<FormItem>
														<FormLabel className="flex items-center gap-2">
															<Mail className="h-4 w-4" />
															Email Address
														</FormLabel>
														<FormControl>
															<Input
																type="email"
																placeholder="Enter email address"
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

										{/* Commission Split with Visual Indicator (Issue #6 fix) */}
										<FormField
											control={form.control}
											name="coBrokingData.commissionSplit"
											render={({ field }) => (
												<FormItem>
													<FormLabel className="flex items-center gap-2">
														<Percent className="h-4 w-4" />
														Commission Split
													</FormLabel>
													<FormControl>
														<div className="space-y-3">
															<div className="flex items-center gap-2">
																<Input
																	type="number"
																	min="0"
																	max="100"
																	placeholder="50"
																	className="w-24"
																	{...field}
																	onChange={(e) => {
																		field.onChange(Number(e.target.value));
																		handleFormChange();
																	}}
															/>
															<span className="text-sm text-muted-foreground">% to co-broker</span>
														</div>
														{/* Visual Split Indicator (Issue #6 fix) */}
														<div className="space-y-2">
															<div className="flex justify-between text-sm">
																<span>Your share: {yourSplit}%</span>
																<span>Co-broker share: {coBrokerSplit}%</span>
															</div>
															<Progress value={yourSplit} className="h-2" />
														</div>
													</div>
												</FormControl>
												<FormDescription>
													Percentage of commission going to the co-broking agent
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								{/* Co-Broking Summary */}
								{watchedValues.coBrokingData?.agentName &&
									watchedValues.coBrokingData?.agencyName && (
										<Card className="bg-muted/50">
											<CardHeader>
												<CardTitle className="flex items-center gap-2 text-lg">
													<Building className="h-5 w-5" />
													Co-Broking Summary
												</CardTitle>
											</CardHeader>
											<CardContent className="space-y-2">
												<div className="flex justify-between">
													<span className="text-muted-foreground">Agent:</span>
													<span className="font-medium">
														{watchedValues.coBrokingData.agentName}
													</span>
												</div>
												<div className="flex justify-between">
													<span className="text-muted-foreground">Agency:</span>
													<span className="font-medium">
														{watchedValues.coBrokingData.agencyName}
													</span>
												</div>
												{watchedValues.coBrokingData.agentPhone && (
													<div className="flex justify-between">
														<span className="text-muted-foreground">Phone:</span>
														<span className="font-medium">
															{watchedValues.coBrokingData.agentPhone}
														</span>
													</div>
												)}
												{watchedValues.coBrokingData.agentEmail && (
													<div className="flex justify-between">
														<span className="text-muted-foreground">Email:</span>
														<span className="font-medium">
															{watchedValues.coBrokingData.agentEmail}
														</span>
													</div>
												)}
												<Separator className="my-2" />
												<div className="flex justify-between font-medium">
													<span>Commission Split:</span>
													<span>
														You: {yourSplit}% / Co-broker: {coBrokerSplit}%
													</span>
												</div>
											</CardContent>
										</Card>
									)}
								</>
							)}

							{/* Summary for direct representation */}
							{isDirectRepresentation && (
								<Card className="bg-muted/50">
									<CardContent className="pt-6">
										<div className="text-center text-muted-foreground">
											<User className="mx-auto mb-2 h-12 w-12 opacity-50" />
											<p className="font-medium">Direct Representation</p>
											<p className="text-sm">
												{getDirectRepresentationContext()}
											</p>
											<p className="text-sm mt-2">
												You will receive your full agent share of the commission.
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
									Back to Client
								</Button>
								<Button
									type="submit"
									className="flex items-center gap-2"
								>
									Continue to Commission
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
