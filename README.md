# INSIGHT — Product Analytics Platform

INSIGHT is a full-stack product analytics platform focused on a premium, responsive analytics experience backed by real PostgreSQL persistence. It includes workspace-scoped projects, publishable ingestion keys, event ingestion, an outbox processor, analytics endpoints, and a browser SDK.

**Verification status:** code is committed, but external database provisioning, migration execution, browser-based local verification, and Vercel deployment still need to be completed with owner credentials. Do not describe these as complete until verified.

## Stack

- Next.js 16.4.6, React 19.3.1, TypeScript strict mode
- Tailwind CSS 4, Lucide, Recharts, accessible component primitives
- Better Auth with Drizzle PostgreSQL adapter
- Drizzle ORM, node-postgres, Neon PostgreSQL
- Zod validation, Vitest, Playwright
- Vercel deployment with a scheduled, bounded outbox processor

## Features

- Password registration, sign-in, sign-out, and persistent sessions
- Automatically provisioned personal workspace and initial project
- Workspace membership roles: owner, admin, analyst, viewer
- Project creation, key listing, one-time display, and immediate key revocation
- Batch event ingestion with schema validation, origin allowlists, request rate limits, and idempotency
- Transactional outbox processing using PostgreSQL row locks, per-event savepoints, bounded retries, and terminal failure state
- Event explorer with search, pagination, and CSV export (10,000-row cap)
- Persisted daily event counts, per-event unique users, and project-wide active users
- Overview metrics and trends, ordered conversion funnels, retention cohorts, and saved report definitions
- Browser SDK package under packages/sdk
- Responsive shell, dark/light theme, keyboard command navigation, and clear empty/loading/error states

## Architecture

This is a modular monolith. Next.js Route Handlers are the application API. PostgreSQL is the source of truth. Event ingestion writes the raw event and its outbox record in one transaction. Vercel Cron invokes /api/cron/process-events every five minutes; the processor uses FOR UPDATE SKIP LOCKED and per-event savepoints so overlapping invocations do not double-claim a row. Analytics pages consume persisted data through authenticated endpoints.

See docs/ARCHITECTURE.md, docs/PRODUCT.md, and docs/SECURITY.md.

## Requirements and setup

Requirements: Node.js 22.12+ and PostgreSQL 16+ (Neon is supported).

1. Run npm install.
2. Copy .env.example to .env.local.
3. Set DATABASE_URL to a pooled PostgreSQL URL for application traffic.
4. Set MIGRATION_DATABASE_URL to a direct, non-pooled PostgreSQL URL for schema migrations.
5. Configure BETTER_AUTH_SECRET (32+ characters), BETTER_AUTH_URL, NEXT_PUBLIC_APP_URL, and CRON_SECRET.
6. Run npm run db:migrate.
7. Run npm run dev.

Never commit .env.local or print secret values in CI logs.

## Environment variables

| Variable | Purpose |
|---|---|
| DATABASE_URL | Pooled Postgres connection used by app runtime |
| MIGRATION_DATABASE_URL | Direct Postgres connection used by migration runner |
| BETTER_AUTH_SECRET | Better Auth signing secret, at least 32 characters |
| BETTER_AUTH_URL | Canonical server auth URL |
| NEXT_PUBLIC_APP_URL | Browser-visible application origin |
| CRON_SECRET | Bearer secret protecting cron processor |
| INGEST_RATE_LIMIT_PER_MINUTE | Optional per-key request limit; defaults to 300 |

## Commands

- npm run dev — development server
- npm run build — production build
- npm run lint — ESLint
- npm run typecheck — TypeScript strict check
- npm run test — unit tests
- npm run test:e2e — Playwright smoke tests
- npm run db:migrate — apply ordered SQL migrations from db/migrations
- npm run db:studio — Drizzle Studio

New schema changes should be added as the next ordered SQL file in db/migrations. The migration runner records applied filenames in insight_schema_migrations and serializes concurrent migration runs with a PostgreSQL advisory lock.

## API

- /api/auth/[...all] — Better Auth endpoints
- GET|POST /api/v1/projects — list and create workspace projects
- GET|POST /api/v1/api-keys — list metadata and create a publishable key
- POST /api/v1/ingest — ingest up to 100 validated events per request
- GET /api/v1/analytics/overview?projectId=...&days=30
- GET /api/v1/analytics/events?projectId=...&limit=25&offset=0&search=...
- POST /api/v1/analytics/funnels — ordered event funnel calculation
- GET /api/v1/analytics/retention?projectId=...&days=30
- GET|POST /api/v1/reports — list and save named report definitions
- GET|POST /api/cron/process-events — protected outbox processor

Every project-specific endpoint checks authenticated workspace membership server-side. UI route visibility is not an authorization boundary.

## Browser SDK

See packages/sdk/README.md. Build the SDK package with npm install and npm run build from packages/sdk. The publishable key is intentionally public and must not be treated as a server secret. Do not send sensitive personal data in event properties.

## Deploying

1. Provision Neon Postgres in a region supported by your Vercel app and obtain pooled and direct connection strings.
2. Add the variables above to Vercel Production and Preview environments.
3. Apply SQL migrations to the target database using MIGRATION_DATABASE_URL before serving traffic.
4. Deploy the repository to Vercel.
5. Confirm the Vercel Cron schedule is active and CRON_SECRET matches the deployed environment.
6. Create a project key, send test events, wait for processing, then verify the Events and Overview pages.

## Verification checklist

- [ ] npm install completes and the dependency tree is stable
- [ ] npm run lint, npm run typecheck, and npm run test pass
- [ ] npm run build completes with environment values configured
- [ ] npm run test:e2e passes in a browser
- [ ] Migrations apply to a clean Postgres database
- [ ] Sign-up/sign-in/sign-out and session restoration work
- [ ] Cross-workspace access is denied by server-side membership checks
- [ ] Non-admin key creation and project creation are denied
- [ ] Invalid key, invalid origin, oversized batch, malformed event, and rate limit are handled
- [ ] Duplicate idempotency keys do not duplicate raw events
- [ ] Concurrent cron invocations do not process the same event twice
- [ ] Retry and terminal failure behavior is verified
- [ ] All analytics are derived from persisted events and aggregates
- [ ] Vercel deployment, database connection, and cron schedule are verified

## Known scope boundaries

Workspace invitations, billing, scheduled exports, data deletion workflows, warehouse connectors, SSO/MFA, and production alerting are not included in this initial implementation. Review legal/privacy requirements, consent, access policies, and retention before ingesting real customer data.

## License

MIT
