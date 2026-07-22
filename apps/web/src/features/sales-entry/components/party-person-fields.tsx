"use client";

import { RequiredLabel } from "@/components/required-label";
import { Button } from "@/components/ui/button";
import {
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
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { genderOptions } from "../transaction-schema";

interface PartyPersonFieldsProps<T extends FieldValues> {
	control: Control<T>;
	/** e.g. "clientData" or "clientData.additionalPurchasers.0" */
	namePrefix: string;
	onBlurSync: () => void;
	title?: string;
	onRemove?: () => void;
	required?: boolean;
}

export function PartyPersonFields<T extends FieldValues>({
	control,
	namePrefix,
	onBlurSync,
	title,
	onRemove,
	required = true,
}: PartyPersonFieldsProps<T>) {
	const path = (key: string) => `${namePrefix}.${key}` as FieldPath<T>;
	const Label = required ? RequiredLabel : FormLabel;

	return (
		<div className="space-y-4">
			{(title || onRemove) && (
				<div className="flex items-center justify-between gap-2">
					{title ? (
						<h4 className="font-medium text-sm">{title}</h4>
					) : (
						<span />
					)}
					{onRemove ? (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="text-destructive"
							onClick={onRemove}
						>
							<Trash2 className="mr-1 h-4 w-4" />
							Remove
						</Button>
					) : null}
				</div>
			)}
			<div className="grid gap-4 md:grid-cols-2">
				<FormField
					control={control}
					name={path("name")}
					render={({ field }) => (
						<FormItem>
							<Label>Name</Label>
							<FormControl>
								<Input {...field} value={field.value ?? ""} onBlur={onBlurSync} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={control}
					name={path("icNo")}
					render={({ field }) => (
						<FormItem>
							<Label>IC / Passport</Label>
							<FormControl>
								<Input {...field} value={field.value ?? ""} onBlur={onBlurSync} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={control}
					name={path("email")}
					render={({ field }) => (
						<FormItem>
							<FormLabel>Email</FormLabel>
							<FormControl>
								<Input
									type="email"
									{...field}
									value={field.value ?? ""}
									onBlur={onBlurSync}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={control}
					name={path("phone")}
					render={({ field }) => (
						<FormItem>
							<Label>Phone</Label>
							<FormControl>
								<Input {...field} value={field.value ?? ""} onBlur={onBlurSync} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={control}
					name={path("address")}
					render={({ field }) => (
						<FormItem className="md:col-span-2">
							<Label>Correspondence Address</Label>
							<FormControl>
								<Textarea
									{...field}
									value={field.value ?? ""}
									rows={2}
									onBlur={onBlurSync}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={control}
					name={path("race")}
					render={({ field }) => (
						<FormItem>
							<FormLabel>Race</FormLabel>
							<FormControl>
								<Input {...field} value={field.value ?? ""} onBlur={onBlurSync} />
							</FormControl>
						</FormItem>
					)}
				/>
				<FormField
					control={control}
					name={path("nationality")}
					render={({ field }) => (
						<FormItem>
							<FormLabel>Nationality</FormLabel>
							<FormControl>
								<Input {...field} value={field.value ?? ""} onBlur={onBlurSync} />
							</FormControl>
						</FormItem>
					)}
				/>
				<FormField
					control={control}
					name={path("gender")}
					render={({ field }) => (
						<FormItem>
							<FormLabel>Gender</FormLabel>
							<Select
								value={field.value ?? ""}
								onValueChange={(v) => {
									field.onChange(v);
									onBlurSync();
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
					control={control}
					name={path("emergencyName")}
					render={({ field }) => (
						<FormItem>
							<FormLabel>Emergency Contact Name</FormLabel>
							<FormControl>
								<Input {...field} value={field.value ?? ""} onBlur={onBlurSync} />
							</FormControl>
						</FormItem>
					)}
				/>
				<FormField
					control={control}
					name={path("emergencyContact")}
					render={({ field }) => (
						<FormItem>
							<FormLabel>Emergency Contact Phone</FormLabel>
							<FormControl>
								<Input {...field} value={field.value ?? ""} onBlur={onBlurSync} />
							</FormControl>
						</FormItem>
					)}
				/>
			</div>
		</div>
	);
}
