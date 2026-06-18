"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Search, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { CurrencyInput } from "@/components/currency-input";
import { RequiredFieldsNote, RequiredLabel } from "@/components/required-label";
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

import {
	type CompleteTransactionData,
	detailsStepSchema,
	genderOptions,
	marketTypeOptions,
	purchasingMethodOptions,
	representationTypeOptions,
} from "../transaction-schema";
import type { StepNavigationOptions } from "./step-nav";

const NO_PROJECT = "__none__";

type DetailsFormValues = z.infer<typeof detailsStepSchema>;

interface StepDetailsProps extends StepNavigationOptions {
	formData: Partial<CompleteTransactionData>;
	onUpdate: (data: Partial<CompleteTransactionData>) => void;
	onNext: () => void;
}

export function StepDetails({
	formData,
	onUpdate,
	onNext,
	hideNavigation = false,
	nextLabel = "Continue to Upload",
}: StepDetailsProps) {
	const [agentSearch, setAgentSearch] = useState("");
	const [coBrokePickerOpen, setCoBrokePickerOpen] = useState(false);
	const [selectedCoBrokeLabel, setSelectedCoBrokeLabel] = useState<
		string | null
	>(formData.coBrokingData?.agentName ?? null);

	const { data: projects = [] } =
		trpc.commissionSchemes.listProjectsForAgent.useQuery();

	const form = useForm<DetailsFormValues>({
		resolver: zodResolver(detailsStepSchema),
		defaultValues: {
			marketType: formData.marketType ?? "primary",
			transactionType: formData.transactionType ?? "sale",
			projectName: formData.projectName ?? "",
			unitNo: formData.unitNo ?? "",
			blockListingId: formData.blockListingId,
			bookingDate: formData.bookingDate ?? formData.transactionDate ?? new Date(),
			commissionType: formData.commissionType ?? "percentage",
			commissionValue: formData.commissionValue ?? 0,
			propertyData: {
				price: formData.propertyData?.price ?? 0,
				address: formData.propertyData?.address ?? "",
				salesPackage: formData.propertyData?.salesPackage ?? "",
				rebateAmount: formData.propertyData?.rebateAmount,
				purchasingMethod: formData.propertyData?.purchasingMethod,
				listingId: formData.propertyData?.listingId,
				listingTitle: formData.propertyData?.listingTitle,
				schemeId: formData.propertyData?.schemeId,
			},
			clientData: {
				name: formData.clientData?.name ?? "",
				icNo: formData.clientData?.icNo ?? "",
				email: formData.clientData?.email ?? "",
				phone: formData.clientData?.phone ?? "",
				address: formData.clientData?.address ?? "",
				race: formData.clientData?.race ?? "",
				nationality: formData.clientData?.nationality ?? "",
				gender: formData.clientData?.gender ?? "",
				emergencyName: formData.clientData?.emergencyName ?? "",
				emergencyContact: formData.clientData?.emergencyContact ?? "",
			},
			representationType: formData.representationType ?? "direct",
			coBrokingData: formData.coBrokingData,
		},
	});

	const projectName = form.watch("projectName");
	const marketType = form.watch("marketType");
	const representationType = form.watch("representationType");
	const propertyPrice = form.watch("propertyData.price");
	const commissionValue = form.watch("commissionValue");

	const { data: schemesForProject } = trpc.commissionSchemes.listByProject.useQuery(
		{ projectName: projectName ?? "" },
		{ enabled: marketType === "primary" && Boolean(projectName?.trim()) },
	);

	const { data: secondaryPreview } = trpc.agentTiers.getCommissionPreview.useQuery(
		{
			propertyPrice: propertyPrice || 1,
			commissionType: "percentage",
			commissionValue: commissionValue || 1,
			representationType:
				representationType === "co_broking" ? "co_broking" : "direct",
			coBrokerSplitPercentage: form.getValues("coBrokingData.commissionSplit") ?? 50,
		},
		{
			enabled:
				marketType === "secondary" &&
				propertyPrice > 0 &&
				(commissionValue ?? 0) > 0,
		},
	);

	const selectedScheme = useMemo(() => {
		const schemes = schemesForProject?.schemes ?? [];
		return schemes[0] ?? null;
	}, [schemesForProject]);

	useEffect(() => {
		if (!selectedScheme) return;
		form.setValue("blockListingId", selectedScheme.blockListingId ?? undefined);
		form.setValue("propertyData.listingId", selectedScheme.blockListingId ?? undefined);
		form.setValue("propertyData.listingTitle", selectedScheme.blockListingTitle ?? undefined);
		form.setValue("propertyData.schemeId", selectedScheme.id);
	}, [selectedScheme, form]);

	const { data: coBrokingAgents = [], isLoading: coBrokingAgentsLoading } =
		trpc.agents.searchForCoBroking.useQuery(
			{ search: agentSearch.trim() || undefined, limit: 50 },
			{
				enabled:
					representationType === "co_broking" &&
					coBrokePickerOpen &&
					!selectedCoBrokeLabel,
			},
		);

	const showAgentPicker = coBrokePickerOpen && !selectedCoBrokeLabel;

	const syncToParent = () => {
		const values = form.getValues();
		const isCoBroking = values.representationType === "co_broking";
		onUpdate({
			marketType: values.marketType,
			transactionType:
				values.marketType === "primary" ? "sale" : values.transactionType,
			projectName: values.projectName,
			unitNo: values.unitNo,
			blockListingId: values.blockListingId,
			bookingDate: values.bookingDate,
			transactionDate: values.bookingDate,
			propertyData: values.propertyData,
			clientData: values.clientData,
			representationType: values.representationType,
			isCoBroking,
			coBrokingData: isCoBroking ? values.coBrokingData : undefined,
			commissionType: values.commissionType,
			commissionValue: values.commissionValue,
		});
	};

	const handleSubmit = (values: DetailsFormValues) => {
		const isCoBroking = values.representationType === "co_broking";
		onUpdate({
			marketType: values.marketType,
			transactionType:
				values.marketType === "primary" ? "sale" : values.transactionType,
			projectName: values.projectName,
			unitNo: values.unitNo,
			blockListingId: values.blockListingId,
			bookingDate: values.bookingDate,
			transactionDate: values.bookingDate,
			propertyData: values.propertyData,
			clientData: values.clientData,
			representationType: values.representationType,
			isCoBroking,
			coBrokingData: isCoBroking ? values.coBrokingData : undefined,
			commissionType: values.commissionType,
			commissionValue: values.commissionValue,
		});
		onNext();
	};

	const selectCoBrokingAgent = (agent: {
		id: string;
		name: string | null;
		email: string | null;
		phone: string | null;
		branch: string | null;
	}) => {
		const coBrokingData = {
			...(form.getValues("coBrokingData") ?? {}),
			internalAgentId: agent.id,
			agentName: agent.name ?? "",
			agentEmail: agent.email ?? "",
			agentPhone: agent.phone ?? "",
			agencyName: agent.branch ?? "Steelix",
			contactInfo: [agent.email, agent.phone].filter(Boolean).join(" · "),
			commissionSplit: form.getValues("coBrokingData.commissionSplit") ?? 50,
		};
		form.setValue("coBrokingData", coBrokingData, {
			shouldDirty: true,
			shouldValidate: true,
		});
		form.clearErrors("coBrokingData");
		setAgentSearch("");
		setCoBrokePickerOpen(false);
		setSelectedCoBrokeLabel(agent.name ?? agent.email ?? "Selected agent");
		syncToParent();
		toast.success(`Co-broke agent: ${agent.name ?? "Selected"}`);
	};

	const handleInvalidSubmit = () => {
		const errors = form.formState.errors;
		const firstMessage =
			errors.projectName?.message ??
			errors.propertyData?.address?.message ??
			errors.commissionValue?.message ??
			errors.unitNo?.message ??
			errors.bookingDate?.message ??
			errors.propertyData?.price?.message ??
			errors.clientData?.name?.message ??
			errors.clientData?.icNo?.message ??
			errors.clientData?.phone?.message ??
			errors.clientData?.address?.message ??
			errors.coBrokingData?.agentName?.message ??
			errors.coBrokingData?.agentPhone?.message ??
			"Please complete all required fields";
		toast.error(String(firstMessage));
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Deal Details</CardTitle>
					<CardDescription>
						{marketType === "primary"
							? "Primary market: project commission scheme applies (agent receives 100% of scheme)."
							: "Secondary market: your tier split applies (70% / 80% / 85% / 90%)."}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(handleSubmit, handleInvalidSubmit)}
							className="space-y-6"
						>
							<RequiredFieldsNote />

							<FormField
								control={form.control}
								name="marketType"
								render={({ field }) => (
									<FormItem>
										<RequiredLabel>Market Type</RequiredLabel>
										<FormControl>
											<div className="grid gap-3 md:grid-cols-2">
												{marketTypeOptions.map((opt) => (
													<button
														key={opt.value}
														type="button"
														className={`rounded-lg border p-4 text-left transition-colors ${
															field.value === opt.value
																? "border-primary bg-primary/5"
																: "hover:bg-muted/50"
														}`}
														onClick={() => {
															field.onChange(opt.value);
															if (opt.value === "primary") {
																form.setValue("transactionType", "sale");
															}
															syncToParent();
														}}
													>
														<p className="font-medium">{opt.label}</p>
														<p className="mt-1 text-muted-foreground text-sm">
															{opt.value === "primary"
																? "New development / project sales"
																: "Resale, subsale, or rental"}
														</p>
													</button>
												))}
											</div>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<div className="grid gap-4 md:grid-cols-2">
								{marketType === "primary" ? (
								<FormField
									control={form.control}
									name="projectName"
									render={({ field }) => (
										<FormItem>
											<RequiredLabel>Project</RequiredLabel>
											<Select
												value={field.value || NO_PROJECT}
												onValueChange={(v) => {
													if (v === NO_PROJECT) {
														field.onChange("");
														form.setValue("blockListingId", undefined);
														return;
													}
													field.onChange(v);
													syncToParent();
												}}
											>
												<FormControl>
													<SelectTrigger>
														<SelectValue placeholder="Select project" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													<SelectItem value={NO_PROJECT}>Select project…</SelectItem>
													{projects.map((p) => (
														<SelectItem key={p} value={p}>
															{p}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>
								) : (
								<FormField
									control={form.control}
									name="propertyData.address"
									render={({ field }) => (
										<FormItem className="md:col-span-2">
											<RequiredLabel>Property Address</RequiredLabel>
											<FormControl>
												<Textarea
													{...field}
													value={field.value ?? ""}
													rows={2}
													onBlur={() => syncToParent()}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								)}

								{marketType === "primary" ? (
								<FormField
									control={form.control}
									name="unitNo"
									render={({ field }) => (
										<FormItem>
											<RequiredLabel>Unit</RequiredLabel>
											<FormControl>
												<Input
													{...field}
													placeholder="e.g. A-12-03"
													onBlur={() => syncToParent()}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								) : (
								<FormField
									control={form.control}
									name="transactionType"
									render={({ field }) => (
										<FormItem>
											<RequiredLabel>Transaction Type</RequiredLabel>
											<Select
												value={field.value}
												onValueChange={(v) => {
													field.onChange(v as "sale" | "lease");
													syncToParent();
												}}
											>
												<FormControl>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													<SelectItem value="sale">Sale</SelectItem>
													<SelectItem value="lease">Lease</SelectItem>
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>
								)}

								<FormField
									control={form.control}
									name="propertyData.price"
									render={({ field }) => (
										<FormItem>
											<RequiredLabel>Price (RM)</RequiredLabel>
											<FormControl>
												<CurrencyInput
													value={field.value}
													onChange={(v) => {
														field.onChange(v);
														syncToParent();
													}}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								{marketType === "secondary" ? (
									<FormField
										control={form.control}
										name="commissionValue"
										render={({ field }) => (
											<FormItem>
												<RequiredLabel>Commission Rate (%)</RequiredLabel>
												<FormControl>
													<Input
														type="number"
														min={0}
														max={100}
														step={0.01}
														value={field.value ?? ""}
														onChange={(e) => {
															field.onChange(Number(e.target.value));
															syncToParent();
														}}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								) : null}

								{marketType === "primary" ? (
								<FormField
									control={form.control}
									name="propertyData.salesPackage"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Sales Package</FormLabel>
											<FormControl>
												<Input {...field} onBlur={() => syncToParent()} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								) : null}

								{marketType === "primary" ? (
								<FormField
									control={form.control}
									name="propertyData.rebateAmount"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Rebate (RM)</FormLabel>
											<FormControl>
												<CurrencyInput
													value={field.value ?? 0}
													onChange={(v) => {
														field.onChange(v || undefined);
														syncToParent();
													}}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								) : null}

								{marketType === "secondary" && secondaryPreview ? (
									<div className="md:col-span-2 rounded-lg border bg-muted/30 p-3 text-sm">
										<p className="font-medium">Your estimated share (tier split)</p>
										<p className="mt-1 text-muted-foreground">
											{secondaryPreview.companyCommissionSplit}% of total commission
											→ RM{" "}
											{secondaryPreview.agentEarnings.toLocaleString(undefined, {
												minimumFractionDigits: 2,
											})}
										</p>
									</div>
								) : null}

								{marketType === "primary" && selectedScheme?.tiers?.[0] ? (
									<div className="md:col-span-2 rounded-lg border bg-muted/30 p-3 text-sm">
										<p className="font-medium">Primary scheme preview</p>
										<p className="mt-1 text-muted-foreground">
											Announced commission:{" "}
											{selectedScheme.tiers[0].commissionPercent.toFixed(2)}% — you
											receive 100% of scheme net
										</p>
										{selectedScheme.tiers[0].overridePercent > 0 ? (
											<p className="mt-1 text-muted-foreground">
												Upline override:{" "}
												{selectedScheme.tiers[0].overridePercent.toFixed(2)}% (paid
												separately, not deducted from your share)
											</p>
										) : null}
									</div>
								) : null}

								<FormField
									control={form.control}
									name="bookingDate"
									render={({ field }) => (
										<FormItem>
											<RequiredLabel>Booking Date</RequiredLabel>
											<FormControl>
												<Input
													type="date"
													value={
														field.value
															? field.value.toISOString().slice(0, 10)
															: ""
													}
													onChange={(e) => {
														const d = e.target.value
															? new Date(e.target.value)
															: undefined;
														field.onChange(d);
														syncToParent();
													}}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="propertyData.purchasingMethod"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Purchasing Method</FormLabel>
											<Select
												value={field.value ?? ""}
												onValueChange={(v) => {
													field.onChange(v as "cash" | "loan");
													syncToParent();
												}}
											>
												<FormControl>
													<SelectTrigger>
														<SelectValue placeholder="Cash or Loan" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													{purchasingMethodOptions.map((o) => (
														<SelectItem key={o.value} value={o.value}>
															{o.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							<Separator />

							<div>
								<h3 className="mb-4 font-medium text-lg">Purchaser</h3>
								<div className="grid gap-4 md:grid-cols-2">
									<FormField
										control={form.control}
										name="clientData.name"
										render={({ field }) => (
											<FormItem>
												<RequiredLabel>Name</RequiredLabel>
												<FormControl>
													<Input {...field} onBlur={() => syncToParent()} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="clientData.icNo"
										render={({ field }) => (
											<FormItem>
												<RequiredLabel>IC / Passport</RequiredLabel>
												<FormControl>
													<Input {...field} onBlur={() => syncToParent()} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="clientData.email"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Email</FormLabel>
												<FormControl>
													<Input type="email" {...field} onBlur={() => syncToParent()} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="clientData.phone"
										render={({ field }) => (
											<FormItem>
												<RequiredLabel>Phone</RequiredLabel>
												<FormControl>
													<Input {...field} onBlur={() => syncToParent()} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="clientData.address"
										render={({ field }) => (
											<FormItem className="md:col-span-2">
												<RequiredLabel>Correspondence Address</RequiredLabel>
												<FormControl>
													<Textarea {...field} rows={2} onBlur={() => syncToParent()} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="clientData.race"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Race</FormLabel>
												<FormControl>
													<Input {...field} onBlur={() => syncToParent()} />
												</FormControl>
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="clientData.nationality"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Nationality</FormLabel>
												<FormControl>
													<Input {...field} onBlur={() => syncToParent()} />
												</FormControl>
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="clientData.gender"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Gender</FormLabel>
												<Select
													value={field.value ?? ""}
													onValueChange={(v) => {
														field.onChange(v);
														syncToParent();
													}}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														{genderOptions.map((o) => (
															<SelectItem key={o.value} value={o.value}>
																{o.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="clientData.emergencyName"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Emergency Contact Name</FormLabel>
												<FormControl>
													<Input {...field} onBlur={() => syncToParent()} />
												</FormControl>
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="clientData.emergencyContact"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Emergency Contact Phone</FormLabel>
												<FormControl>
													<Input {...field} onBlur={() => syncToParent()} />
												</FormControl>
											</FormItem>
										)}
									/>
								</div>
							</div>

							<Separator />

							<div>
								<h3 className="mb-4 font-medium text-lg">Representation</h3>
								<FormField
									control={form.control}
									name="representationType"
									render={({ field }) => (
										<FormItem>
											<FormControl>
												<div className="grid gap-3 md:grid-cols-2">
													{representationTypeOptions.map((opt) => (
														<button
															key={opt.value}
															type="button"
															className={`rounded-lg border p-4 text-left transition-colors ${
																field.value === opt.value
																	? "border-primary bg-primary/5"
																	: "hover:bg-muted/50"
															}`}
															onClick={() => {
																field.onChange(opt.value);
																if (opt.value === "co_broking") {
																	form.setValue(
																		"coBrokingData",
																		form.getValues("coBrokingData") ?? {
																			commissionSplit: 50,
																		},
																	);
																} else {
																	form.setValue("coBrokingData", undefined);
																	setSelectedCoBrokeLabel(null);
																	setAgentSearch("");
																	setCoBrokePickerOpen(false);
																}
																syncToParent();
															}}
														>
															<p className="font-medium">{opt.label}</p>
															<p className="mt-1 text-muted-foreground text-sm">
																{opt.description}
															</p>
														</button>
													))}
												</div>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								{representationType === "co_broking" && (
									<div className="mt-4 space-y-4 rounded-lg border p-4">
										<div className="flex items-center gap-2">
											<UserPlus className="h-4 w-4" />
											<p className="font-medium text-sm">Co-broke Agent</p>
										</div>

										{selectedCoBrokeLabel ? (
											<div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
												<span>
													<span className="text-muted-foreground">
														Selected:{" "}
													</span>
													{selectedCoBrokeLabel}
												</span>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onClick={() => {
														form.setValue("coBrokingData", {
															commissionSplit: 50,
														});
														setSelectedCoBrokeLabel(null);
														setAgentSearch("");
														setCoBrokePickerOpen(true);
														syncToParent();
													}}
												>
													Change
												</Button>
											</div>
										) : (
											<div className="relative">
												<Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
												<Input
													className="pl-8"
													placeholder="Search internal agents…"
													value={agentSearch}
													onChange={(e) => {
														setAgentSearch(e.target.value);
														setCoBrokePickerOpen(true);
													}}
													onFocus={() => setCoBrokePickerOpen(true)}
													onKeyDown={(e) => {
														if (e.key === "Enter") {
															e.preventDefault();
														}
													}}
												/>
											</div>
										)}
										{showAgentPicker && (
											<ul className="max-h-40 space-y-1 overflow-y-auto rounded border p-2">
												{coBrokingAgentsLoading ? (
													<li className="px-2 py-1.5 text-muted-foreground text-sm">
														Loading agents…
													</li>
												) : coBrokingAgents.length === 0 ? (
													<li className="px-2 py-1.5 text-muted-foreground text-sm">
														No agents found
													</li>
												) : (
													coBrokingAgents.map((a) => (
														<li key={a.id}>
															<button
																type="button"
																className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
																onMouseDown={(e) => e.preventDefault()}
																onClick={(e) => {
																	e.preventDefault();
																	e.stopPropagation();
																	selectCoBrokingAgent(a);
																}}
															>
																{a.name} · {a.email}
															</button>
														</li>
													))
												)}
											</ul>
										)}
										<FormField
											control={form.control}
											name="coBrokingData.commissionSplit"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Your commission split (%)</FormLabel>
													<FormControl>
														<Input
															type="number"
															min={0}
															max={100}
															value={field.value ?? 50}
															onChange={(e) => {
																field.onChange(Number(e.target.value));
																syncToParent();
															}}
														/>
													</FormControl>
												</FormItem>
											)}
										/>
									</div>
								)}
							</div>

							{!hideNavigation && (
								<div className="flex justify-end">
									<Button type="submit">
										{nextLabel}
										<ArrowRight className="ml-2 h-4 w-4" />
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
