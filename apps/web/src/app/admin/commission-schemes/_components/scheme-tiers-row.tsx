"use client";

export function SchemeTiersRow({
	tiers,
}: {
	tiers: Array<{
		id: string;
		tierName: string;
		commissionPercent: number;
		overridePercent: number;
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
			<table className="min-w-[720px] w-full text-sm">
				<thead className="border-b bg-muted/30 text-muted-foreground text-xs">
					<tr>
						<th className="px-3 py-2 text-left">Tier</th>
						<th className="px-3 py-2 text-left">Commission %</th>
						<th className="px-3 py-2 text-left">Upline override %</th>
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
							<td className="px-3 py-2">{t.overridePercent.toFixed(3)}%</td>
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

