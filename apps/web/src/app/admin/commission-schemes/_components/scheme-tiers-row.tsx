"use client";

function formatOverrideLayers(t: {
	overridePercent?: number;
	immediateUplineOverridePercent?: number;
	teamManagerOverridePercent?: number;
	groupManagerOverridePercent?: number;
	directorOverridePercent?: number;
}) {
	const legacy = Number(t.overridePercent ?? 0);
	const immediate = Number(t.immediateUplineOverridePercent ?? 0);
	const team = Number(t.teamManagerOverridePercent ?? 0);
	const group = Number(t.groupManagerOverridePercent ?? 0);
	const director = Number(t.directorOverridePercent ?? 0);
	const hasNew = immediate > 0 || team > 0 || group > 0 || director > 0;
	const layers = [
		{ label: "IU", pct: hasNew ? immediate : legacy },
		{ label: "TM", pct: team },
		{ label: "GM", pct: group },
		{ label: "Dir", pct: director },
	].filter((l) => l.pct > 0);
	if (layers.length === 0) return "0%";
	return layers.map((l) => `${l.label} ${l.pct.toFixed(2)}%`).join(" · ");
}

export function SchemeTiersRow({
	tiers,
}: {
	tiers: Array<{
		id: string;
		tierName: string;
		commissionPercent: number;
		overridePercent?: number;
		immediateUplineOverridePercent?: number;
		teamManagerOverridePercent?: number;
		groupManagerOverridePercent?: number;
		directorOverridePercent?: number;
		effectiveFrom: string;
		effectiveTo: string | null;
		isActive: boolean;
	}>;
}) {
	if (!tiers || tiers.length === 0) {
		return <div className="text-muted-foreground text-sm">No tiers.</div>;
	}

	return (
		<div className="overflow-x-auto rounded-md border">
			<table className="min-w-[860px] w-full text-sm">
				<thead className="border-b bg-muted/30 text-muted-foreground text-xs">
					<tr>
						<th className="px-3 py-2 text-left">Tier</th>
						<th className="px-3 py-2 text-left">Commission %</th>
						<th className="px-3 py-2 text-left">Override layers %</th>
						<th className="px-3 py-2 text-left">Effective From</th>
						<th className="px-3 py-2 text-left">Effective To</th>
						<th className="px-3 py-2 text-left">Active</th>
					</tr>
				</thead>
				<tbody>
					{tiers.map((t) => (
						<tr key={t.id} className="border-b last:border-b-0">
							<td className="px-3 py-2 font-medium">{t.tierName}</td>
							<td className="px-3 py-2">{t.commissionPercent.toFixed(3)}%</td>
							<td className="px-3 py-2 text-xs">{formatOverrideLayers(t)}</td>
							<td className="px-3 py-2">{t.effectiveFrom}</td>
							<td className="px-3 py-2">{t.effectiveTo ?? "—"}</td>
							<td className="px-3 py-2">{t.isActive ? "Yes" : "No"}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
