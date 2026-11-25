import { config } from "dotenv";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

config({ path: ".env.local" });

const connectionString = process.env.MIGRATION_DATABASE_URL;
if (!connectionString) throw new Error("Set MIGRATION_DATABASE_URL to a direct (non-pooled) PostgreSQL connection string.");
const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10000 });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('insight-schema-migrations'))");
    await client.query("CREATE TABLE IF NOT EXISTS insight_schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    const directory = path.join(process.cwd(), "db/migrations");
    const files = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
    for (const name of files) {
      const existing = await client.query("SELECT 1 FROM insight_schema_migrations WHERE name=$1", [name]);
      if (existing.rowCount) { process.stdout.write("Already applied: " + name + "\n"); continue; }
      await client.query("BEGIN");
      try {
        const sql = await readFile(path.join(directory, name), "utf8");
        await client.query(sql);
        await client.query("INSERT INTO insight_schema_migrations(name) VALUES ($1)", [name]);
        await client.query("COMMIT");
        process.stdout.write("Applied: " + name + "\n");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    try { await client.query("SELECT pg_advisory_unlock(hashtext('insight-schema-migrations'))"); }
    finally { client.release(); await pool.end(); }
  }
}

migrate().catch((error: unknown) => {
  process.stderr.write((error instanceof Error ? error.stack : String(error)) + "\n");
  process.exitCode = 1;
});
