import { drizzle } from "drizzle-orm/node-postgres";
import * as authSchema from "./schema/auth";
import * as transactionSchema from "./schema/transactions";

const schema = {
	...authSchema,
	...transactionSchema,
};

export const db = drizzle(process.env.DATABASE_URL || "", { schema });

// Export types for use in other files
export type Database = typeof db;
export type Schema = typeof schema;
