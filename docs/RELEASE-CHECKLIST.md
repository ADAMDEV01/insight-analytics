# Release verification checklist

Run these checks before promoting a release:

```bash
npm install
npm run db:migrate
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
npm install --prefix packages/sdk
npm run build --prefix packages/sdk
```

CI runs application checks against an ephemeral PostgreSQL 16 service, including the database integration suite.

For a real deployment, also verify:
- Registration, sign-in, sign-out, and session restoration.
- Workspace membership isolation and role enforcement.
- Ingestion idempotency, origin restrictions, rate limiting, and key revocation.
- Outbox processing and aggregates after an ingestion request.
- Overview, Events, Funnels, Retention, and CSV export against persisted events.
- Vercel environment variables and scheduled outbox reconciliation.

Passing unit tests or a successful build is not a substitute for a smoke test against the configured production database.
