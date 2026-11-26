# INSIGHT — Product Analytics Platform

INSIGHT is a full-stack product analytics platform focused on a responsive analytics experience backed by PostgreSQL. It includes workspace-scoped projects, publishable ingestion keys, event ingestion, a transactional outbox processor, analytics endpoints, and a browser SDK.

**Production status:** the application is deployed to Vercel and the Neon Production and Preview databases have been provisioned and migrated. CI and the production build have passed. The owner should still complete an end-to-end production smoke test (account registration/sign-in, project key creation, browser event ingestion, outbox processing, and analytics verification) before onboarding real users.

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
- Batch event ingestion with schema validation, size limits, origin allowlists, request rate limits, and idempotency
- Transactional outbox processing using PostgreSQL row locks, per-event savepoints, bounded retries, and terminal failure state
- Event explorer with search, pagination, and CSV export (10,000-row cap)
- Persisted daily event counts, per-event unique users, and project-wide active users
- Overview metrics and trends, ordered conversion funnels, retention cohorts, and saved report definitions
- Browser SDK package under packages/sdk
- Responsive shell, dark/light theme, keyboard command navigation, and clear empty/loading/error states

## Architecture

This is a modular monolith. Next.js Route Handlers are the application API. PostgreSQL is the source of truth. Event ingestion writes raw events and outbox records in one transaction, then schedules a bounded Next.js after() processing pass. Vercel Cron invokes /api/cron/process-events as a reconciliation fallback; the processor uses FOR UPDATE SKIP LOCKED and per-event savepoints so overlapping invocations do not double-claim a row. Analytics pages consume persisted data through authenticated endpoints.

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
| INGEST_RATE_LIMIT_PER_MINUTE | Optional per-key rate limit; defaults to 300 |

## Commands

- npm run dev — development server
- npm run build — production build
- npm run lint — ESLint
- npm run typecheck — TypeScript strict check
- npm run test — unit tests
- npm run test:e2e — Playwright smoke tests
- npm run db:migrate — apply ordered SQL migrations from db/migrations
- npm run db:studio — Drizzle Studio

From packages/sdk, run npm install followed by npm run build to compile the browser SDK.

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
- GET /api/health — database connectivity health check
- GET /api/v1/analytics/events/export?projectId=... — authenticated CSV export (10,000-row cap)

Every project-specific endpoint checks authenticated workspace membership server-side. UI route visibility is not an authorization boundary.

## Browser SDK

See packages/sdk/README.md. Build the SDK package by running npm install and npm run build from packages/sdk; CI type-checks this package separately. The publishable key is intentionally public and must not be treated as a server secret. Do not send sensitive personal data in event properties.

## Deploying

1. Provision Neon Postgres in a region supported by your Vercel app and obtain pooled and direct connection strings.
2. Add the variables above to Vercel Production and Preview environments.
3. Apply SQL migrations to the target database using MIGRATION_DATABASE_URL before serving traffic.
4. Deploy the repository to Vercel.
5. Confirm the Vercel Cron schedule is active and CRON_SECRET matches the deployed environment. The committed schedule runs daily to support Vercel Hobby; Pro can use a five-minute schedule by changing vercel.json to */5 * * * *.
6. Create a project key, send test events, wait for processing, then verify the Events and Overview pages.

## Production verification checklist

- [x] GitHub CI quality, PostgreSQL integration tests, production build, Playwright browser smoke test, and browser SDK build passed on the pre-auth-fix baseline.
- [x] Neon Production and Preview databases provisioned and initial SQL migration applied.
- [x] Vercel Production deployment completed for the current auth-origin and favicon fixes.
- [ ] Confirm account registration, sign-in, sign-out, and session restoration in the production browser.
- [ ] Confirm cross-workspace access is denied by server-side membership checks.
- [ ] Create a project key and send test events from the browser SDK.
- [ ] Verify event outbox processing, analytics rollups, funnels, retention, and CSV export against real test events.
- [ ] Confirm Vercel Cron runs successfully and monitor runtime errors.

## Known scope boundaries

Workspace invitations, billing, scheduled exports, data deletion workflows, warehouse connectors, SSO/MFA, and production alerting are not included in this initial implementation. Review legal/privacy requirements, consent, access policies, and retention before ingesting real customer data.

## License

MIT
