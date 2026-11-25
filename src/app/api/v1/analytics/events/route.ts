import { pool } from "@/db";
import { apiError, apiSuccess } from "@/lib/http";
import { getRequiredSession } from "@/lib/session";
import { getProjectAccess } from "@/lib/permissions";

function boundedInteger(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.floor(parsed))) : fallback;
}

export async function GET(request: Request) {
  const session = await getRequiredSession(request);
  if (!session) return apiError("Sign in to explore events.", 401, "UNAUTHORIZED");
  const params = new URL(request.url).searchParams;
  const projectId = params.get("projectId");
  if (!projectId) return apiError("projectId is required.");
  if (!(await getProjectAccess(session.user.id, projectId))) {
    return apiError("Project not found.", 404, "NOT_FOUND");
  }

  const limit = boundedInteger(params.get("limit"), 25, 1, 100);
  const offset = boundedInteger(params.get("offset"), 0, 0, 100000);
  const search = (params.get("search") || "").trim().slice(0, 100);
  const pattern = search ? "%" + search + "%" : null;

  const [rows, count] = await Promise.all([
    pool.query(
      "SELECT id, event_name AS \\"eventName\\", distinct_id AS \\"distinctId\\", session_id AS \\"sessionId\\", occurred_at AS \\"occurredAt\\", properties FROM events WHERE project_id=$1 AND ($2::text IS NULL OR event_name ILIKE $2 OR distinct_id ILIKE $2) ORDER BY occurred_at DESC, id DESC LIMIT $3 OFFSET $4",
      [projectId, pattern, limit, offset],
    ),
    pool.query(
      "SELECT COUNT(*)::int AS total FROM events WHERE project_id=$1 AND ($2::text IS NULL OR event_name ILIKE $2 OR distinct_id ILIKE $2)",
      [projectId, pattern],
    ),
  ]);

  return apiSuccess({ events: rows.rows, total: count.rows[0]?.total || 0, limit, offset });
}
