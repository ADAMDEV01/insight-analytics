import { randomUUID } from "node:crypto";
import { pool } from "@/db";

type RateLimitRule = { window: number; max: number };

let nextCleanupAt = 0;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;
const CLEANUP_ADVISORY_LOCK = 913_451_207;

async function cleanupExpiredRateLimits(now: number) {
  if (now < nextCleanupAt) return;
  nextCleanupAt = now + CLEANUP_INTERVAL_MS;

  try {
    await pool.query(
      `WITH cleanup_lock AS MATERIALIZED (
         SELECT pg_try_advisory_xact_lock($2::bigint) AS acquired
       ),
       stale AS MATERIALIZED (
         SELECT limits.id
         FROM "rateLimit" AS limits
         CROSS JOIN cleanup_lock
         WHERE cleanup_lock.acquired = true
           AND limits."lastRequest" < $1
         ORDER BY limits."lastRequest" ASC
         LIMIT 1000
       )
       DELETE FROM "rateLimit" AS limits
       USING stale
       WHERE limits.id = stale.id
         AND limits."lastRequest" < $1`,
      [now - RATE_LIMIT_RETENTION_MS, CLEANUP_ADVISORY_LOCK],
    );
  } catch (error) {
    // Rate limiting must remain available if best-effort maintenance fails.
    console.error("INSIGHT could not prune expired auth rate-limit rows", error);
  }
}

/**
 * Shared PostgreSQL rate limiting with an atomic UPSERT.
 * The counter is never read and then incremented in a separate transaction,
 * so simultaneous serverless requests cannot overrun a window's max count.
 */
export const persistentRateLimitStorage = {
  async consume(key: string, rule: RateLimitRule) {
    const now = Date.now();
    const windowStart = now - rule.window * 1000;

    const result = await pool.query(
      `INSERT INTO "rateLimit" (id, key, count, "lastRequest")
       VALUES ($1, $2, 1, $3)
       ON CONFLICT (key) DO UPDATE
       SET count = CASE
             WHEN "rateLimit"."lastRequest" <= $4 THEN 1
             ELSE "rateLimit"."count" + 1
           END,
           "lastRequest" = $3
       WHERE "rateLimit"."lastRequest" <= $4
          OR "rateLimit"."count" < $5
       RETURNING count`,
      [randomUUID(), key, now, windowStart, rule.max],
    );

    // A returned row means we inserted a fresh counter, reset an expired
    // window, or incremented below the maximum. A missing row means the
    // conditional conflict update correctly refused an over-limit request.
    if (result.rowCount === 1) {
      await cleanupExpiredRateLimits(now);
      return { allowed: true, retryAfter: null };
    }

    const current = await pool.query<{ lastRequest: string | number }>(
      'SELECT "lastRequest" FROM "rateLimit" WHERE key = $1 LIMIT 1',
      [key],
    );
    const lastRequest = Number(current.rows[0]?.lastRequest);
    if (!Number.isFinite(lastRequest)) {
      // Fail closed if the counter unexpectedly disappears between the
      // conditional UPSERT and the read used to calculate Retry-After.
      return { allowed: false, retryAfter: rule.window };
    }

    const retryAfter = Math.max(
      1,
      Math.ceil((lastRequest + rule.window * 1000 - Date.now()) / 1000),
    );
    await cleanupExpiredRateLimits(now);
    return { allowed: false, retryAfter };
  },
};
