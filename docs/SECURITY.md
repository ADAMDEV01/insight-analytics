# Security checklist

- Keep database, auth, and cron credentials server-side only.
- Store publishable key hashes, never plaintext keys; reveal the generated key once.
- Persist Better Auth rate-limit counters in PostgreSQL so limits are shared across serverless instances and deployments.
- Apply workspace membership checks in every protected API handler.
- Apply minimum role checks to key issuance, project creation, and report writes.
- Validate request bodies with Zod and bound event payloads to 256 KB and 100 events.
- Use idempotency keys to make event retries safe.
- Use database-backed per-minute rate counters for ingestion.
- Protect scheduled processing with a high-entropy CRON_SECRET and constant-time comparison.
- Apply SQL migrations using the direct database connection string.
- Do not store unnecessary personal information in event properties. Define consent, retention, deletion, and access processes before production use.

The browser ingestion key is a publishable credential, not a secret. Origin restrictions reduce casual misuse but do not replace rate limiting, monitoring, or key rotation.


## Development-tool advisory exception

The root dependency tree still reports a Moderate esbuild advisory (GHSA-67mh-4wv8-2f99) through Drizzle Kit's deprecated `@esbuild-kit/esm-loader` dependency. This is a development-tool dependency and is not part of the production runtime dependency tree. The advisory concerns exposure when the affected esbuild development server is running. The current stable Drizzle Kit line has not yet removed the deprecated loader; forcing `npm audit fix --force` proposes a breaking downgrade of Drizzle Kit and is not an acceptable remediation. CI separately requires a clean moderate-threshold audit for production dependencies and blocks high-severity advisories in the entire tree. Revisit this exception when Drizzle Kit ships a stable release without the loader.
