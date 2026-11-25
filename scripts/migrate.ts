import { readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

const connectionString = process.env.MIGRATION_DATABASE_URL;
if (!connectionString) throw new Error("Set MIGRATION_DATABASE_URL to a direct (non-pooled) PostgreSQL connection string.");
const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10000 });
const migrationName = "0001_initial";

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("CREATE TABLE IF NOT EXISTS insight_schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    const existing = await client.query("SELECT name FROM insight_schema_migrations WHERE name=$1", [migrationName]);
    if (existing.rowCount) {
      await client.query("COMMIT");
      process.stdout.write("Migration already applied: " + migrationName + "\\n");
      return;
    }
    const sql = await readFile(path.join(process.cwd(), "db/migrations/0001_initial.sql"), "utf8");
    await client.query(sql);
    await client.query("INSERT INTO insight_schema_migrations(name) VALUES ($1)", [migrationName]);
    await client.query("COMMIT");
    process.stdout.write("Applied migration: " + migrationName + "\\n");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error: unknown) => { process.stderr.write((error instanceof Error ? error.stack : String(error)) + "\\n"); process.exitCode = 1; });
