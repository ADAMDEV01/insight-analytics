import { pool } from "@/db";
import { apiError, apiSuccess } from "@/lib/http";
import { getRequiredSession } from "@/lib/session";
import { getProjectAccess } from "@/lib/permissions";
import { buildDailySeries, normalizeDateRange } from "@/lib/analytics";

export async function GET(request: Request) {
  const session = await getRequiredSession(request);
  if (!session) return apiError("Sign in to view analytics.", 401, "UNAUTHORIZED");
  const params = new URL(request.url).searchParams;
  const projectId = params.get("projectId");
  if (!projectId) return apiError("projectId is required.");
  const access = await getProjectAccess(session.user.id, projectId);
  if (!access) return apiError("Project not found.", 404, "NOT_FOUND");
  const requestedDays = params.has("days") ? Number(params.get("days")) : 30;
  const range = normalizeDateRange(requestedDays);
  const previousFrom = new Date(range.from + "T00:00:00.000Z");
  previousFrom.setUTCDate(previousFrom.getUTCDate() - range.days);
  const previousStart = previousFrom.toISOString().slice(0, 10);
  const previousEnd = new Date(new Date(range.from + "T00:00:00.000Z").getTime() - 86400000).toISOString().slice(0, 10);
  const [currentEvents, currentUsers, previousEvents, previousUsers, seriesEvents, seriesUsers, sessions, topEvents] = await Promise.all([
    pool.query("SELECT COALESCE(SUM(event_count),0)::int AS value, COALESCE(SUM(unique_users),0)::int AS pairs FROM daily_rollups WHERE project_id=$1 AND bucket_date BETWEEN $2::date AND $3::date", [projectId, range.from, range.to]),
    pool.query("SELECT COUNT(DISTINCT distinct_id)::int AS value FROM daily_project_users WHERE project_id=$1 AND bucket_date BETWEEN $2::date AND $3::date", [projectId, range.from, range.to]),
    pool.query("SELECT COALESCE(SUM(event_count),0)::int AS value FROM daily_rollups WHERE project_id=$1 AND bucket_date BETWEEN $2::date AND $3::date", [projectId, previousStart, previousEnd]),
    pool.query("SELECT COUNT(DISTINCT distinct_id)::int AS value FROM daily_project_users WHERE project_id=$1 AND bucket_date BETWEEN $2::date AND $3::date", [projectId, previousStart, previousEnd]),
    pool.query("SELECT bucket_date::text AS day, SUM(event_count)::int AS events FROM daily_rollups WHERE project_id=$1 AND bucket_date BETWEEN $2::date AND $3::date GROUP BY bucket_date ORDER BY bucket_date", [projectId, range.from, range.to]),
    pool.query("SELECT bucket_date::text AS day, COUNT(DISTINCT distinct_id)::int AS users FROM daily_project_users WHERE project_id=$1 AND bucket_date BETWEEN $2::date AND $3::date GROUP BY bucket_date ORDER BY bucket_date", [projectId, range.from, range.to]),
    pool.query("SELECT COUNT(DISTINCT session_id)::int AS value FROM events WHERE project_id=$1 AND occurred_at >= $2::date AND occurred_at < ($3::date + INTERVAL '1 day') AND session_id IS NOT NULL", [projectId, range.from, range.to]),
    pool.query("SELECT event_name AS \"eventName\", SUM(event_count)::int AS count FROM daily_rollups WHERE project_id=$1 AND bucket_date BETWEEN $2::date AND $3::date GROUP BY event_name ORDER BY count DESC LIMIT 6", [projectId, range.from, range.to]),
  ]);

  return apiSuccess({
    range,
    totals: { events: currentEvents.rows[0]?.value || 0, activeUsers: currentUsers.rows[0]?.value || 0, sessions: sessions.rows[0]?.value || 0, uniqueUserEvents: currentEvents.rows[0]?.pairs || 0 },
    previous: { events: previousEvents.rows[0]?.value || 0, activeUsers: previousUsers.rows[0]?.value || 0 },
    series: buildDailySeries(range.from, range.days, seriesEvents.rows, seriesUsers.rows),
    topEvents: topEvents.rows,
  });
}
