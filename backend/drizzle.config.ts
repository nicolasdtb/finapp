import type { Config } from "drizzle-kit";
import "dotenv/config";

export default {
  schema: "./src/database/schema.ts",
  out: "./drizzle",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || "postgresql://finapp_user:finapp_password@localhost:5432/finapp",
  },
} satisfies Config;
