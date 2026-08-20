import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import {
	commissionSchemeTiers,
	commissionSchemes,
	sstBorneBySchema,
} from "../models/commission-schemes";
import { listings } from "../models/listings";
import { db } from "../utils/db";

export type CommissionTierResolved = {
	id: string;
	tierName: string;
	commissionPercent: number;
	/** Legacy total / layer-1 fallback when new columns were empty. */
	overridePercent: number;
	immediateUplineOverridePercent: number;
	teamManagerOverridePercent: number;
	groupManagerOverridePercent: number;
	directorOverridePercent: number;
	effectiveFrom: string;
	effectiveTo: string | null;
	isActive: boolean;
};

/** Normalize tier override rates; old rows may only have overridePercent. */
export function resolveOverrideLayerRates(tier: {
	overridePercent?: number | null;
	immediateUplineOverridePercent?: number | null;
	teamManagerOverridePercent?: number | null;
	groupManagerOverridePercent?: number | null;
	directorOverridePercent?: number | null;
}): {
	immediateUplineOverridePercent: number;
	teamManagerOverridePercent: number;
	groupManagerOverridePercent: number;
	directorOverridePercent: number;
	/** Sum of layers (handy for list previews). */
	overridePercent: number;
} {
	const legacy = Number(tier.overridePercent ?? 0);
	const immediate = Number(tier.immediateUplineOverridePercent ?? 0);
	const teamManager = Number(tier.teamManagerOverridePercent ?? 0);
	const groupManager = Number(tier.groupManagerOverridePercent ?? 0);
	const director = Number(tier.directorOverridePercent ?? 0);
	const hasNew =
		immediate > 0 || teamManager > 0 || groupManager > 0 || director > 0;
	const immediateResolved = hasNew ? immediate : legacy;
	const rates = {
		immediateUplineOverridePercent: immediateResolved,
		teamManagerOverridePercent: teamManager,
		groupManagerOverridePercent: groupManager,
		directorOverridePercent: director,
	};
	return {
		...rates,
		overridePercent:
			rates.immediateUplineOverridePercent +
			rates.teamManagerOverridePercent +
			rates.groupManagerOverridePercent +
			rates.directorOverridePercent,
	};
}

function mapTierRow(t: typeof commissionSchemeTiers.$inferSelect): CommissionTierResolved {
	const rates = resolveOverrideLayerRates({
		overridePercent: Number(t.overridePercent),
		immediateUplineOverridePercent: Number(t.immediateUplineOverridePercent),
		teamManagerOverridePercent: Number(t.teamManagerOverridePercent),
		groupManagerOverridePercent: Number(t.groupManagerOverridePercent),
		directorOverridePercent: Number(t.directorOverridePercent),
	});
	return {
		id: t.id,
		tierName: t.tierName,
		commissionPercent: Number(t.commissionPercent),
		...rates,
		effectiveFrom: String(t.effectiveFrom),
		effectiveTo: t.effectiveTo ? String(t.effectiveTo) : null,
		isActive: t.isActive,
	};
}

export type CommissionSchemeResolved = {
	id: string;
	schemeName: string;
	shortform: string;
	description: string;
	projectName: string;
	blockListingId: string | null;
	blockListingTitle: string | null;
	blockType: string | null;
	incSst: boolean;
	sstPercent: number;
	sstBorneBy: "client" | "agent";
	isActive: boolean;
	updatedAt: Date;
	tiers: CommissionTierResolved[];
};

function toPgDate(d: Date) {
	// drizzle `date()` expects YYYY-MM-DD (string)
	return d.toISOString().slice(0, 10);
}

function tierInsertValues(
	schemeId: string,
	t: {
		tierName: string;
		commissionPercent: number;
		overridePercent?: number;
		immediateUplineOverridePercent?: number;
		teamManagerOverridePercent?: number;
		groupManagerOverridePercent?: number;
		directorOverridePercent?: number;
		effectiveFrom: Date | string;
		effectiveTo?: Date | string | null;
		isActive: boolean;
	},
) {
	const rates = resolveOverrideLayerRates(t);
	const from =
		typeof t.effectiveFrom === "string"
			? t.effectiveFrom.slice(0, 10)
			: toPgDate(t.effectiveFrom);
	const to = t.effectiveTo
		? typeof t.effectiveTo === "string"
			? String(t.effectiveTo).slice(0, 10)
			: toPgDate(t.effectiveTo)
		: null;
	return {
		schemeId,
		tierName: t.tierName,
		commissionPercent: String(t.commissionPercent),
		// Keep legacy column in sync with layer 1 for older readers.
		overridePercent: String(rates.immediateUplineOverridePercent),
		immediateUplineOverridePercent: String(
			rates.immediateUplineOverridePercent,
		),
		teamManagerOverridePercent: String(rates.teamManagerOverridePercent),
		groupManagerOverridePercent: String(rates.groupManagerOverridePercent),
		directorOverridePercent: String(rates.directorOverridePercent),
		effectiveFrom: from,
		effectiveTo: to,
		isActive: t.isActive,
	};
}

export type CommissionSchemeTierWrite = {
	tierName: string;
	commissionPercent: number;
	overridePercent?: number;
	immediateUplineOverridePercent?: number;
	teamManagerOverridePercent?: number;
	groupManagerOverridePercent?: number;
	directorOverridePercent?: number;
	effectiveFrom: Date;
	effectiveTo?: Date | null;
	isActive: boolean;
	id?: string;
};

export async function listCommissionSchemesAdmin(opts: {
	search?: string;
	projectName?: string;
	blockListingId?: string;
	includeInactive?: boolean;
	limit?: number;
	offset?: number;
}) {
	const {
		search,
		projectName,
		blockListingId,
		includeInactive = false,
		limit = 50,
		offset = 0,
	} = opts;

	const conditions = [];
	if (!includeInactive) conditions.push(eq(commissionSchemes.isActive, true));
	if (projectName) conditions.push(eq(commissionSchemes.projectName, projectName));
	if (blockListingId)
		conditions.push(eq(commissionSchemes.blockListingId, blockListingId));
	if (search) {
		conditions.push(
			or(
				ilike(commissionSchemes.schemeName, `%${search}%`),
				ilike(commissionSchemes.projectName, `%${search}%`),
				ilike(commissionSchemes.shortform, `%${search}%`),
			),
		);
	}

	const where = conditions.length ? and(...conditions) : undefined;

	const rows = await db
		.select({
			scheme: commissionSchemes,
			blockTitle: listings.title,
		})
		.from(commissionSchemes)
		.leftJoin(listings, eq(commissionSchemes.blockListingId, listings.id))
		.where(where)
		.orderBy(desc(commissionSchemes.updatedAt))
		.limit(limit)
		.offset(offset);

	const schemeIds = rows.map((r) => r.scheme.id);
	const tiers =
		schemeIds.length === 0
			? []
			: await db
					.select()
					.from(commissionSchemeTiers)
					.where(
						schemeIds.length === 1
							? eq(commissionSchemeTiers.schemeId, schemeIds[0])
							: sql`${commissionSchemeTiers.schemeId} = ANY(ARRAY[${sql.join(
									schemeIds.map((id) => sql`${id}::uuid`),
									sql`, `,
								)}])`,
					)
					.orderBy(
						asc(commissionSchemeTiers.effectiveFrom),
						asc(commissionSchemeTiers.tierName),
					);

	const tiersByScheme: Record<string, CommissionTierResolved[]> = {};
	for (const t of tiers) {
		tiersByScheme[t.schemeId] ??= [];
		tiersByScheme[t.schemeId].push(mapTierRow(t));
	}

	const schemes: CommissionSchemeResolved[] = rows.map((r) => ({
		id: r.scheme.id,
		schemeName: r.scheme.schemeName,
		shortform: r.scheme.shortform,
		description: r.scheme.description,
		projectName: r.scheme.projectName,
		blockListingId: r.scheme.blockListingId ?? null,
		blockListingTitle: r.blockTitle ?? null,
		blockType: r.scheme.blockType ?? null,
		incSst: r.scheme.incSst,
		sstPercent: Number(r.scheme.sstPercent),
		sstBorneBy: sstBorneBySchema.parse(r.scheme.sstBorneBy),
		isActive: r.scheme.isActive,
		updatedAt: r.scheme.updatedAt,
		tiers: tiersByScheme[r.scheme.id] ?? [],
	}));

	return { schemes };
}

export async function getCommissionSchemeAdmin(id: string) {
	const [row] = await db
		.select({
			scheme: commissionSchemes,
			blockTitle: listings.title,
		})
		.from(commissionSchemes)
		.leftJoin(listings, eq(commissionSchemes.blockListingId, listings.id))
		.where(eq(commissionSchemes.id, id))
		.limit(1);
	if (!row) return null;

	const tiers = await db
		.select()
		.from(commissionSchemeTiers)
		.where(eq(commissionSchemeTiers.schemeId, id))
		.orderBy(asc(commissionSchemeTiers.effectiveFrom));

	return {
		...row.scheme,
		blockListingTitle: row.blockTitle ?? null,
		tiers: tiers.map((t) => mapTierRow(t)),
	};
}

export async function createCommissionSchemeAdmin(input: {
	schemeName: string;
	shortform: string;
	description: string;
	projectName: string;
	blockListingId?: string | null;
	blockType?: string | null;
	isActive: boolean;
	incSst: boolean;
	sstPercent: number;
	sstBorneBy: "client" | "agent";
	tiers: CommissionSchemeTierWrite[];
	actorId: string;
}) {
	const [created] = await db
		.insert(commissionSchemes)
		.values({
			schemeName: input.schemeName,
			shortform: input.shortform,
			description: input.description,
			projectName: input.projectName,
			blockListingId: input.blockListingId ?? null,
			blockType: input.blockType ?? null,
			isActive: input.isActive,
			incSst: input.incSst,
			sstPercent: String(input.sstPercent),
			sstBorneBy: input.sstBorneBy,
			createdBy: input.actorId,
			updatedBy: input.actorId,
		})
		.returning();

	await db
		.insert(commissionSchemeTiers)
		.values(input.tiers.map((t) => tierInsertValues(created.id, t)));

	return created;
}

export async function updateCommissionSchemeAdmin(input: {
	id: string;
	patch: Partial<{
		schemeName: string;
		shortform: string;
		description: string;
		projectName: string;
		blockListingId: string | null;
		blockType: string | null;
		isActive: boolean;
		incSst: boolean;
		sstPercent: number;
		sstBorneBy: "client" | "agent";
	}>;
	tiers?: CommissionSchemeTierWrite[];
	actorId: string;
}) {
	const [updated] = await db
		.update(commissionSchemes)
		.set({
			...("schemeName" in input.patch ? { schemeName: input.patch.schemeName } : {}),
			...("shortform" in input.patch ? { shortform: input.patch.shortform } : {}),
			...("description" in input.patch ? { description: input.patch.description } : {}),
			...("projectName" in input.patch ? { projectName: input.patch.projectName } : {}),
			...("blockListingId" in input.patch
				? { blockListingId: input.patch.blockListingId }
				: {}),
			...("blockType" in input.patch ? { blockType: input.patch.blockType } : {}),
			...("isActive" in input.patch ? { isActive: input.patch.isActive } : {}),
			...("incSst" in input.patch ? { incSst: input.patch.incSst } : {}),
			...("sstPercent" in input.patch
				? { sstPercent: String(input.patch.sstPercent) }
				: {}),
			...("sstBorneBy" in input.patch ? { sstBorneBy: input.patch.sstBorneBy } : {}),
			updatedBy: input.actorId,
			updatedAt: new Date(),
		})
		.where(eq(commissionSchemes.id, input.id))
		.returning();

	if (!updated) throw new Error("Scheme not found");

	if (input.tiers) {
		await db
			.delete(commissionSchemeTiers)
			.where(eq(commissionSchemeTiers.schemeId, input.id));
		await db
			.insert(commissionSchemeTiers)
			.values(input.tiers.map((t) => tierInsertValues(input.id, t)));
	}

	return updated;
}

export async function duplicateCommissionSchemeAdmin(opts: {
	id: string;
	actorId: string;
}) {
	const existing = await getCommissionSchemeAdmin(opts.id);
	if (!existing) throw new Error("Scheme not found");

	const [dup] = await db
		.insert(commissionSchemes)
		.values({
			schemeName: `${existing.schemeName} (Copy)`,
			shortform: `${existing.shortform}-COPY`,
			description: existing.description,
			projectName: existing.projectName,
			blockListingId: existing.blockListingId ?? null,
			blockType: existing.blockType ?? null,
			isActive: false,
			incSst: existing.incSst,
			sstPercent: String(existing.sstPercent),
			sstBorneBy: existing.sstBorneBy,
			createdBy: opts.actorId,
			updatedBy: opts.actorId,
		})
		.returning();

	await db.insert(commissionSchemeTiers).values(
		existing.tiers.map((t) =>
			tierInsertValues(dup.id, {
				tierName: t.tierName,
				commissionPercent: Number(t.commissionPercent),
				overridePercent: Number(t.overridePercent ?? 0),
				immediateUplineOverridePercent: Number(
					t.immediateUplineOverridePercent ?? 0,
				),
				teamManagerOverridePercent: Number(t.teamManagerOverridePercent ?? 0),
				groupManagerOverridePercent: Number(
					t.groupManagerOverridePercent ?? 0,
				),
				directorOverridePercent: Number(t.directorOverridePercent ?? 0),
				effectiveFrom: t.effectiveFrom,
				effectiveTo: t.effectiveTo ?? null,
				isActive: t.isActive ?? true,
			}),
		),
	);

	return dup;
}

export async function deleteCommissionSchemeAdmin(id: string) {
	await db.delete(commissionSchemes).where(eq(commissionSchemes.id, id));
	return { success: true as const };
}

export async function bulkUpdateCommissionSchemesAdmin(input: {
	ids: string[];
	setActive?: boolean;
	setSstPercent?: number;
	setIncSst?: boolean;
	setSstBorneBy?: "client" | "agent";
	actorId: string;
}) {
	if (
		input.setActive === undefined &&
		input.setSstPercent === undefined &&
		input.setIncSst === undefined &&
		input.setSstBorneBy === undefined
	) {
		return { success: true as const, updated: 0 };
	}

	await db
		.update(commissionSchemes)
		.set({
			...(input.setActive !== undefined ? { isActive: input.setActive } : {}),
			...(input.setSstPercent !== undefined
				? { sstPercent: String(input.setSstPercent) }
				: {}),
			...(input.setIncSst !== undefined ? { incSst: input.setIncSst } : {}),
			...(input.setSstBorneBy !== undefined
				? { sstBorneBy: input.setSstBorneBy }
				: {}),
			updatedBy: input.actorId,
			updatedAt: new Date(),
		})
		.where(
			sql`${commissionSchemes.id} = ANY(ARRAY[${sql.join(
				input.ids.map((id) => sql`${id}::uuid`),
				sql`, `,
			)}])`,
		);

	return { success: true as const, updated: input.ids.length };
}

export async function listProjectNamesForSchemesAdmin() {
	const rows = await db
		.selectDistinct({ projectName: commissionSchemes.projectName })
		.from(commissionSchemes)
		.where(eq(commissionSchemes.isActive, true))
		.orderBy(asc(commissionSchemes.projectName));
	return rows.map((r) => r.projectName).filter(Boolean);
}

export async function listBlockListingsForSchemesAdmin() {
	// only active listings; used by scheme form as "block" lookup
	const rows = await db
		.select({ id: listings.id, title: listings.title })
		.from(listings)
		.orderBy(asc(listings.title))
		.limit(500);
	return rows;
}

export function resolveActiveTierForDate(
	tiers: CommissionTierResolved[],
	at: Date,
): CommissionTierResolved | null {
	const d = at.toISOString().slice(0, 10);
	const active = tiers.filter((t) => t.isActive);
	// pick the tier whose range contains the date; prefer latest effectiveFrom
	const candidates = active.filter((t) => {
		if (t.effectiveFrom > d) return false;
		if (t.effectiveTo && t.effectiveTo < d) return false;
		return true;
	});
	candidates.sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));
	return candidates[0] ?? null;
}

export async function resolveSchemeForBlockAtDate(opts: {
	blockListingId: string;
	at: Date;
}) {
	const { schemes } = await listCommissionSchemesAdmin({
		blockListingId: opts.blockListingId,
		includeInactive: false,
		limit: 50,
		offset: 0,
	});

	// Pick first scheme with an active tier for that date (preferring most recently updated schemes)
	for (const s of schemes) {
		const tier = resolveActiveTierForDate(s.tiers, opts.at);
		if (tier) return { scheme: s, tier };
	}
	return null;
}

export function calculateSchemeCommission(opts: {
	nettPrice: number;
	commissionPercent: number;
	incSst: boolean;
	sstPercent: number;
	sstBorneBy: "client" | "agent";
}) {
	const base = (opts.nettPrice * opts.commissionPercent) / 100;
	const sstRate = opts.sstPercent / 100;

	if (!opts.incSst) {
		const sstAmount = base * sstRate;
		if (opts.sstBorneBy === "client") {
			return {
				baseCommission: base,
				grossCommission: base + sstAmount,
				sstAmount,
				agentNetCommission: base,
			};
		}
		// agent bears SST: agent receives base - sst, total stays base
		return {
			baseCommission: base,
			grossCommission: base,
			sstAmount,
			agentNetCommission: base - sstAmount,
		};
	}

	// Inc SST: base already includes SST; compute SST portion
	const sstAmount = base * (sstRate / (1 + sstRate));
	return {
		baseCommission: base,
		grossCommission: base,
		sstAmount,
		agentNetCommission: base - sstAmount,
	};
}

