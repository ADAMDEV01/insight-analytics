# INSIGHT — Product Analytics Platform

INSIGHT is a full-stack product analytics platform built to demonstrate production-oriented frontend engineering and backend fundamentals. It provides workspace-scoped projects, publishable ingestion keys, event ingestion, asynchronous aggregation, and analytics views.

> **Status:** foundation implementation. Deployment and external integrations require owner-provided environment variables. Do not describe the app as production-verified until the checks in this README have been run against a configured database and deployment.

## Product goals

- Premium, responsive analytics workspace with accessible interactions.
- Real PostgreSQL persistence; no runtime localStorage data model or random dashboard metrics.
- Multi-tenant workspace membership and role-based authorization.
- Password authentication and persistent sessions with Better Auth.
- Publishable project keys, validated batch event ingestion, idempotency, and database-backed rate limiting.
- Transactional outbox and retryable aggregation into daily rollups.
- Server-side analytics queries for overview, events, funnels, and retention.
- Reproducible migrations, automated tests, CI, and deployment documentation.

## Stack

- Next.js 16 App Router, React 19, TypeScript strict mode
- Tailwind CSS 4, accessible UI primitives, Lucide, Recharts
- Better Auth with the Drizzle PostgreSQL adapter
- Drizzle ORM and Neon PostgreSQL
- Zod, Vitest, Testing Library, Playwright
- Vercel deployment; Vercel Cron invokes the bounded outbox processor

## Architecture

The application is a modular monolith. Next.js Route Handlers are the authenticated application API and ingestion endpoint. PostgreSQL is the source of truth. Ingestion writes raw events and outbox records in one transaction. A separately authenticated cron route claims outbox records with PostgreSQL row locks (SKIP LOCKED), updates aggregate tables, and records retries. Analytics pages read persisted data through server routes.

This avoids a fragile in-memory worker in serverless environments. The cron endpoint is bounded and safe for overlapping invocations; configure a Vercel Cron schedule for /api/cron/process-events.

## Local development

Requirements: Node.js 22.12+ and PostgreSQL 16+ (Neon works).

1. Install dependencies: npm install
2. Copy .env.example to .env.local and fill in the values.
3. Generate migrations: npm run db:generate
4. Apply migrations using a **direct, non-pooled** MIGRATION_DATABASE_URL: npm run db:migrate
5. Start the app: npm run dev

DATABASE_URL should be the pooled Neon connection string for runtime traffic. MIGRATION_DATABASE_URL should be the direct connection string for schema migrations. Never commit secrets.

## Environment variables

| Variable | Required | Purpose |
|---|---:|---|
| DATABASE_URL | Yes | Pooled PostgreSQL URL for application queries |
| MIGRATION_DATABASE_URL | Yes for migrations | Direct PostgreSQL URL |
| BETTER_AUTH_SECRET | Yes | High-entropy auth signing secret (32+ characters) |
| BETTER_AUTH_URL | Yes | Canonical app origin, e.g. http://localhost:3000 |
| NEXT_PUBLIC_APP_URL | Yes | Browser-visible canonical app origin |
| CRON_SECRET | Yes in production | Bearer secret protecting the event processor |
| INGEST_RATE_LIMIT_PER_MINUTE | No | Per-key ingestion limit; defaults to 300 |

## Scripts

- npm run dev — local development
- npm run build — production build
- npm run lint — ESLint
- npm run typecheck — strict TypeScript check
- npm run test — unit tests
- npm run test:e2e — Playwright browser tests
- npm run db:generate — generate SQL migrations
- npm run db:migrate — apply SQL migrations
- npm run db:studio — Drizzle Studio

## API overview

- /api/auth/[...all] — Better Auth endpoints
- POST /api/v1/ingest — ingest a batch with Authorization: Bearer ia_pub_...
- GET /api/v1/analytics/overview?projectId=...
- GET /api/v1/analytics/events?projectId=...
- POST /api/v1/analytics/funnels
- GET /api/v1/analytics/retention?projectId=...
- GET|POST /api/v1/projects?workspaceId=...
- POST /api/v1/api-keys
- POST /api/cron/process-events — protected outbox processor

Every project-scoped endpoint must verify workspace membership server-side. Client-side route visibility is not an authorization boundary.

## Event ingestion

The browser SDK sends eventName, distinctId, optional sessionId, JSON properties, an ISO timestamp, and a client-generated idempotency key. The server validates payload size and shape, resolves the publishable key by hash, enforces a database-backed rate limit, and inserts events idempotently. The SDK key is intentionally **publishable**, not a secret; restrict production use with allowed origins and rotate it if abused.

The event processor updates daily event counts, per-event unique users, and project-wide daily active users. Events remain available for detailed exploration even after aggregation.

## Security notes

- Never expose DATABASE_URL, BETTER_AUTH_SECRET, or CRON_SECRET to the browser.
- API keys are stored as SHA-256 hashes; the full key is returned once at creation.
- Verify membership and role on every protected server operation.
- Use HTTPS in production and set the production auth URL correctly.
- Apply migrations through versioned SQL files; do not use schema push in production.
- Review retention, privacy, deletion, and legal requirements before using real customer data.

## Deployment

1. Create a Neon PostgreSQL project and configure pooled DATABASE_URL plus direct MIGRATION_DATABASE_URL.
2. Set BETTER_AUTH_SECRET, BETTER_AUTH_URL, NEXT_PUBLIC_APP_URL, and CRON_SECRET in Vercel.
3. Run npm run db:generate and npm run db:migrate against the target database.
4. Deploy the project to Vercel.
5. Add the Cron schedule in vercel.json; verify the function can reach Neon and the cron secret matches.
6. Complete the smoke-test checklist below.

## Verification checklist

- [ ] Install completes with the committed lockfile.
- [ ] Migrations apply to a clean PostgreSQL database.
- [ ] Sign-up, sign-in, sign-out, and session restoration work.
- [ ] An unauthenticated request cannot access workspace data.
- [ ] A member cannot read or mutate another workspace's resources.
- [ ] A viewer cannot create keys or mutate workspace settings.
- [ ] Ingestion rejects invalid keys, oversized batches, invalid payloads, and rate-limit overflow.
- [ ] Duplicate idempotency keys do not create duplicate events.
- [ ] Overlapping cron invocations do not process an event twice.
- [ ] Failed outbox records retry with backoff and become inspectable after the retry limit.
- [ ] Overview, event explorer, funnels, and retention values are derived from persisted events.
- [ ] Keyboard, mobile, accessibility, and browser E2E checks pass.
- [ ] Vercel deployment and scheduled processing are verified against the production database.

## License

MIT
