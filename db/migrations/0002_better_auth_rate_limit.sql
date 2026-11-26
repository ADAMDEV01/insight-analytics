-- Persist Better Auth request rate-limit counters across serverless instances.
-- Column names follow Better Auth's default rateLimit model schema.
CREATE TABLE IF NOT EXISTS "rateLimit" (
  id text PRIMARY KEY,
  key text NOT NULL UNIQUE,
  count integer NOT NULL,
  "lastRequest" bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS rate_limit_last_request_idx
  ON "rateLimit" ("lastRequest");
