import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

// Sem valor padrao: a senha do banco nunca fica no codigo.
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL nao definido. Configure no .env antes de iniciar o backend.");
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
