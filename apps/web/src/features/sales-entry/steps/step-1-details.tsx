"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Search, UserPlus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
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
import { useUserRole } from "@/contexts/user-role-context";
import { formatAgentPickerLabel } from "@/lib/agent-display";
import { trpc } from "@/utils/trpc";
import { isRentalTransactionType } from "@/features/transactions/payment-method-utils";

import { PartyPersonFields } from "../components/party-person-fields";
import { SecondaryDealFields } from "../components/secondary-deal-fields";
import {
	type CompleteTransactionData,
	detailsStepSchema,
	emptyPartyPerson,
	marketTypeOptions,
	purchasingMethodOptions,
	representationTypeOptions,
} from "../transaction-schema";
import type { StepNavigationOptions } from "./step-nav";

const NO_PROJECT = "__none__";

function getActiveSchemeTier(
	scheme: { tiers?: Array<{ isActive?: boolean; commissionPercent: number; overridePercent: number }> } | null,
) {
	if (!scheme?.tiers?.length) return null;
	return scheme.tiers.find((t) => t.isActive) ?? scheme.tiers[0] ?? null;
}

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
	const pathname = usePathname();
	const isAdminPortal = pathname.startsWith("/admin");
	const { session } = useUserRole();

	const [agentSearch, setAgentSearch] = useState("");
	const [caseAgentSearch, setCaseAgentSearch] = useState("");
	const [coBrokePickerOpen, setCoBrokePickerOpen] = useState(false);
	const [caseAgentPickerOpen, setCaseAgentPickerOpen] = useState(false);
	const [selectedCoBrokeLabel, setSelectedCoBrokeLabel] = useState<
		string | null
	>(formData.coBrokingData?.agentName ?? null);
	const [selectedCaseAgentLabel, setSelectedCaseAgentLabel] = useState<
		string | null
	>(null);

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
			commissionAmount: formData.commissionAmount ?? 0,
			propertyData: {
				price: formData.propertyData?.price ?? 0,
				address: formData.propertyData?.address ?? "",
				propertyType: formData.propertyData?.propertyType ?? "",
				salesPackage: formData.propertyData?.salesPackage ?? "",
				rebateAmount: formData.propertyData?.rebateAmount,
				spaPrice: formData.propertyData?.spaPrice,
				nettPrice: formData.propertyData?.nettPrice,
				sstPercent: formData.propertyData?.sstPercent ?? 8,
				earnestDeposit: formData.propertyData?.earnestDeposit,
				offerDate: formData.propertyData?.offerDate ?? "",
				submitDate: formData.propertyData?.submitDate ?? "",
				rentFrom: formData.propertyData?.rentFrom ?? "",
				rentTo: formData.propertyData?.rentTo ?? "",
				rentPeriod: formData.propertyData?.rentPeriod ?? "",
				purchasingMethod: formData.propertyData?.purchasingMethod,
				sstPayBy: formData.propertyData?.sstPayBy,
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
				additionalPurchasers:
					formData.clientData?.additionalPurchasers ?? [],
				vendors: formData.clientData?.vendors ?? [],
			},
			representationType: formData.representationType ?? "direct",
			coBrokingData: formData.coBrokingData,
			agentId:
				formData.agentId ??
				(!isAdminPortal ? session?.user?.id : undefined),
		},
	});

	const {
		fields: extraPurchaserFields,
		append: appendPurchaser,
		remove: removePurchaser,
	} = useFieldArray({
		control: form.control,
		name: "clientData.additionalPurchasers",
	});

	const {
		fields: vendorFields,
		append: appendVendor,
		remove: removeVendor,
	} = useFieldArray({
		control: form.control,
		name: "clientData.vendors",
	});

	const projectName = form.watch("projectName");
	const marketType = form.watch("marketType");
	const transactionType = form.watch("transactionType");
	const isRentalDeal = isRentalTransactionType(transactionType);
	const representationType = form.watch("representationType");
	const caseAgentId = form.watch("agentId");
	const coBrokerSplit = form.watch("coBrokingData.commissionSplit");
	const propertyPrice = form.watch("propertyData.price");
	const rebateAmount = form.watch("propertyData.rebateAmount");
	const commissionValue = form.watch("commissionValue");
	const schemeId = form.watch("propertyData.schemeId");
	const netPrice = Math.max(0, (propertyPrice || 0) - (rebateAmount ?? 0));

	const setNettPrice = (price: number, rebate?: number) => {
		form.setValue(
			"propertyData.nettPrice",
			Math.max(0, (price || 0) - (rebate ?? 0)),
		);
	};

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
			coBrokerSplitPercentage: coBrokerSplit ?? 50,
		},
		{
			enabled:
				marketType === "secondary" &&
				propertyPrice > 0 &&
				(commissionValue ?? 0) > 0,
		},
	);

	const { data: myTierInfo } = trpc.agentTiers.getMyTierInfo.useQuery();

	const { data: caseAgentTierInfo } = trpc.agentTiers.getAgentTierInfo.useQuery(
		{ agentId: caseAgentId! },
		{ enabled: isAdminPortal && Boolean(caseAgentId) },
	);

	const effectiveTierInfo = isAdminPortal ? caseAgentTierInfo : myTierInfo;

	useEffect(() => {
		if (isAdminPortal || !session?.user?.id) return;
		form.setValue("agentId", session.user.id);
	}, [isAdminPortal, session?.user?.id, form]);

	useEffect(() => {
		if (!isAdminPortal || !caseAgentId || !caseAgentTierInfo) return;
		setSelectedCaseAgentLabel(
			formatAgentPickerLabel({
				name: caseAgentTierInfo.name,
				nickName: caseAgentTierInfo.nickName,
				agentCode: caseAgentTierInfo.agentCode,
			}),
		);
	}, [isAdminPortal, caseAgentId, caseAgentTierInfo]);

	const schemes = schemesForProject?.schemes ?? [];

	const selectedScheme = useMemo(() => {
		if (schemeId) {
			return schemes.find((s) => s.id === schemeId) ?? schemes[0] ?? null;
		}
		return schemes[0] ?? null;
	}, [schemes, schemeId]);

	const activeSchemeTier = useMemo(
		() => getActiveSchemeTier(selectedScheme),
		[selectedScheme],
	);

	const caseAgentLabel = formatAgentPickerLabel({
		name: effectiveTierInfo?.name ?? session?.user?.name,
		nickName: effectiveTierInfo?.nickName,
		agentCode: effectiveTierInfo?.agentCode,
	});
	const tierCommissionSplit =
		effectiveTierInfo?.companyCommissionSplit ??
		effectiveTierInfo?.tierConfig?.commissionSplit ??
		70;

	const commissionPercentageLabel = useMemo(() => {
		if (marketType === "primary") {
			if (activeSchemeTier?.commissionPercent != null) {
				return `${activeSchemeTier.commissionPercent}% scheme (100% agent share)`;
			}
			return "100% of project commission scheme";
		}

		if (representationType === "co_broking") {
			const yourSplit = 100 - (coBrokerSplit ?? 50);
			return `${tierCommissionSplit}% tier · ${yourSplit}% of gross commission`;
		}

		return `${tierCommissionSplit}% commission tier`;
	}, [
		marketType,
		activeSchemeTier?.commissionPercent,
		representationType,
		coBrokerSplit,
		tierCommissionSplit,
	]);

	useEffect(() => {
		if (!selectedScheme) return;
		form.setValue("blockListingId", selectedScheme.blockListingId ?? undefined);
		form.setValue("propertyData.listingId", selectedScheme.blockListingId ?? undefined);
		form.setValue("propertyData.listingTitle", selectedScheme.blockListingTitle ?? undefined);
		form.setValue("propertyData.schemeId", selectedScheme.id);
		const tier = getActiveSchemeTier(selectedScheme);
		if (tier) {
			form.setValue("commissionType", "percentage");
			form.setValue("commissionValue", tier.commissionPercent);
			const price =
				form.getValues("propertyData.nettPrice") ??
				form.getValues("propertyData.price") ??
				0;
			if (price > 0 && tier.commissionPercent > 0) {
				form.setValue(
					"commissionAmount",
					Math.round(((price * tier.commissionPercent) / 100) * 100) / 100,
				);
			}
		}
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

	const { data: adminAgentsData, isLoading: caseAgentsLoading } =
		trpc.agents.list.useQuery(
			{
				limit: 50,
				searchQuery: caseAgentSearch.trim() || undefined,
				role: "agent",
				isActive: true,
			},
			{
				enabled:
					isAdminPortal &&
					caseAgentPickerOpen &&
					!selectedCaseAgentLabel,
			},
		);

	const adminCaseAgents = adminAgentsData?.agents ?? [];

	const showAgentPicker = coBrokePickerOpen && !selectedCoBrokeLabel;
	const showCaseAgentPicker =
		isAdminPortal && caseAgentPickerOpen && !selectedCaseAgentLabel;
	const isSecondaryDeal = marketType === "secondary";

	const syncToParent = () => {
		const values = form.getValues();
		const isCoBroking = values.representationType === "co_broking";
		const resolvedAgentId =
			values.agentId ??
			(!isAdminPortal ? session?.user?.id : undefined);
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
			commissionAmount: values.commissionAmount,
			agentId: resolvedAgentId,
		});
	};

	const recalcSecondaryCommission = (
		basePrice?: number,
		percent?: number,
	) => {
		const p =
			basePrice ??
			(form.getValues("transactionType") === "sale"
				? (form.getValues("propertyData.nettPrice") ?? 0)
				: (form.getValues("propertyData.price") ?? 0));
		const pct = percent ?? form.getValues("commissionValue") ?? 0;
		const amount = Math.round(((p || 0) * (pct || 0)) / 100 * 100) / 100;
		form.setValue("commissionAmount", amount);
	};

	const handleSubmit = (values: DetailsFormValues) => {
		const isCoBroking = values.representationType === "co_broking";
		const resolvedAgentId =
			values.agentId ??
			(!isAdminPortal ? session?.user?.id : undefined);
		const propertyData =
			values.marketType === "primary"
				? {
						...values.propertyData,
						nettPrice: Math.max(
							0,
							(values.propertyData?.price || 0) -
								(values.propertyData?.rebateAmount ?? 0),
						),
					}
				: values.propertyData;
		onUpdate({
			marketType: values.marketType,
			transactionType:
				values.marketType === "primary" ? "sale" : values.transactionType,
			projectName: values.projectName,
			unitNo: values.unitNo,
			blockListingId: values.blockListingId,
			bookingDate: values.bookingDate,
			transactionDate: values.bookingDate,
			propertyData,
			clientData: values.clientData,
			representationType: values.representationType,
			isCoBroking,
			coBrokingData: isCoBroking ? values.coBrokingData : undefined,
			commissionType: values.commissionType,
			commissionValue: values.commissionValue,
			commissionAmount: values.commissionAmount,
			agentId: resolvedAgentId,
		});
		onNext();
	};

	const selectCoBrokingAgent = (agent: {
		id: string;
		name: string | null;
		nickName?: string | null;
		email: string | null;
		phone: string | null;
		branch: string | null;
		agentCode: string | null;
	}) => {
		const label = formatAgentPickerLabel(agent);
		const coBrokingData = {
			...(form.getValues("coBrokingData") ?? {}),
			internalAgentId: agent.id,
			agentName: agent.name ?? "",
			agentEmail: agent.email ?? "",
			agentPhone: agent.phone ?? "",
			agencyName: agent.branch ?? "Devots",
			contactInfo: [agent.email, agent.phone].filter(Boolean).join(" · "),
			commissionSplit: form.getValues("coBrokingData.commissionSplit") ?? 50,
		};
		form.setValue("coBrokingData", coBrokingData, {
			shouldDirty: true,
			shouldValidate: false,
		});
		form.clearErrors("coBrokingData");
		setAgentSearch("");
		setCoBrokePickerOpen(false);
		setSelectedCoBrokeLabel(label);
		syncToParent();
		toast.success(`Co-broke agent: ${agent.name ?? "Selected"}`);
	};

	const selectCaseAgent = (agent: {
		id: string;
		name: string | null;
		nickName?: string | null;
		agentCode: string | null;
	}) => {
		const label = formatAgentPickerLabel(agent);
		form.setValue("agentId", agent.id, {
			shouldDirty: true,
			shouldValidate: false,
		});
		form.clearErrors("agentId");
		setCaseAgentSearch("");
		setCaseAgentPickerOpen(false);
		setSelectedCaseAgentLabel(label);
		syncToParent();
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
			errors.agentId?.message ??
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
							: isRentalDeal
								? "Secondary market · Rental: enter tenancy details, commission, and parties."
								: "Secondary market · Subsale: enter property, SPA/net prices, commission, and parties."}
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
															} else {
																form.setValue(
																	"propertyData.sstPercent",
																	form.getValues("propertyData.sstPercent") ??
																		8,
																);
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

							{marketType === "secondary" ? (
								<SecondaryDealFields
									form={form}
									control={form.control}
									isSubsale={!isRentalDeal}
									syncToParent={syncToParent}
									recalcSecondaryCommission={recalcSecondaryCommission}
								/>
							) : (
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
														setNettPrice(
															v,
															form.getValues("propertyData.rebateAmount"),
														);
														syncToParent();
													}}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								{schemes.length > 1 ? (
									<FormField
										control={form.control}
										name="propertyData.schemeId"
										render={({ field }) => (
											<FormItem>
												<RequiredLabel>Commission Scheme</RequiredLabel>
												<Select
													value={field.value ?? selectedScheme?.id ?? ""}
													onValueChange={(v) => {
														field.onChange(v);
														syncToParent();
													}}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select scheme" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														{schemes.map((s) => {
															const tier = getActiveSchemeTier(s);
															return (
																<SelectItem key={s.id} value={s.id}>
																	{s.schemeName}
																	{tier
																		? ` · ${tier.commissionPercent}% / override ${tier.overridePercent}%`
																		: ""}
																</SelectItem>
															);
														})}
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>
								) : null}

								{activeSchemeTier ? (
									<>
										<FormItem>
											<FormLabel>Commission Rate (%)</FormLabel>
											<FormControl>
												<Input
													type="number"
													readOnly
													className="bg-muted/50"
													value={activeSchemeTier.commissionPercent}
												/>
											</FormControl>
											<p className="text-muted-foreground text-xs">
												From project scheme — you receive 100% of scheme net
											</p>
										</FormItem>
										<FormItem>
											<FormLabel>Upline Override (%)</FormLabel>
											<FormControl>
												<Input
													type="number"
													readOnly
													className="bg-muted/50"
													value={activeSchemeTier.overridePercent}
												/>
											</FormControl>
											<p className="text-muted-foreground text-xs">
												Paid separately to recruiter upline (not deducted from
												your share).{" "}
												<Link
													href="/admin/commission-schemes"
													className="text-primary underline-offset-4 hover:underline"
												>
													Edit in Primary Commission Setting
												</Link>
											</p>
										</FormItem>
									</>
								) : null}

								<FormField
									control={form.control}
									name="propertyData.salesPackage"
									render={({ field }) => (
										<FormItem>
											<RequiredLabel>Sales Package</RequiredLabel>
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
														setNettPrice(
															form.getValues("propertyData.price"),
															v || 0,
														);
														syncToParent();
													}}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormItem>
									<FormLabel>Net Price (RM)</FormLabel>
									<FormControl>
										<CurrencyInput
											value={netPrice}
											onChange={() => {}}
											disabled
											className="bg-muted/50"
											aria-label="Net price"
										/>
									</FormControl>
									<p className="text-muted-foreground text-xs">
										Auto-calculated: Price − Rebate
									</p>
								</FormItem>

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
							)}
							<Separator />

							<div>
								<div className="mb-4 flex items-center justify-between gap-2">
									<h3 className="font-medium text-lg">
										{isRentalDeal ? "Landlord" : "Purchaser"}
									</h3>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => {
											appendPurchaser(emptyPartyPerson());
											syncToParent();
										}}
									>
										<UserPlus className="mr-1 h-4 w-4" />
										{isRentalDeal ? "Add Landlord" : "Add Purchaser"}
									</Button>
								</div>
								<PartyPersonFields
									control={form.control}
									namePrefix="clientData"
									onBlurSync={syncToParent}
								/>
								{extraPurchaserFields.map((item, index) => (
									<div
										key={item.id}
										className="mt-4 rounded-lg border border-dashed p-4"
									>
										<PartyPersonFields
											control={form.control}
											namePrefix={`clientData.additionalPurchasers.${index}`}
											title={
												isRentalDeal
													? `Landlord ${index + 2}`
													: `Purchaser ${index + 2}`
											}
											onBlurSync={syncToParent}
											onRemove={() => {
												removePurchaser(index);
												syncToParent();
											}}
										/>
									</div>
								))}
							</div>

							<Separator />

							<div>
								<div className="mb-4 flex items-center justify-between gap-2">
									<h3 className="font-medium text-lg">
										{isRentalDeal ? "Tenant" : "Vendor"}
									</h3>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => {
											appendVendor(emptyPartyPerson());
											syncToParent();
										}}
									>
										<UserPlus className="mr-1 h-4 w-4" />
										{isRentalDeal ? "Add Tenant" : "Add Vendor"}
									</Button>
								</div>
								{vendorFields.length === 0 ? (
									<p className="mb-3 text-muted-foreground text-sm">
										{isRentalDeal
											? "No tenants yet. Click Add Tenant to include tenant details."
											: "No vendors yet. Click Add Vendor to include seller / vendor details."}
									</p>
								) : null}
								{vendorFields.map((item, index) => (
									<div
										key={item.id}
										className={
											index > 0
												? "mt-4 rounded-lg border border-dashed p-4"
												: "rounded-lg border p-4"
										}
									>
										<PartyPersonFields
											control={form.control}
											namePrefix={`clientData.vendors.${index}`}
											title={
												vendorFields.length > 1
													? isRentalDeal
														? `Tenant ${index + 1}`
														: `Vendor ${index + 1}`
													: undefined
											}
											onBlurSync={syncToParent}
											onRemove={() => {
												removeVendor(index);
												syncToParent();
											}}
										/>
									</div>
								))}
							</div>

							<Separator />

							<div>
								<h3 className="mb-4 font-medium text-lg">Representation</h3>

								<div className="mb-4 space-y-3 rounded-lg border p-4">
									<p className="font-medium text-sm">Transaction agent</p>
									<p className="text-muted-foreground text-xs">
										{isAdminPortal
											? "Select the agent who owns this case."
											: "You are creating this case under your own agent account."}
									</p>

									{isAdminPortal ? (
										<>
											{selectedCaseAgentLabel ? (
												<div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
													<span>
														<span className="text-muted-foreground">
															Selected:{" "}
														</span>
														{selectedCaseAgentLabel}
													</span>
													<Button
														type="button"
														variant="ghost"
														size="sm"
														onClick={() => {
															form.setValue("agentId", undefined);
															setSelectedCaseAgentLabel(null);
															setCaseAgentSearch("");
															setCaseAgentPickerOpen(true);
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
														placeholder="Search agents by name, email, or code…"
														value={caseAgentSearch}
														onChange={(e) => {
															setCaseAgentSearch(e.target.value);
															setCaseAgentPickerOpen(true);
														}}
														onFocus={() => setCaseAgentPickerOpen(true)}
														onKeyDown={(e) => {
															if (e.key === "Enter") e.preventDefault();
														}}
													/>
												</div>
											)}
											{showCaseAgentPicker && (
												<ul className="max-h-40 space-y-1 overflow-y-auto rounded border p-2">
													{caseAgentsLoading ? (
														<li className="px-2 py-1.5 text-muted-foreground text-sm">
															Loading agents…
														</li>
													) : adminCaseAgents.length === 0 ? (
														<li className="px-2 py-1.5 text-muted-foreground text-sm">
															No agents found
														</li>
													) : (
														adminCaseAgents.map((row) => (
															<li key={row.agent.id}>
																<button
																	type="button"
																	className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
																	onMouseDown={(e) => e.preventDefault()}
																	onClick={(e) => {
																		e.preventDefault();
																		e.stopPropagation();
																		selectCaseAgent({
																			id: row.agent.id,
																			name: row.agent.name,
																			nickName: row.agent.nickName,
																			agentCode: row.agent.agentCode,
																		});
																	}}
																>
																	{formatAgentPickerLabel({
																		name: row.agent.name,
																		nickName: row.agent.nickName,
																		agentCode: row.agent.agentCode,
																		email: row.agent.email,
																	})}
																</button>
															</li>
														))
													)}
												</ul>
											)}
											<FormField
												control={form.control}
												name="agentId"
												render={() => <FormMessage />}
											/>
										</>
									) : (
										<div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
											<span className="text-muted-foreground">Agent: </span>
											<span className="font-medium">{caseAgentLabel}</span>
										</div>
									)}
								</div>

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

								{representationType === "direct" && (
									<div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
										<p className="mb-3 font-medium text-sm">
											Direct representation agent details
										</p>
										<div className="grid gap-3 sm:grid-cols-2">
											<div>
												<p className="text-muted-foreground text-xs">
													Agent name (code)
												</p>
												<p className="font-medium text-sm">{caseAgentLabel}</p>
											</div>
											<div>
												<p className="text-muted-foreground text-xs">
													Commission percentage
												</p>
												<p className="font-medium text-sm">
													{commissionPercentageLabel}
												</p>
											</div>
										</div>
									</div>
								)}

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
																{formatAgentPickerLabel(a)}
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

										{isSecondaryDeal && (
											<div className="space-y-3 border-t pt-4">
												<p className="font-medium text-sm">
													Co-agency (external)
												</p>
												<p className="text-muted-foreground text-xs">
													For subsale and rental deals with an external
													co-agency, enter the agency and agent name below
													instead of selecting an internal agent.
												</p>
												<div className="grid gap-3 sm:grid-cols-2">
													<FormField
														control={form.control}
														name="coBrokingData.agencyName"
														render={({ field }) => (
															<FormItem>
																<FormLabel>Co-agency name</FormLabel>
																<FormControl>
																	<Input
																		{...field}
																		value={field.value ?? ""}
																		onChange={(e) => {
																			field.onChange(e.target.value);
																			if (e.target.value.trim()) {
																				form.setValue(
																					"coBrokingData.internalAgentId",
																					undefined,
																				);
																				setSelectedCoBrokeLabel(null);
																			}
																			syncToParent();
																		}}
																	/>
																</FormControl>
															</FormItem>
														)}
													/>
													<FormField
														control={form.control}
														name="coBrokingData.agentName"
														render={({ field }) => (
															<FormItem>
																<FormLabel>Co-agency agent name</FormLabel>
																<FormControl>
																	<Input
																		{...field}
																		value={field.value ?? ""}
																		onChange={(e) => {
																			field.onChange(e.target.value);
																			if (e.target.value.trim()) {
																				form.setValue(
																					"coBrokingData.internalAgentId",
																					undefined,
																				);
																				setSelectedCoBrokeLabel(null);
																			}
																			syncToParent();
																		}}
																	/>
																</FormControl>
																<FormMessage />
															</FormItem>
														)}
													/>
												</div>
											</div>
										)}
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
