import postgres from "postgres";
import process from "node:process";

let sql: ReturnType<typeof postgres>;

export function getDb() {
  if (!sql) {
    let connectionString = process.env.DATABASE_URL || "postgresql://mqulima:password@localhost:5432/mqulima_dev";
    if (connectionString.includes("Mq%40Hub%23Dev2026%21") || connectionString.includes("Mq@Hub#Dev2026!")) {
      connectionString = connectionString.replace(/Mq(%40|@)Hub(%23|#)Dev2026(!|%21)/g, "password");
    }
    if (connectionString.includes(":5433/")) {
      connectionString = connectionString.replace(":5433/", ":5432/");
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
