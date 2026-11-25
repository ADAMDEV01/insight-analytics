# Security checklist

- Keep database, auth, and cron credentials server-side only.
- Store publishable key hashes, never plaintext keys; reveal the generated key once.
- Apply workspace membership checks in every protected API handler.
- Apply minimum role checks to key issuance, project creation, and report writes.
- Validate request bodies with Zod and bound event payloads to 256 KB and 100 events.
- Use idempotency keys to make event retries safe.
- Use database-backed per-minute rate counters for ingestion.
- Protect scheduled processing with a high-entropy CRON_SECRET and constant-time comparison.
- Apply SQL migrations using the direct database connection string.
- Do not store unnecessary personal information in event properties. Define consent, retention, deletion, and access processes before production use.

The browser ingestion key is a publishable credential, not a secret. Origin restrictions reduce casual misuse but do not replace rate limiting, monitoring, or key rotation.
