import {
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Unified portal Record Log — configuration changes + transaction case actions.
 * Retained for 365 days (purged by record-log retention job).
 */
export const portalRecordLog = pgTable(
	"portal_record_log",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** 'configuration' | 'transaction' */
		category: text("category").notNull(),
		/**
		 * configuration: tier_config_create | tier_config_update
		 * transaction: create | save_draft | update | upload_document | submit
		 */
		action: text("action").notNull(),
		summary: text("summary").notNull(),
		actorId: text("actor_id")
			.notNull()
			.references(() => user.id),
		actorRole: text("actor_role"),
		entityType: text("entity_type"),
		entityId: text("entity_id"),
		caseNo: text("case_no"),
		detail: text("detail"),
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => ({
		categoryIdx: index("idx_portal_record_log_category").on(table.category),
		actionIdx: index("idx_portal_record_log_action").on(table.action),
		actorIdx: index("idx_portal_record_log_actor").on(table.actorId),
		entityIdx: index("idx_portal_record_log_entity").on(
			table.entityType,
			table.entityId,
		),
		createdAtIdx: index("idx_portal_record_log_created_at").on(table.createdAt),
	}),
);

export type PortalRecordLog = typeof portalRecordLog.$inferSelect;
export type NewPortalRecordLog = typeof portalRecordLog.$inferInsert;
