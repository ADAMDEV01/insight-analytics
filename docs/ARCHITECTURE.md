# INSIGHT architecture

## Runtime boundaries

The web application is a modular monolith on Next.js App Router. Server components render authenticated pages; Route Handlers expose JSON APIs. Better Auth owns identity and sessions. Drizzle defines and queries the PostgreSQL schema, while a small node-postgres pool is used for transactional outbox processing and analytical SQL.

## Event path

1. Browser SDK creates a stable per-event idempotency key and batches events.
2. POST /api/v1/ingest validates payload size, field shape, key hash, origin policy, and a database-backed per-minute request bucket.
3. One database transaction inserts the raw events and outbox records. Unique (project_id, idempotency_key) prevents duplicates.
4. Next.js `after()` schedules a small best-effort batch after the ingestion response. Vercel Cron calls the protected processor route as durable recovery and reconciliation. The shared processor selects pending rows with FOR UPDATE SKIP LOCKED, uses a savepoint per event, and applies raw-event-derived daily aggregates.
5. Failed events receive bounded exponential retry delay and become inspectable as terminal failures after eight attempts.
6. Analytics routes read aggregates and raw events; the browser never calculates tenant authorization.

## Multi-tenancy

Workspaces contain members and projects. Every project-scoped API route resolves the caller's membership using a database join. Role checks are performed on the server. UI visibility is only presentation and is not a security control. The default workspace is deterministically provisioned from a user ID hash, making concurrent first-page requests idempotent.

## Data model

- Better Auth: user, session, account, verification
- Workspace: workspaces, workspace_members, projects
- Ingestion: api_keys, events, event_outbox, ingest_rate_limits
- Aggregates: daily_rollups, daily_event_users, daily_project_users
- Product: saved_reports, audit_logs

## Operational safeguards

Use a pooled DATABASE_URL for application queries and a direct MIGRATION_DATABASE_URL for schema changes. Cron requests require CRON_SECRET. The processor claims a bounded batch and uses row locks so concurrent invocations do not claim the same job. No in-memory queue is treated as durable state.

## Known boundaries

This initial release implements password auth, personal workspaces, projects, publishable ingestion keys, events, event rollups, overview, event exploration, funnels, retention, and saved report definitions. Workspace invitations, billing, export jobs, data deletion workflows, IP allowlists, and high-volume columnar storage are not implemented. Validate privacy, retention, consent, and regional requirements before sending customer data.
