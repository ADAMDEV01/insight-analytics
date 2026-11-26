import { pool } from "@/db";

const DEFAULT_INGEST_RATE_LIMIT_PER_MINUTE = 300;
const MAX_INGEST_RATE_LIMIT_PER_MINUTE = 5_000;

/**
 * Atomically consume one per-key ingestion slot in the current UTC minute.
 * The conditional UPSERT serializes competing requests in PostgreSQL; once the
 * cap is reached, later requests receive no RETURNING row and are rejected.
 */
export async function consumeIngestRateLimit(
  apiKeyId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const configuredLimit = Number(process.env.INGEST_RATE_LIMIT_PER_MINUTE);
  const limit = Number.isSafeInteger(configuredLimit) && configuredLimit > 0
    ? Math.min(MAX_INGEST_RATE_LIMIT_PER_MINUTE, configuredLimit)
    : DEFAULT_INGEST_RATE_LIMIT_PER_MINUTE;

  const bucketAt = new Date(now);
  bucketAt.setUTCSeconds(0, 0);

  const result = await pool.query(
    "INSERT INTO ingest_rate_limits (api_key_id,bucket_at,hits) VALUES ($1,$2,1) ON CONFLICT (api_key_id,bucket_at) DO UPDATE SET hits=ingest_rate_limits.hits+1 WHERE ingest_rate_limits.hits<$3 RETURNING hits",
    [apiKeyId, bucketAt, limit],
  );

  return (result.rowCount ?? 0) > 0;
}
