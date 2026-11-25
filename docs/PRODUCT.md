# INSIGHT product requirements

## Users

Product managers, founders, and engineers who need to understand event activity and user journeys in a small product team.

## Core workflows

1. Register and create a personal workspace.
2. Create a project and issue a publishable browser ingestion key.
3. Install the browser SDK and send events with a distinct user identifier.
4. Inspect raw events and processed analytics.
5. Define ordered funnel steps and inspect conversion / drop-off.
6. Compare cohort retention by first-seen date.
7. Save a named report configuration.

## Product principles

- Data shown in analytics is sourced from PostgreSQL, not random numbers or static fixtures.
- Every analytics view must make empty and delayed-processing states clear.
- Interactions must be usable with keyboard and touch.
- Errors must be recoverable and specific without leaking secrets or SQL details.
- A publishable key is intentionally public; authentication and authorization are enforced separately for workspace APIs.

## Non-goals for the initial release

Billing, paid tiers, user invitations, complex organization provisioning, automatic identity stitching, warehouse integrations, and a general-purpose SQL editor.
