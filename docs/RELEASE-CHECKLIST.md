# Quality and release verification

Run these checks before promoting a release:

```bash
npm install
npm run db:migrate
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

The CI workflow runs the same application checks against an ephemeral PostgreSQL 16 service, including the database integration suite. The browser SDK is built separately from `packages/sdk`.

For a real deployment, also verify:
- registration, sign-in, sign-out, and session restoration;
- workspace membership isolation and role enforcement;
- ingestion idempotency, origin restrictions, rate limiting, and key revocation;
- outbox retry behavior and aggregates after an ingestion request;
- Overview, Events, Funnels, Retention, and CSV export against persisted test events;
- Vercel environment variables and the scheduled outbox reconciliation endpoint.

Passing unit tests or a successful build is not a substitute for the production smoke test against the configured Neon database.
