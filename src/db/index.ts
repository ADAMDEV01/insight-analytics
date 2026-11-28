import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { enforceVerifyFullSslMode } from "./connection-string";

const globalForDatabase = globalThis as unknown as { insightPool?: Pool };
export const pool = globalForDatabase.insightPool ?? new Pool({
  connectionString: enforceVerifyFullSslMode(process.env.DATABASE_URL),
  max: process.env.NODE_ENV === "production" ? 5 : 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: process.env.NODE_ENV !== "production",
});
if (process.env.NODE_ENV !== "production") globalForDatabase.insightPool = pool;
export const db = drizzle(pool, { schema });
