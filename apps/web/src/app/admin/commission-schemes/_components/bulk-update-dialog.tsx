"use client";

import { useState } from "react";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { RiLoader4Line } from "@remixicon/react";

export function BulkUpdateDialog({
	ids,
	open,
	onOpenChange,
	onUpdated,
}: {
	ids: string[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onUpdated: () => void;
}) {
	const [setActive, setSetActive] = useState<"__nochange__" | "active" | "inactive">(
		"__nochange__",
	);
	const [setIncSst, setSetIncSst] = useState<"__nochange__" | "yes" | "no">(
		"__nochange__",
	);
	const [sstPercent, setSstPercent] = useState<string>("");
	const [sstBorneBy, setSstBorneBy] = useState<"__nochange__" | "client" | "agent">(
		"__nochange__",
	);

	const mutation = trpc.commissionSchemes.bulkUpdate.useMutation({
		onSuccess: (data) => {
			toast.success(`Updated ${data.updated} scheme(s)`);
			onUpdated();
			onOpenChange(false);
		},
		onError: (e) => toast.error(e.message),
	});

	const handleApply = () => {
		const patch: any = { ids };
		if (setActive !== "__nochange__") patch.setActive = setActive === "active";
		if (setIncSst !== "__nochange__") patch.setIncSst = setIncSst === "yes";
		if (sstPercent.trim() !== "") patch.setSstPercent = Number.parseFloat(sstPercent);
		if (sstBorneBy !== "__nochange__") patch.setSstBorneBy = sstBorneBy;

		if (Object.keys(patch).length <= 1) {
			toast.error("Choose at least one field to update.");
			return;
		}
		mutation.mutate(patch);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Bulk Update Schemes</DialogTitle>
					<DialogDescription>
						Apply a change to <strong>{ids.length}</strong> selected scheme(s).
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-3">
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<p className="text-sm font-medium">Active</p>
							<Select value={setActive} onValueChange={(v) => setSetActive(v as any)}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="__nochange__">No change</SelectItem>
									<SelectItem value="active">Active</SelectItem>
									<SelectItem value="inactive">Inactive</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1.5">
							<p className="text-sm font-medium">Inc SST?</p>
							<Select value={setIncSst} onValueChange={(v) => setSetIncSst(v as any)}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="__nochange__">No change</SelectItem>
									<SelectItem value="yes">Yes</SelectItem>
									<SelectItem value="no">No</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<p className="text-sm font-medium">SST %</p>
							<Input
								value={sstPercent}
								onChange={(e) => setSstPercent(e.target.value)}
								placeholder="Leave blank for no change"
							/>
						</div>
						<div className="space-y-1.5">
							<p className="text-sm font-medium">SST borne by</p>
							<Select
								value={sstBorneBy}
								onValueChange={(v) => setSstBorneBy(v as any)}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="__nochange__">No change</SelectItem>
									<SelectItem value="client">Client</SelectItem>
									<SelectItem value="agent">Agent</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={mutation.isPending}
					>
						Cancel
					</Button>
					<Button onClick={handleApply} disabled={mutation.isPending || ids.length === 0}>
						{mutation.isPending && (
							<RiLoader4Line className="mr-1 size-4 animate-spin" />
						)}
						Apply
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

