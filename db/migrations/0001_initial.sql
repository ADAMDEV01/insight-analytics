DO $$ BEGIN
  CREATE TYPE workspace_role AS ENUM ('owner', 'admin', 'analyst', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "user" (
  id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE, email_verified boolean NOT NULL DEFAULT false,
  image text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "session" (
  id text PRIMARY KEY, expires_at timestamptz NOT NULL, token text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), ip_address text, user_agent text, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS session_user_id_idx ON "session"(user_id);
CREATE TABLE IF NOT EXISTS "account" (
  id text PRIMARY KEY, account_id text NOT NULL, provider_id text NOT NULL, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  access_token text, refresh_token text, id_token text, access_token_expires_at timestamptz, refresh_token_expires_at timestamptz,
  scope text, password text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_user_id_idx ON "account"(user_id);
CREATE TABLE IF NOT EXISTS "verification" (
  id text PRIMARY KEY, identifier text NOT NULL, value text NOT NULL, expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_identifier_idx ON "verification"(identifier);

CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, slug text NOT NULL UNIQUE,
  created_by text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, role workspace_role NOT NULL DEFAULT 'viewer', created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_members_workspace_user_unique UNIQUE(workspace_id,user_id)
);
CREATE INDEX IF NOT EXISTS workspace_members_user_idx ON workspace_members(user_id);
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL, slug text NOT NULL, description text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_workspace_slug_unique UNIQUE(workspace_id,slug)
);
CREATE INDEX IF NOT EXISTS projects_workspace_idx ON projects(workspace_id);
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL, prefix text NOT NULL UNIQUE, key_hash text NOT NULL UNIQUE, allowed_origins jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), last_used_at timestamptz, revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS api_keys_project_idx ON api_keys(project_id);
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  event_name text NOT NULL, distinct_id text NOT NULL, session_id text, properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now(), idempotency_key text NOT NULL,
  CONSTRAINT events_project_idempotency_unique UNIQUE(project_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS events_project_time_idx ON events(project_id,occurred_at);
CREATE INDEX IF NOT EXISTS events_project_name_time_idx ON events(project_id,event_name,occurred_at);
CREATE INDEX IF NOT EXISTS events_project_distinct_idx ON events(project_id,distinct_id,occurred_at);
CREATE TABLE IF NOT EXISTS event_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz, failed_at timestamptz,
  last_error text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_outbox_pending_idx ON event_outbox(processed_at,failed_at,available_at);
CREATE TABLE IF NOT EXISTS daily_rollups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  bucket_date date NOT NULL, event_name text NOT NULL, event_count bigint NOT NULL DEFAULT 0, unique_users bigint NOT NULL DEFAULT 0,
  CONSTRAINT daily_rollups_project_date_event_unique UNIQUE(project_id,bucket_date,event_name)
);
CREATE INDEX IF NOT EXISTS daily_rollups_project_date_idx ON daily_rollups(project_id,bucket_date);
CREATE TABLE IF NOT EXISTS daily_event_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  bucket_date date NOT NULL, event_name text NOT NULL, distinct_id text NOT NULL,
  CONSTRAINT daily_event_users_unique UNIQUE(project_id,bucket_date,event_name,distinct_id)
);
CREATE TABLE IF NOT EXISTS daily_project_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  bucket_date date NOT NULL, distinct_id text NOT NULL,
  CONSTRAINT daily_project_users_unique UNIQUE(project_id,bucket_date,distinct_id)
);
CREATE INDEX IF NOT EXISTS daily_project_users_project_date_idx ON daily_project_users(project_id,bucket_date);
CREATE TABLE IF NOT EXISTS ingest_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), api_key_id uuid NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  bucket_at timestamptz NOT NULL, hits integer NOT NULL DEFAULT 0,
  CONSTRAINT ingest_rate_limits_key_bucket_unique UNIQUE(api_key_id,bucket_at)
);
CREATE TABLE IF NOT EXISTS saved_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, created_by text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL, description text, configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saved_reports_workspace_idx ON saved_reports(workspace_id,updated_at);
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_user_id text REFERENCES "user"(id) ON DELETE SET NULL, action text NOT NULL, resource_type text NOT NULL,
  resource_id text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_workspace_time_idx ON audit_logs(workspace_id,created_at);
