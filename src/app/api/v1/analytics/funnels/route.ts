import { z } from "zod";
import { pool } from "@/db";
import { apiError, apiSuccess, readJson } from "@/lib/http";
import { getRequiredSession } from "@/lib/session";
import { getProjectAccess } from "@/lib/permissions";
import { computeFunnel } from "@/features/analytics/funnel";
import { isIsoDateString } from "@/lib/analytics";

const dateSchema = z.string().refine(isIsoDateString, "Dates must be valid YYYY-MM-DD values.");
const schema = z.object({
  projectId: z.string().uuid(),
  steps: z.array(z.string().trim().min(1).max(120)).min(2).max(8),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});

export async function POST(request: Request) {
  const session = await getRequiredSession(request);
  if (!session) return apiError("Sign in to analyze funnels.", 401, "UNAUTHORIZED");
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message || "Invalid funnel definition.", 422, "VALIDATION_ERROR");

  const { projectId, steps } = parsed.data;
  if (new Set(steps).size !== steps.length) return apiError("Funnel steps must be unique.", 422, "VALIDATION_ERROR");
  if (!(await getProjectAccess(session.user.id, projectId))) return apiError("Project not found.", 404, "NOT_FOUND");

  const from = parsed.data.from || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const to = parsed.data.to || new Date().toISOString().slice(0, 10);
  if (from > to) return apiError("The start date must be before the end date.", 422, "VALIDATION_ERROR");

  const result = await pool.query(
    "SELECT distinct_id AS \"distinctId\", event_name AS \"eventName\", occurred_at AS \"occurredAt\" FROM events WHERE project_id=$1 AND event_name=ANY($2::text[]) AND occurred_at >= $3::date AND occurred_at < ($4::date + INTERVAL '1 day') ORDER BY distinct_id, occurred_at LIMIT 20001",
    [projectId, steps, from, to],
  );
  if (result.rows.length > 20000) return apiError("This funnel range is too large for an interactive query. Narrow the date range.", 413, "QUERY_TOO_LARGE");

  const funnel = computeFunnel(result.rows, steps);
  return apiSuccess({ steps: funnel, totalEntered: funnel[0]?.users || 0, range: { from, to } });
}
