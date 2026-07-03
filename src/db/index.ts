import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { env, loadEnv } from "@/lib/env";

loadEnv();

// Single shared pool across hot reloads in dev.
const globalForDb = globalThis as unknown as { _pgPool?: Pool };

const pool =
  globalForDb._pgPool ??
  new Pool({
    connectionString: env.databaseUrl,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") globalForDb._pgPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
