import {
	bigint,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod";

export const portalFolders = pgTable(
	"portal_folders",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		ownerUserId: text("owner_user_id").notNull(),
		parentFolderId: uuid("parent_folder_id"),
		name: text("name").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		ownerIdx: index("idx_portal_folders_owner").on(table.ownerUserId),
		parentIdx: index("idx_portal_folders_parent").on(table.parentFolderId),
	}),
);

export const portalFiles = pgTable(
	"portal_files",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		ownerUserId: text("owner_user_id").notNull(),
		folderId: uuid("folder_id"),
		fileName: text("file_name").notNull(),
		fileType: text("file_type").notNull(),
		fileSize: bigint("file_size", { mode: "number" }).notNull(),
		storagePath: text("storage_path").notNull(),
		uploadedByUserId: text("uploaded_by_user_id").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		deletedAt: timestamp("deleted_at"),
		metadata: jsonb("metadata")
			.$type<{
				originalName?: string;
				uploadStatus?: "pending" | "complete";
				[key: string]: unknown;
			}>()
			.default({}),
	},
	(table) => ({
		ownerIdx: index("idx_portal_files_owner").on(table.ownerUserId),
		folderIdx: index("idx_portal_files_folder").on(table.folderId),
	}),
);

export const portalFileUploadSchema = z.object({
	ownerUserId: z.string().optional(),
	folderId: z.string().uuid().nullable().optional(),
	fileName: z.string().min(1).max(255),
	fileType: z.string(),
	fileSize: z.number().int().positive(),
	base64Data: z.string(),
});
