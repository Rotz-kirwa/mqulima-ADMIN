import postgres from "postgres";
import process from "node:process";

let sql: ReturnType<typeof postgres> | null = null;
let schemaPatched = false;

async function autoPatchSchema(sqlInstance: ReturnType<typeof postgres>) {
  if (schemaPatched) return;
  schemaPatched = true;
  try {
    await sqlInstance`
      ALTER TABLE profiles 
        ADD COLUMN IF NOT EXISTS bio TEXT,
        ADD COLUMN IF NOT EXISTS website TEXT,
        ADD COLUMN IF NOT EXISTS cover_image TEXT,
        ADD COLUMN IF NOT EXISTS farming_activities TEXT,
        ADD COLUMN IF NOT EXISTS farming_photos TEXT[] DEFAULT '{}';
    `;
  } catch (err) {
    console.warn("[WARN] Admin Auto-patch schema notice:", err);
  }
}

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

    autoPatchSchema(sql).catch(() => {});
  }
  return sql;
}

export type Sql = ReturnType<typeof postgres>;
