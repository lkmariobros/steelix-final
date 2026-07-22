"use client";

import { CurrencyInput } from "@/components/currency-input";
import { RequiredLabel } from "@/components/required-label";
import {
	FormControl,
	FormField,
	FormItem,
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
import type { Control, UseFormReturn } from "react-hook-form";
import { z } from "zod";

import {
	detailsStepSchema,
	secondaryPropertyTypeOptions,
	sstPayBySubsaleOptions,
	transactionTypeOptions,
} from "../transaction-schema";

type DetailsFormValues = z.infer<typeof detailsStepSchema>;

interface SecondaryDealFieldsProps {
	form: UseFormReturn<DetailsFormValues>;
	control: Control<DetailsFormValues>;
	isSubsale: boolean;
	syncToParent: () => void;
	recalcSecondaryCommission: (basePrice?: number, percent?: number) => void;
}

function DateField({
	control,
	name,
	label,
	syncToParent,
	onChangeExtra,
}: {
	control: Control<DetailsFormValues>;
	name:
		| "propertyData.offerDate"
		| "propertyData.submitDate"
		| "propertyData.rentFrom"
		| "propertyData.rentTo"
		| "bookingDate";
	label: string;
	syncToParent: () => void;
	onChangeExtra?: (iso: string) => void;
}) {
	return (
		<FormField
			control={control}
			name={name}
			render={({ field }) => {
				const value =
					field.value instanceof Date
						? field.value.toISOString().slice(0, 10)
						: ((field.value as string | undefined) ?? "");
				return (
					<FormItem>
						<RequiredLabel>{label}</RequiredLabel>
						<FormControl>
							<Input
								type="date"
								value={value}
								onChange={(e) => {
									const v = e.target.value;
									if (name === "bookingDate") {
										field.onChange(v ? new Date(v) : undefined);
									} else {
										field.onChange(v || undefined);
									}
									onChangeExtra?.(v);
									syncToParent();
								}}
							/>
						</FormControl>
						<FormMessage />
					</FormItem>
				);
			}}
		/>
	);
}

export function SecondaryDealFields({
	form,
	control,
	isSubsale,
	syncToParent,
	recalcSecondaryCommission,
}: SecondaryDealFieldsProps) {
	return (
		<>
			<FormField
				control={control}
				name="transactionType"
				render={({ field }) => (
					<FormItem>
						<RequiredLabel>Transaction Type</RequiredLabel>
						<FormControl>
							<div className="grid gap-3 md:grid-cols-2">
								{transactionTypeOptions.map((opt) => (
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
											const sst = form.getValues("propertyData.sstPayBy");
											if (sst === "landlord") {
												form.setValue("propertyData.sstPayBy", "client");
											}
											form.setValue(
												"propertyData.sstPercent",
												form.getValues("propertyData.sstPercent") ?? 8,
											);
											if (opt.value === "lease") {
												form.setValue("commissionType", "fixed");
											} else {
												form.setValue("commissionType", "percentage");
											}
											syncToParent();
										}}
									>
										<p className="font-medium">{opt.label}</p>
										<p className="mt-1 text-muted-foreground text-sm">
											{opt.value === "sale"
												? "Resale / subsale transaction"
												: "Rental / tenancy transaction"}
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
				<FormField
					control={control}
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

				<FormField
					control={control}
					name="propertyData.propertyType"
					render={({ field }) => (
						<FormItem>
							<RequiredLabel>Property Type</RequiredLabel>
							<Select
								value={field.value || ""}
								onValueChange={(v) => {
									field.onChange(v);
									syncToParent();
								}}
							>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select type" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									{secondaryPropertyTypeOptions.map((o) => (
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

				{isSubsale ? (
					<>
						<DateField
							control={control}
							name="bookingDate"
							label="Booking Date"
							syncToParent={syncToParent}
						/>
						<FormField
							control={control}
							name="propertyData.spaPrice"
							render={({ field }) => (
								<FormItem>
									<RequiredLabel>SPA Price (RM)</RequiredLabel>
									<FormControl>
										<CurrencyInput
											value={field.value ?? 0}
											onChange={(v) => {
												field.onChange(v || undefined);
												form.setValue("propertyData.price", v || 0);
												syncToParent();
											}}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={control}
							name="propertyData.nettPrice"
							render={({ field }) => (
								<FormItem>
									<RequiredLabel>Net Price (RM)</RequiredLabel>
									<FormControl>
										<CurrencyInput
											value={field.value ?? 0}
											onChange={(v) => {
												field.onChange(v || 0);
												recalcSecondaryCommission(v || 0);
												syncToParent();
											}}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={control}
							name="commissionValue"
							render={({ field }) => (
								<FormItem>
									<RequiredLabel>Commission Percent</RequiredLabel>
									<FormControl>
										<Input
											type="number"
											min={0}
											max={100}
											step={0.01}
											value={field.value ?? ""}
											onChange={(e) => {
												const n = Number(e.target.value);
												field.onChange(n);
												recalcSecondaryCommission(undefined, n);
												syncToParent();
											}}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={control}
							name="commissionAmount"
							render={({ field }) => (
								<FormItem>
									<RequiredLabel>Commission Amount (RM)</RequiredLabel>
									<FormControl>
										<CurrencyInput
											value={field.value ?? 0}
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
					</>
				) : (
					<>
						<DateField
							control={control}
							name="propertyData.offerDate"
							label="Offer Date"
							syncToParent={syncToParent}
							onChangeExtra={(iso) => {
								if (iso) form.setValue("bookingDate", new Date(iso));
							}}
						/>
						<DateField
							control={control}
							name="propertyData.submitDate"
							label="Submit Date"
							syncToParent={syncToParent}
						/>
						<DateField
							control={control}
							name="propertyData.rentFrom"
							label="Rent From"
							syncToParent={syncToParent}
						/>
						<DateField
							control={control}
							name="propertyData.rentTo"
							label="Rent To"
							syncToParent={syncToParent}
						/>
						<FormField
							control={control}
							name="propertyData.rentPeriod"
							render={({ field }) => (
								<FormItem>
									<RequiredLabel>Rent Period (Month/Year)</RequiredLabel>
									<FormControl>
										<Input
											{...field}
											value={field.value ?? ""}
											placeholder="e.g. 12 months / 1 year"
											onBlur={() => syncToParent()}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={control}
							name="propertyData.price"
							render={({ field }) => (
								<FormItem>
									<RequiredLabel>Monthly Rental Price (RM)</RequiredLabel>
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
							control={control}
							name="commissionAmount"
							render={({ field }) => (
								<FormItem>
									<RequiredLabel>Case Commission (RM)</RequiredLabel>
									<FormControl>
										<CurrencyInput
											value={field.value ?? 0}
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
					</>
				)}

				<FormField
					control={control}
					name="propertyData.sstPayBy"
					render={({ field }) => (
						<FormItem>
							<RequiredLabel>SST Pay by</RequiredLabel>
							<Select
								value={field.value ?? ""}
								onValueChange={(v) => {
									field.onChange(v as "client" | "agent");
									syncToParent();
								}}
							>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Client or Agent" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									{sstPayBySubsaleOptions.map((o) => (
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

				<FormField
					control={control}
					name="propertyData.sstPercent"
					render={({ field }) => (
						<FormItem>
							<RequiredLabel>SST Percent</RequiredLabel>
							<FormControl>
								<Input
									type="number"
									min={0}
									max={100}
									step={0.01}
									value={field.value ?? 8}
									onChange={(e) => {
										field.onChange(Number(e.target.value));
										syncToParent();
									}}
								/>
							</FormControl>
							<p className="text-muted-foreground text-xs">
								Default 8% — editable
							</p>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={control}
					name="propertyData.earnestDeposit"
					render={({ field }) => (
						<FormItem>
							<RequiredLabel>Earnest Deposit (RM)</RequiredLabel>
							<FormControl>
								<CurrencyInput
									value={field.value ?? 0}
									onChange={(v) => {
										field.onChange(v || 0);
										syncToParent();
									}}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
			</div>
		</>
	);
}
