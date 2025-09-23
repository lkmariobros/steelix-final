import { drizzle } from "drizzle-orm/node-postgres";
import * as authSchema from "./schema/auth";
import * as transactionSchema from "./schema/transactions";
import * as approvalsSchema from "./schema/approvals";
import * as reportsSchema from "./schema/reports";

const schema = {
	...authSchema,
	...transactionSchema,
	...approvalsSchema,
	...reportsSchema,
};

export const db = drizzle(process.env.DATABASE_URL || "", { schema });

// Export types for use in other files
export type Database = typeof db;
export type Schema = typeof schema;
