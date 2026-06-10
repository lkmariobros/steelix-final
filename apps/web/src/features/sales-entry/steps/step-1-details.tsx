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

	const { data: projects = [] } =
		trpc.commissionSchemes.listProjectsForAgent.useQuery();

	const form = useForm<DetailsFormValues>({
		resolver: zodResolver(detailsStepSchema),
		defaultValues: {
			projectName: formData.projectName ?? "",
			unitNo: formData.unitNo ?? "",
			blockListingId: formData.blockListingId,
			bookingDate: formData.bookingDate ?? formData.transactionDate ?? new Date(),
			propertyData: {
				price: formData.propertyData?.price ?? 0,
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
	const representationType = form.watch("representationType");

	const { data: schemesForProject } = trpc.commissionSchemes.listByProject.useQuery(
		{ projectName: projectName ?? "" },
		{ enabled: Boolean(projectName?.trim()) },
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

	const { data: coBrokingAgents = [] } = trpc.agents.searchForCoBroking.useQuery(
		{ search: agentSearch, limit: 20 },
		{ enabled: representationType === "co_broking" },
	);

	const syncToParent = () => {
		const values = form.getValues();
		const isCoBroking = values.representationType === "co_broking";
		onUpdate({
			marketType: "primary",
			transactionType: "sale",
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
		});
	};

	const handleSubmit = (values: DetailsFormValues) => {
		const isCoBroking = values.representationType === "co_broking";
		onUpdate({
			marketType: "primary",
			transactionType: "sale",
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
		form.setValue("coBrokingData.internalAgentId", agent.id);
		form.setValue("coBrokingData.agentName", agent.name ?? "");
		form.setValue("coBrokingData.agentEmail", agent.email ?? "");
		form.setValue("coBrokingData.agentPhone", agent.phone ?? "");
		form.setValue("coBrokingData.agencyName", agent.branch ?? "Steelix");
		form.setValue(
			"coBrokingData.contactInfo",
			[agent.email, agent.phone].filter(Boolean).join(" · "),
		);
		syncToParent();
		toast.success(`Co-broke agent: ${agent.name}`);
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Property Details</CardTitle>
					<CardDescription>
						Select the project and enter unit, price, and booking information.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(handleSubmit, () => {
								toast.error("Please complete all required fields");
							})}
							className="space-y-6"
						>
							<RequiredFieldsNote />

							<div className="grid gap-4 md:grid-cols-2">
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
										<div className="relative">
											<Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
											<Input
												className="pl-8"
												placeholder="Search internal agents…"
												value={agentSearch}
												onChange={(e) => setAgentSearch(e.target.value)}
											/>
										</div>
										{coBrokingAgents.length > 0 && (
											<ul className="max-h-40 space-y-1 overflow-y-auto rounded border p-2">
												{coBrokingAgents.map((a) => (
													<li key={a.id}>
														<button
															type="button"
															className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
															onClick={() => selectCoBrokingAgent(a)}
														>
															{a.name} · {a.email}
														</button>
													</li>
												))}
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
