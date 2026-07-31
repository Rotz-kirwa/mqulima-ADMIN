import postgres from "postgres";
import process from "node:process";

let sql: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (!sql) {
    const connectionString = process.env.DATABASE_URL || "postgresql://mqulima:password@localhost:5432/mqulima_dev";

    if (!connectionString) {
      throw new Error("[FATAL] Unable to initialize Admin PostgreSQL pool: DATABASE_URL is missing or unconfigured.");
    }

    const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1") || connectionString.includes("::1");
    sql = postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: isLocal ? false : { rejectUnauthorized: false },
    });
  }
  return sql;
}

export type Sql = ReturnType<typeof postgres>;

