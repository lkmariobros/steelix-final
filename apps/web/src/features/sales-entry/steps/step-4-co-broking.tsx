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

import { type CoBrokingData, coBrokingSchema } from "../transaction-schema";

interface StepCoBrokingProps {
	data?: CoBrokingData;
	onUpdate: (data: CoBrokingData) => void;
	onNext: () => void;
	onPrevious: () => void;
}

export function StepCoBroking({
	data,
	onUpdate,
	onNext,
	onPrevious,
}: StepCoBrokingProps) {
	const form = useForm<CoBrokingData>({
		resolver: zodResolver(coBrokingSchema),
		mode: "onChange", // Validate on change to provide immediate feedback
		defaultValues: {
			isCoBroking: data?.isCoBroking || false,
			coBrokingData: data?.coBrokingData || {
				agentName: "",
				agencyName: "",
				commissionSplit: 50,
				contactInfo: "",
			},
		},
	});

	const handleSubmit = (formData: CoBrokingData) => {
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
							{/* Co-Broking Toggle */}
							<FormField
								control={form.control}
								name="isCoBroking"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
										<div className="space-y-0.5">
											<FormLabel className="text-base">
												Co-Broking Transaction
											</FormLabel>
											<FormDescription>
												Is this transaction being co-brokered with another
												agent?
											</FormDescription>
										</div>
										<FormControl>
											<Switch
												checked={field.value}
												onCheckedChange={(checked) => {
													field.onChange(checked);
													handleFormChange();
												}}
											/>
										</FormControl>
									</FormItem>
								)}
							/>

							{/* Co-Broking Details (only show if enabled) */}
							{isCoBroking && (
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
															{watchedValues.coBrokingData.commissionSplit}% /{" "}
															{100 -
																watchedValues.coBrokingData.commissionSplit}
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
											<p>This transaction does not involve co-broking.</p>
											<p className="text-sm">
												You will receive the full commission.
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
