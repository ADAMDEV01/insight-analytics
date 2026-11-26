import { pgTable, pgEnum, text, boolean, timestamp, uuid, integer, bigint, date, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";

export const workspaceRole = pgEnum("workspace_role", ["owner", "admin", "analyst", "viewer"]);

export const user = pgTable("user", {
  id: text("id").primaryKey(), name: text("name").notNull(), email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false), image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const session = pgTable("session", {
  id: text("id").primaryKey(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"), userAgent: text("user_agent"), userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (t) => [index("session_user_id_idx").on(t.userId)]);
export const account = pgTable("account", {
  id: text("id").primaryKey(), accountId: text("account_id").notNull(), providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }), accessToken: text("access_token"), refreshToken: text("refresh_token"),
  idToken: text("id_token"), accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }), refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"), password: text("password"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("account_user_id_idx").on(t.userId)]);
export const verification = pgTable("verification", {
  id: text("id").primaryKey(), identifier: text("identifier").notNull(), value: text("value").notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("verification_identifier_idx").on(t.identifier)]);

export const rateLimit = pgTable("rateLimit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("lastRequest", { mode: "number" }).notNull(),
});

export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(), name: text("name").notNull(), slug: text("slug").notNull().unique(), createdBy: text("created_by").notNull().references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const workspaceMembers = pgTable("workspace_members", {
  id: uuid("id").defaultRandom().primaryKey(), workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }), role: workspaceRole("role").notNull().default("viewer"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("workspace_members_workspace_user_unique").on(t.workspaceId, t.userId), index("workspace_members_user_idx").on(t.userId)]);
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(), workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(), slug: text("slug").notNull(), description: text("description"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("projects_workspace_slug_unique").on(t.workspaceId, t.slug), index("projects_workspace_idx").on(t.workspaceId)]);
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), name: text("name").notNull(),
  prefix: text("prefix").notNull().unique(), keyHash: text("key_hash").notNull().unique(), allowedOrigins: jsonb("allowed_origins").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), lastUsedAt: timestamp("last_used_at", { withTimezone: true }), revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (t) => [index("api_keys_project_idx").on(t.projectId)]);
export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), eventName: text("event_name").notNull(),
  distinctId: text("distinct_id").notNull(), sessionId: text("session_id"), properties: jsonb("properties").$type<Record<string, unknown>>().notNull().default({}),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(), receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(), idempotencyKey: text("idempotency_key").notNull(),
}, (t) => [uniqueIndex("events_project_idempotency_unique").on(t.projectId, t.idempotencyKey), index("events_project_time_idx").on(t.projectId, t.occurredAt), index("events_project_name_time_idx").on(t.projectId, t.eventName, t.occurredAt), index("events_project_distinct_idx").on(t.projectId, t.distinctId, t.occurredAt)]);
export const eventOutbox = pgTable("event_outbox", {
  id: uuid("id").defaultRandom().primaryKey(), eventId: uuid("event_id").notNull().unique().references(() => events.id, { onDelete: "cascade" }), attempts: integer("attempts").notNull().default(0),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(), processedAt: timestamp("processed_at", { withTimezone: true }), failedAt: timestamp("failed_at", { withTimezone: true }), lastError: text("last_error"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("event_outbox_pending_idx").on(t.processedAt, t.failedAt, t.availableAt)]);
export const dailyRollups = pgTable("daily_rollups", {
  id: uuid("id").defaultRandom().primaryKey(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), bucketDate: date("bucket_date", { mode: "string" }).notNull(),
  eventName: text("event_name").notNull(), eventCount: bigint("event_count", { mode: "number" }).notNull().default(0), uniqueUsers: bigint("unique_users", { mode: "number" }).notNull().default(0),
}, (t) => [uniqueIndex("daily_rollups_project_date_event_unique").on(t.projectId, t.bucketDate, t.eventName), index("daily_rollups_project_date_idx").on(t.projectId, t.bucketDate)]);
export const dailyEventUsers = pgTable("daily_event_users", {
  id: uuid("id").defaultRandom().primaryKey(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), bucketDate: date("bucket_date", { mode: "string" }).notNull(), eventName: text("event_name").notNull(), distinctId: text("distinct_id").notNull(),
}, (t) => [uniqueIndex("daily_event_users_unique").on(t.projectId, t.bucketDate, t.eventName, t.distinctId)]);
export const dailyProjectUsers = pgTable("daily_project_users", {
  id: uuid("id").defaultRandom().primaryKey(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), bucketDate: date("bucket_date", { mode: "string" }).notNull(), distinctId: text("distinct_id").notNull(),
}, (t) => [uniqueIndex("daily_project_users_unique").on(t.projectId, t.bucketDate, t.distinctId), index("daily_project_users_project_date_idx").on(t.projectId, t.bucketDate)]);
export const ingestRateLimits = pgTable("ingest_rate_limits", {
  id: uuid("id").defaultRandom().primaryKey(), apiKeyId: uuid("api_key_id").notNull().references(() => apiKeys.id, { onDelete: "cascade" }), bucketAt: timestamp("bucket_at", { withTimezone: true }).notNull(), hits: integer("hits").notNull().default(0),
}, (t) => [uniqueIndex("ingest_rate_limits_key_bucket_unique").on(t.apiKeyId, t.bucketAt)]);
export const savedReports = pgTable("saved_reports", {
  id: uuid("id").defaultRandom().primaryKey(), workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  createdBy: text("created_by").notNull().references(() => user.id, { onDelete: "cascade" }), name: text("name").notNull(), description: text("description"), configuration: jsonb("configuration").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("saved_reports_workspace_idx").on(t.workspaceId, t.updatedAt)]);
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(), workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }), actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
  action: text("action").notNull(), resourceType: text("resource_type").notNull(), resourceId: text("resource_id"), metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("audit_logs_workspace_time_idx").on(t.workspaceId, t.createdAt)]);
