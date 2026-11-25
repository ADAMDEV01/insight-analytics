import { pool } from "@/db";
import { apiError, apiSuccess } from "@/lib/http";
import { getRequiredSession } from "@/lib/session";
import { getProjectAccess } from "@/lib/permissions";
import { normalizeDateRange } from "@/lib/analytics";

export async function GET(request: Request) {
  const session = await getRequiredSession(request);
  if (!session) return apiError("Sign in to view retention.", 401, "UNAUTHORIZED");
  const params = new URL(request.url).searchParams;
  const projectId = params.get("projectId");
  if (!projectId) return apiError("projectId is required.");
  if (!(await getProjectAccess(session.user.id, projectId))) return apiError("Project not found.", 404, "NOT_FOUND");
  const range = normalizeDateRange(Number(params.get("days") || 30));
  const result = await pool.query(
    "WITH first_seen AS (SELECT distinct_id, MIN(occurred_at::date) AS cohort_date FROM events WHERE project_id=$1 GROUP BY distinct_id), cohort_users AS (SELECT distinct_id, cohort_date FROM first_seen WHERE cohort_date BETWEEN $2::date AND $3::date), offsets AS (SELECT UNNEST(ARRAY[0,1,7,14,30])::int AS day_offset), activity AS (SELECT DISTINCT distinct_id, occurred_at::date AS active_date FROM events WHERE project_id=$1 AND occurred_at::date BETWEEN $2::date AND CURRENT_DATE) SELECT cu.cohort_date::text AS cohort_date, o.day_offset, COUNT(DISTINCT cu.distinct_id)::int AS cohort_size, COUNT(DISTINCT a.distinct_id)::int AS retained FROM cohort_users cu CROSS JOIN offsets o LEFT JOIN activity a ON a.distinct_id=cu.distinct_id AND a.active_date=cu.cohort_date+o.day_offset AND cu.cohort_date+o.day_offset<=CURRENT_DATE GROUP BY cu.cohort_date,o.day_offset ORDER BY cu.cohort_date DESC,o.day_offset",
    [projectId, range.from, range.to],
  );
  const map = new Map<string, { cohortDate: string; cohortSize: number; retention: Record<string, number | null> }>();
  for (const row of result.rows) {
    const cohort = map.get(row.cohort_date) || { cohortDate: row.cohort_date, cohortSize: row.cohort_size, retention: {} };
    cohort.retention[String(row.day_offset)] = row.cohort_date && new Date(row.cohort_date + "T00:00:00Z").getTime() + row.day_offset * 86400000 <= Date.now() ? (row.cohort_size ? Number(((row.retained / row.cohort_size) * 100).toFixed(1)) : 0) : null;
    map.set(row.cohort_date, cohort);
  }
  return apiSuccess({ range, offsets: [0,1,7,14,30], cohorts: Array.from(map.values()) });
}
