import { after } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { pool, db } from "@/db";
import { apiKeys } from "@/db/schema";
import { apiError, apiSuccess } from "@/lib/http";
import { hashApiKey } from "@/lib/crypto";
import { persistEventBatch } from "@/lib/ingestion";
import { processOutboxBatch } from "@/lib/process-outbox";

export const runtime = "nodejs";

const eventSchema = z.object({
  eventName: z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9_.:-]+$/),
  distinctId: z.string().trim().min(1).max(160),
  sessionId: z.string().max(160).optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string().datetime().optional(),
  idempotencyKey: z.string().min(8).max(128),
}).strict();
const batchSchema = z.object({ events: z.array(eventSchema).min(1).max(100) }).strict();

function cors(response: Response, origin: string | null) {
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
  }
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.headers.set("Access-Control-Max-Age", "600");
  return response;
}

export async function OPTIONS(request: Request) {
  return cors(new Response(null, { status: 204 }), request.headers.get("origin"));
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  try {
    const authorization = request.headers.get("authorization") || "";
    const match = authorization.match(/^Bearer (ia_pub_[A-Za-z0-9_-]{32,})$/);
    if (!match) return cors(apiError("A valid publishable key is required.", 401, "INVALID_KEY"), origin);

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(contentLength) && contentLength > 256000) {
      return cors(apiError("Payload exceeds the 256 KB limit.", 413, "PAYLOAD_TOO_LARGE"), origin);
    }
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > 256000) return cors(apiError("Payload exceeds the 256 KB limit.", 413, "PAYLOAD_TOO_LARGE"), origin);

    let raw: unknown;
    try { raw = JSON.parse(text); } catch { return cors(apiError("Request body must be valid JSON.", 400, "INVALID_JSON"), origin); }

    const parsed = batchSchema.safeParse(raw);
    if (!parsed.success) return cors(apiError(parsed.error.issues[0]?.message || "Invalid event batch.", 422, "VALIDATION_ERROR"), origin);

    const keyHash = hashApiKey(match[1]);
    const [key] = await db
      .select({ id: apiKeys.id, projectId: apiKeys.projectId, allowedOrigins: apiKeys.allowedOrigins })
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
      .limit(1);

    if (!key) return cors(apiError("The publishable key is invalid or revoked.", 401, "INVALID_KEY"), origin);
    if (origin && key.allowedOrigins.length > 0 && !key.allowedOrigins.includes(origin)) {
      return cors(apiError("This origin is not allowed for the project key.", 403, "ORIGIN_NOT_ALLOWED"), null);
    }

    const limit = Math.max(1, Math.min(5000, Number(process.env.INGEST_RATE_LIMIT_PER_MINUTE || 300)));
    const bucketAt = new Date();
    bucketAt.setUTCSeconds(0, 0);
    const rate = await pool.query(
      "INSERT INTO ingest_rate_limits (api_key_id,bucket_at,hits) VALUES ($1,$2,1) ON CONFLICT (api_key_id,bucket_at) DO UPDATE SET hits=ingest_rate_limits.hits+1 WHERE ingest_rate_limits.hits<$3 RETURNING hits",
      [key.id, bucketAt, limit],
    );
    if (rate.rowCount === 0) return cors(apiError("Project ingestion rate limit reached. Retry next minute.", 429, "RATE_LIMITED"), origin);

    const result = await persistEventBatch(key.projectId, parsed.data.events);
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));
    if (result.accepted > 0) {
      after(async () => {
        try {
          await processOutboxBatch(10);
        } catch (error) {
          console.error("INSIGHT background event processing failed", error);
        }
      });
    }
    return cors(apiSuccess({ projectId: key.projectId, ...result, received: parsed.data.events.length }, 202), origin);
  } catch {
    return cors(apiError("Event ingestion is temporarily unavailable.", 500, "INGESTION_FAILED"), origin);
  }
}
