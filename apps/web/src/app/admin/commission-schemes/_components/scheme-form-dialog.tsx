"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { RiAddLine, RiDeleteBinLine, RiLoader4Line } from "@remixicon/react";

type TierDraft = {
	tierName: string;
	commissionPercent: string;
	overridePercent: string;
	effectiveFrom: string;
	effectiveTo: string;
	isActive: boolean;
};

const emptyTier = (): TierDraft => ({
	tierName: "Standard",
	commissionPercent: "2.50",
	overridePercent: "0",
	effectiveFrom: new Date().toISOString().slice(0, 10),
	effectiveTo: "",
	isActive: true,
});

export function SchemeFormDialog({
	open,
	onOpenChange,
	mode,
	schemeId,
	onSaved,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode: "create" | "edit";
	schemeId: string | null;
	onSaved: () => void;
}) {
	const isEdit = mode === "edit";

	const { data: blocks } = trpc.commissionSchemes.listBlocks.useQuery(undefined, {
		enabled: open,
		staleTime: 60_000,
	});

	const { data: existing } = trpc.commissionSchemes.get.useQuery(
		{ id: schemeId ?? "" },
		{ enabled: open && isEdit && !!schemeId, staleTime: 0 },
	);

	const blockOptions = useMemo(
		() => (blocks ?? []).map((b) => ({ id: b.id, title: b.title })),
		[blocks],
	);

	const [form, setForm] = useState({
		schemeName: "",
		shortform: "",
		description: "",
		projectName: "",
		blockListingId: "__none__",
		isActive: true,
		incSst: false,
		sstPercent: "8.00",
		sstBorneBy: "client" as "client" | "agent",
	});

	const [tiers, setTiers] = useState<TierDraft[]>([emptyTier()]);

	useEffect(() => {
		if (!open) return;
		if (!existing) return;
		setForm({
			schemeName: existing.schemeName ?? "",
			shortform: existing.shortform ?? "",
			description: existing.description ?? "",
			projectName: existing.projectName ?? "",
			blockListingId: existing.blockListingId ?? "__none__",
			isActive: existing.isActive ?? true,
			incSst: existing.incSst ?? false,
			sstPercent: String(existing.sstPercent ?? "8.00"),
			sstBorneBy: (existing.sstBorneBy as "client" | "agent") ?? "client",
		});
		const t = (existing.tiers ?? []).map((x: any) => ({
			tierName: x.tierName ?? "",
			commissionPercent: String(x.commissionPercent ?? "0"),
			overridePercent: String(x.overridePercent ?? "0"),
			effectiveFrom: String(x.effectiveFrom ?? "").slice(0, 10),
			effectiveTo: x.effectiveTo ? String(x.effectiveTo).slice(0, 10) : "",
			isActive: Boolean(x.isActive ?? true),
		}));
		setTiers(t.length ? t : [emptyTier()]);
	}, [open, existing]);

	const createMutation = trpc.commissionSchemes.create.useMutation({
		onSuccess: () => {
			toast.success("Scheme created");
			onSaved();
			onOpenChange(false);
		},
		onError: (e) => toast.error(e.message),
	});

	const updateMutation = trpc.commissionSchemes.update.useMutation({
		onSuccess: () => {
			toast.success("Scheme updated");
			onSaved();
			onOpenChange(false);
		},
		onError: (e) => toast.error(e.message),
	});

	const isSaving = createMutation.isPending || updateMutation.isPending;

	const toPayload = () => ({
		schemeName: form.schemeName.trim(),
		shortform: form.shortform.trim(),
		description: form.description.trim(),
		projectName: form.projectName.trim(),
		blockListingId: form.blockListingId === "__none__" ? null : form.blockListingId,
		isActive: form.isActive,
		incSst: form.incSst,
		sstPercent: Number.parseFloat(form.sstPercent || "0"),
		sstBorneBy: form.sstBorneBy,
		tiers: tiers.map((t) => ({
			tierName: t.tierName.trim(),
			commissionPercent: Number.parseFloat(t.commissionPercent || "0"),
			overridePercent: Number.parseFloat(t.overridePercent || "0"),
			effectiveFrom: new Date(t.effectiveFrom),
			effectiveTo: t.effectiveTo ? new Date(t.effectiveTo) : null,
			isActive: t.isActive,
		})),
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
				<DialogHeader className="border-b px-6 py-4 text-left">
					<DialogTitle>{isEdit ? "Edit scheme" : "New scheme"}</DialogTitle>
					<DialogDescription>
						Schemes are linked to a block/listing and contain one or more effective
						tiers.
					</DialogDescription>
				</DialogHeader>

				<div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-1.5">
							<Label>Scheme Name *</Label>
							<Input
								value={form.schemeName}
								onChange={(e) => setForm((p) => ({ ...p, schemeName: e.target.value }))}
								placeholder='e.g. "Breeze Hill Standard"'
							/>
						</div>
						<div className="space-y-1.5">
							<Label>Shortform *</Label>
							<Input
								value={form.shortform}
								onChange={(e) => setForm((p) => ({ ...p, shortform: e.target.value }))}
								placeholder="e.g. BH-2.5"
							/>
						</div>
						<div className="space-y-1.5">
							<Label>Description *</Label>
							<Input
								value={form.description}
								onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
								placeholder="e.g. 2.5%"
							/>
						</div>
						<div className="space-y-1.5">
							<Label>Project *</Label>
							<Input
								value={form.projectName}
								onChange={(e) => setForm((p) => ({ ...p, projectName: e.target.value }))}
								placeholder="e.g. Breeze Hill"
							/>
						</div>
						<div className="col-span-2 space-y-1.5">
							<Label>Block (listing)</Label>
							<Select
								value={form.blockListingId}
								onValueChange={(v) => setForm((p) => ({ ...p, blockListingId: v }))}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select block/listing (optional)" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="__none__">None</SelectItem>
									{blockOptions.map((b) => (
										<SelectItem key={b.id} value={b.id}>
											{b.title}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-1.5">
							<Label>Inc SST? *</Label>
							<Select
								value={form.incSst ? "yes" : "no"}
								onValueChange={(v) => setForm((p) => ({ ...p, incSst: v === "yes" }))}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="yes">Yes</SelectItem>
									<SelectItem value="no">No</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1.5">
							<Label>SST % *</Label>
							<Input
								value={form.sstPercent}
								onChange={(e) => setForm((p) => ({ ...p, sstPercent: e.target.value }))}
								placeholder="8.00"
							/>
						</div>
						<div className="space-y-1.5">
							<Label>SST borne by *</Label>
							<Select
								value={form.sstBorneBy}
								onValueChange={(v) =>
									setForm((p) => ({ ...p, sstBorneBy: v as "client" | "agent" }))
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="client">Client</SelectItem>
									<SelectItem value="agent">Agent</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1.5">
							<Label>Status</Label>
							<Select
								value={form.isActive ? "active" : "inactive"}
								onValueChange={(v) => setForm((p) => ({ ...p, isActive: v === "active" }))}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="active">Active</SelectItem>
									<SelectItem value="inactive">Inactive</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="mt-6 flex items-center justify-between">
						<div>
							<p className="font-medium text-sm">Commission rate tiers</p>
							<p className="text-muted-foreground text-xs">
								Scheme must have at least one active tier to be usable.
							</p>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-8"
							onClick={() => setTiers((p) => [...p, emptyTier()])}
						>
							<RiAddLine className="mr-1 size-4" />
							Add tier
						</Button>
					</div>

					<div className="mt-3 space-y-3">
						{tiers.map((t, idx) => (
							<div key={idx} className="rounded-md border p-3">
								<div className="flex items-center justify-between">
									<p className="font-medium text-sm">Tier {idx + 1}</p>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="h-7 px-2 text-destructive"
										disabled={tiers.length <= 1}
										onClick={() => setTiers((p) => p.filter((_, i) => i !== idx))}
									>
										<RiDeleteBinLine className="mr-1 size-4" />
										Remove
									</Button>
								</div>
								<div className="mt-3 grid grid-cols-2 gap-3">
									<div className="space-y-1.5">
										<Label>Tier name</Label>
										<Input
											value={t.tierName}
											onChange={(e) =>
												setTiers((p) =>
													p.map((x, i) =>
														i === idx ? { ...x, tierName: e.target.value } : x,
													),
												)
											}
										/>
									</div>
									<div className="space-y-1.5">
										<Label>Commission %</Label>
										<Input
											value={t.commissionPercent}
											onChange={(e) =>
												setTiers((p) =>
													p.map((x, i) =>
														i === idx
															? { ...x, commissionPercent: e.target.value }
															: x,
													),
												)
											}
										/>
									</div>
									<div className="space-y-1.5">
										<Label>Override %</Label>
										<Input
											value={t.overridePercent}
											onChange={(e) =>
												setTiers((p) =>
													p.map((x, i) =>
														i === idx ? { ...x, overridePercent: e.target.value } : x,
													),
												)
											}
										/>
									</div>
									<div className="space-y-1.5">
										<Label>Effective from</Label>
										<Input
											type="date"
											value={t.effectiveFrom}
											onChange={(e) =>
												setTiers((p) =>
													p.map((x, i) =>
														i === idx ? { ...x, effectiveFrom: e.target.value } : x,
													),
												)
											}
										/>
									</div>
									<div className="space-y-1.5">
										<Label>Effective to</Label>
										<Input
											type="date"
											value={t.effectiveTo}
											onChange={(e) =>
												setTiers((p) =>
													p.map((x, i) =>
														i === idx ? { ...x, effectiveTo: e.target.value } : x,
													),
												)
											}
										/>
									</div>
									<div className="space-y-1.5">
										<Label>Active</Label>
										<Select
											value={t.isActive ? "yes" : "no"}
											onValueChange={(v) =>
												setTiers((p) =>
													p.map((x, i) =>
														i === idx ? { ...x, isActive: v === "yes" } : x,
													),
												)
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="yes">Yes</SelectItem>
												<SelectItem value="no">No</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>
							</div>
						))}
					</div>
				</div>

				<DialogFooter className="sticky bottom-0 gap-2 border-t bg-background/95 px-6 py-4 backdrop-blur sm:justify-end">
					<Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isSaving}>
						Cancel
					</Button>
					<Button
						type="button"
						size="sm"
						disabled={isSaving || !form.schemeName.trim() || !form.shortform.trim() || !form.projectName.trim()}
						onClick={() => {
							const payload = toPayload();
							if (payload.tiers.length === 0 || payload.tiers.every((t) => !t.isActive)) {
								toast.error("Add at least one active tier.");
								return;
							}
							if (isEdit && schemeId) {
								updateMutation.mutate({ id: schemeId, ...payload });
							} else {
								createMutation.mutate(payload);
							}
						}}
					>
						{isSaving ? (
							<>
								<RiLoader4Line className="mr-1.5 size-4 animate-spin" />
								Saving…
							</>
						) : (
							"Save"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

