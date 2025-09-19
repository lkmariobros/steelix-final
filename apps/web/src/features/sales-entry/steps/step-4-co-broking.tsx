"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Building, Percent, Users } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

import { type CoBrokingData, createCoBrokingSchema } from "../transaction-schema";

interface StepCoBrokingProps {
	data?: CoBrokingData;
	isDualPartyDeal?: boolean; // Pass dual agency info from client step
	onUpdate: (data: CoBrokingData) => void;
	onNext: () => void;
	onPrevious: () => void;
}

export function StepCoBroking({
	data,
	isDualPartyDeal,
	onUpdate,
	onNext,
	onPrevious,
}: StepCoBrokingProps) {
	const form = useForm<CoBrokingData>({
		resolver: zodResolver(createCoBrokingSchema(isDualPartyDeal)),
		mode: "onChange", // Validate on change to provide immediate feedback
		defaultValues: {
			isCoBroking: isDualPartyDeal ? false : (data?.isCoBroking || false), // Force false for dual agency
			coBrokingData: data?.coBrokingData || {
				agentName: "",
				agencyName: "",
				commissionSplit: 50,
				contactInfo: "",
			},
		},
	});

	const handleSubmit = (formData: CoBrokingData) => {
		// If this is a dual agency deal, co-broking doesn't make sense
		if (isDualPartyDeal && formData.isCoBroking) {
			form.setError("isCoBroking", {
				type: "logical",
				message: "Co-broking is not applicable when you represent both parties (dual agency)"
			});
			return;
		}

		// Validate co-broking data if co-broking is enabled
		if (formData.isCoBroking && !isDualPartyDeal) {
			const { agentName, agencyName, contactInfo } = formData.coBrokingData || {};

			if (!agentName?.trim() || !agencyName?.trim() || !contactInfo?.trim()) {
				// Set form errors for missing fields
				if (!agentName?.trim()) {
					form.setError("coBrokingData.agentName", {
						type: "required",
						message: "Agent name is required for co-broking transactions"
					});
				}
				if (!agencyName?.trim()) {
					form.setError("coBrokingData.agencyName", {
						type: "required",
						message: "Agency name is required for co-broking transactions"
					});
				}
				if (!contactInfo?.trim()) {
					form.setError("coBrokingData.contactInfo", {
						type: "required",
						message: "Contact info is required for co-broking transactions"
					});
				}
				return; // Don't proceed to next step
			}
		}

		onUpdate(formData);
		onNext();
	};

	// Auto-save on form changes
	const handleFormChange = () => {
		const values = form.getValues();
		onUpdate(values);
	};

	const watchedValues = form.watch();
	const isCoBroking = watchedValues.isCoBroking;

	// For dual agency, the form should be considered valid even if co-broking fields are empty
	const isFormValidForProgression = isDualPartyDeal || form.formState.isValid;

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Co-Broking Arrangement</CardTitle>
					<CardDescription>
						Specify if this transaction involves co-broking with another agent
						or agency
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(handleSubmit)}
							className="space-y-6"
						>
							{/* Dual Agency Warning */}
							{isDualPartyDeal && (
								<Card className="border-blue-200 bg-blue-50">
									<CardContent className="pt-6">
										<div className="flex items-start gap-3">
											<div className="rounded-full bg-blue-100 p-1">
												<Users className="h-4 w-4 text-blue-600" />
											</div>
											<div className="space-y-1">
												<p className="text-sm font-medium text-blue-800">
													Dual Agency Transaction
												</p>
												<p className="text-sm text-blue-700">
													You indicated that you represent both parties in this transaction.
													Co-broking is not applicable since you will receive the full commission.
												</p>
											</div>
										</div>
									</CardContent>
								</Card>
							)}

							{/* Co-Broking Toggle */}
							<FormField
								control={form.control}
								name="isCoBroking"
								render={({ field }) => (
									<FormItem className={`flex flex-row items-center justify-between rounded-lg border p-4 ${
										isDualPartyDeal ? 'opacity-50 pointer-events-none' : ''
									}`}>
										<div className="space-y-0.5">
											<FormLabel className="text-base">
												Co-Broking Transaction
											</FormLabel>
											<FormDescription>
												{isDualPartyDeal
													? "Not applicable for dual agency transactions"
													: "Is this transaction being co-brokered with another agent?"
												}
											</FormDescription>
										</div>
										<FormControl>
											<Switch
												checked={isDualPartyDeal ? false : field.value}
												disabled={isDualPartyDeal}
												onCheckedChange={(checked) => {
													if (!isDualPartyDeal) {
														field.onChange(checked);
														handleFormChange();
													}
												}}
											/>
										</FormControl>
									</FormItem>
								)}
							/>

							{/* Co-Broking Details (only show if enabled and not dual agency) */}
							{isCoBroking && !isDualPartyDeal && (
								<>
									<Separator />

									<div className="space-y-4">
										<h3 className="flex items-center gap-2 font-medium text-lg">
											<Users className="h-5 w-5" />
											Co-Broking Partner Details
										</h3>

										<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
											{/* Agent Name */}
											<FormField
												control={form.control}
												name="coBrokingData.agentName"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Co-Broking Agent Name</FormLabel>
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
														<FormLabel>Agency Name</FormLabel>
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
										</div>

										{/* Commission Split */}
										<FormField
											control={form.control}
											name="coBrokingData.commissionSplit"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Commission Split (%)</FormLabel>
													<FormControl>
														<div className="flex items-center gap-2">
															<Input
																type="number"
																min="0"
																max="100"
																placeholder="50"
																{...field}
																onChange={(e) => {
																	field.onChange(Number(e.target.value));
																	handleFormChange();
																}}
															/>
															<Percent className="h-4 w-4 text-muted-foreground" />
														</div>
													</FormControl>
													<FormDescription>
														Percentage of commission going to the co-broking
														agent (0-100%)
													</FormDescription>
													<FormMessage />
												</FormItem>
											)}
										/>

										{/* Contact Information */}
										<FormField
											control={form.control}
											name="coBrokingData.contactInfo"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Contact Information</FormLabel>
													<FormControl>
														<Input
															placeholder="Email or phone number"
															{...field}
															onChange={(e) => {
																field.onChange(e);
																handleFormChange();
															}}
														/>
													</FormControl>
													<FormDescription>
														Primary contact method for the co-broking agent
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
														<span className="text-muted-foreground">
															Agent:
														</span>
														<span className="font-medium">
															{watchedValues.coBrokingData.agentName}
														</span>
													</div>
													<div className="flex justify-between">
														<span className="text-muted-foreground">
															Agency:
														</span>
														<span className="font-medium">
															{watchedValues.coBrokingData.agencyName}
														</span>
													</div>
													<div className="flex justify-between">
														<span className="text-muted-foreground">
															Commission Split:
														</span>
														<span className="font-medium">
															{watchedValues.coBrokingData.commissionSplit || 0}% /{" "}
															{100 -
																(watchedValues.coBrokingData.commissionSplit || 0)}
															%
														</span>
													</div>
													{watchedValues.coBrokingData.contactInfo && (
														<div className="flex justify-between">
															<span className="text-muted-foreground">
																Contact:
															</span>
															<span className="font-medium">
																{watchedValues.coBrokingData.contactInfo}
															</span>
														</div>
													)}
												</CardContent>
											</Card>
										)}
								</>
							)}

							{/* No Co-Broking Message */}
							{!isCoBroking && (
								<Card className="bg-muted/50">
									<CardContent className="pt-6">
										<div className="text-center text-muted-foreground">
											<Users className="mx-auto mb-2 h-12 w-12 opacity-50" />
											{isDualPartyDeal ? (
												<>
													<p>This is a dual agency transaction.</p>
													<p className="text-sm">
														You represent both parties and will receive the full commission.
													</p>
												</>
											) : (
												<>
													<p>This transaction does not involve co-broking.</p>
													<p className="text-sm">
														You will receive the full commission.
													</p>
												</>
											)}
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
								{isDualPartyDeal ? (
									// For dual agency, bypass form validation and proceed directly
									<Button
										type="button"
										onClick={() => {
											const currentValues = form.getValues();
											handleSubmit(currentValues);
										}}
										className="flex items-center gap-2"
									>
										Continue to Commission
										<ArrowRight className="h-4 w-4" />
									</Button>
								) : (
									// For regular transactions, use form validation
									<Button
										type="submit"
										disabled={!isFormValidForProgression}
										className="flex items-center gap-2"
									>
										Continue to Commission
										<ArrowRight className="h-4 w-4" />
									</Button>
								)}
							</div>
						</form>
					</Form>
				</CardContent>
			</Card>
		</div>
	);
}
