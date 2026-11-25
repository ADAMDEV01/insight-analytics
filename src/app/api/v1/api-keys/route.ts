import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { apiKeys, auditLogs } from "@/db/schema";
import { apiError, apiSuccess, readJson } from "@/lib/http";
import { getRequiredSession } from "@/lib/session";
import { getProjectAccess, hasMinimumRole } from "@/lib/permissions";
import { createPublishableKey, hashApiKey } from "@/lib/crypto";

const schema = z.object({ projectId: z.string().uuid(), name: z.string().trim().min(2).max(50), allowedOrigins: z.array(z.string().url()).max(20).optional() });

export async function GET(request: Request) {
  const session = await getRequiredSession(request);
  if (!session) return apiError("Sign in to view keys.", 401, "UNAUTHORIZED");
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) return apiError("projectId is required.");
  const access = await getProjectAccess(session.user.id, projectId);
  if (!access) return apiError("Project not found.", 404, "NOT_FOUND");
  const list = await db.select({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, allowedOrigins: apiKeys.allowedOrigins, createdAt: apiKeys.createdAt, lastUsedAt: apiKeys.lastUsedAt, revokedAt: apiKeys.revokedAt }).from(apiKeys).where(eq(apiKeys.projectId, projectId)).orderBy(desc(apiKeys.createdAt));
  return apiSuccess({ keys: list });
}

export async function POST(request: Request) {
  const session = await getRequiredSession(request);
  if (!session) return apiError("Sign in to create a key.", 401, "UNAUTHORIZED");
  const body = schema.safeParse(await readJson(request));
  if (!body.success) return apiError(body.error.issues[0]?.message || "Invalid key details.", 422, "VALIDATION_ERROR");
  const access = await getProjectAccess(session.user.id, body.data.projectId);
  if (!access) return apiError("Project not found.", 404, "NOT_FOUND");
  if (!hasMinimumRole(access.role, "admin")) return apiError("Only workspace owners and admins can issue keys.", 403, "FORBIDDEN");
  const key = createPublishableKey();
  const prefix = key.slice(0, 16);
  const origins = (body.data.allowedOrigins ?? []).map((value) => new URL(value).origin);
  if (new Set(origins).size !== origins.length) return apiError("Allowed origins must be unique.", 422, "VALIDATION_ERROR");
  const [created] = await db.insert(apiKeys).values({ projectId: body.data.projectId, name: body.data.name, prefix, keyHash: hashApiKey(key), allowedOrigins: origins }).returning({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, createdAt: apiKeys.createdAt });
  await db.insert(auditLogs).values({ workspaceId: access.workspaceId, actorUserId: session.user.id, action: "api_key.created", resourceType: "api_key", resourceId: created.id, metadata: { prefix } });
  return apiSuccess({ apiKey: created, key }, 201);
}
