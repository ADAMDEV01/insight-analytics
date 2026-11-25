import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { apiKeys, auditLogs } from "@/db/schema";
import { apiError, apiSuccess, readJson } from "@/lib/http";
import { getRequiredSession } from "@/lib/session";
import { getProjectAccess, hasMinimumRole } from "@/lib/permissions";
import { createPublishableKey, hashApiKey } from "@/lib/crypto";

const schema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(2).max(50),
  allowedOrigins: z.array(z.string().url()).max(20).optional(),
});

function normalizeAllowedOrigins(values: string[]) {
  const origins: string[] = [];
  for (const value of values) {
    const parsed = new URL(value);
    const localHttp = parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !localHttp) {
      throw new Error("Allowed origins must use HTTPS (HTTP is only allowed for localhost).");
    }
    origins.push(parsed.origin);
  }
  if (new Set(origins).size !== origins.length) throw new Error("Allowed origins must be unique.");
  return origins;
}

export async function GET(request: Request) {
  const session = await getRequiredSession(request);
  if (!session) return apiError("Sign in to view keys.", 401, "UNAUTHORIZED");
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) return apiError("projectId is required.");
  const access = await getProjectAccess(session.user.id, projectId);
  if (!access) return apiError("Project not found.", 404, "NOT_FOUND");

  const list = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      allowedOrigins: apiKeys.allowedOrigins,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.projectId, projectId))
    .orderBy(desc(apiKeys.createdAt));

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

  let origins: string[];
  try {
    origins = normalizeAllowedOrigins(body.data.allowedOrigins ?? []);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Invalid allowed origins.", 422, "VALIDATION_ERROR");
  }

  const key = createPublishableKey();
  const prefix = key.slice(0, 16);
  const created = await db.transaction(async (tx) => {
    const [record] = await tx
      .insert(apiKeys)
      .values({
        projectId: body.data.projectId,
        name: body.data.name,
        prefix,
        keyHash: hashApiKey(key),
        allowedOrigins: origins,
      })
      .returning({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, createdAt: apiKeys.createdAt });

    await tx.insert(auditLogs).values({
      workspaceId: access.workspaceId,
      actorUserId: session.user.id,
      action: "api_key.created",
      resourceType: "api_key",
      resourceId: record.id,
      metadata: { prefix },
    });
    return record;
  });

  return apiSuccess({ apiKey: created, key }, 201);
}

export async function DELETE(request: Request) {
  const session = await getRequiredSession(request);
  if (!session) return apiError("Sign in to revoke a key.", 401, "UNAUTHORIZED");
  const keyId = new URL(request.url).searchParams.get("keyId");
  if (!keyId || !z.string().uuid().safeParse(keyId).success) {
    return apiError("A valid keyId is required.", 422, "VALIDATION_ERROR");
  }

  const [key] = await db
    .select({ id: apiKeys.id, projectId: apiKeys.projectId, prefix: apiKeys.prefix })
    .from(apiKeys)
    .where(eq(apiKeys.id, keyId))
    .limit(1);
  if (!key) return apiError("API key not found.", 404, "NOT_FOUND");

  const access = await getProjectAccess(session.user.id, key.projectId);
  if (!access) return apiError("API key not found.", 404, "NOT_FOUND");
  if (!hasMinimumRole(access.role, "admin")) {
    return apiError("Only workspace owners and admins can revoke keys.", 403, "FORBIDDEN");
  }

  const revoked = await db.transaction(async (tx) => {
    const [record] = await tx
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, key.id), isNull(apiKeys.revokedAt)))
      .returning({ id: apiKeys.id });
    if (!record) return null;

    await tx.insert(auditLogs).values({
      workspaceId: access.workspaceId,
      actorUserId: session.user.id,
      action: "api_key.revoked",
      resourceType: "api_key",
      resourceId: key.id,
      metadata: { prefix: key.prefix },
    });
    return record;
  });

  if (!revoked) return apiError("This API key has already been revoked.", 409, "ALREADY_REVOKED");
  return apiSuccess({ revoked: true, keyId: key.id });
}
