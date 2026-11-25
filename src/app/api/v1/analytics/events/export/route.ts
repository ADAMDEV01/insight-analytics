import { pool } from "@/db";
import { apiError } from "@/lib/http";
import { getRequiredSession } from "@/lib/session";
import { getProjectAccess } from "@/lib/permissions";
import { isIsoDateString } from "@/lib/analytics";

function csvCell(value: unknown): string {
  let text = value == null ? "" : typeof value === "string" ? value : JSON.stringify(value) ?? String(value);
  if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
  return "\"" + text.replace(/"/g, "\"\"") + "\"";
}

export async function GET(request: Request) {
  const session = await getRequiredSession(request);
  if (!session) return apiError("Sign in to export events.", 401, "UNAUTHORIZED");

  const params = new URL(request.url).searchParams;
  const projectId = params.get("projectId");
  if (!projectId) return apiError("projectId is required.");
  if (!(await getProjectAccess(session.user.id, projectId))) {
    return apiError("Project not found.", 404, "NOT_FOUND");
  }

  const from = params.get("from");
  const to = params.get("to");
  if ((from && !isIsoDateString(from)) || (to && !isIsoDateString(to))) {
    return apiError("Dates must be valid YYYY-MM-DD values.", 422, "VALIDATION_ERROR");
  }
  if (from && to && from > to) return apiError("The start date must be before the end date.", 422, "VALIDATION_ERROR");

  const result = await pool.query(
    "SELECT id, event_name, distinct_id, session_id, occurred_at, received_at, properties FROM events WHERE project_id=$1 AND ($2::date IS NULL OR occurred_at >= $2::date) AND ($3::date IS NULL OR occurred_at < ($3::date + INTERVAL '1 day')) ORDER BY occurred_at DESC, id DESC LIMIT 10000",
    [projectId, from, to],
  );

  const lines = [
    ["id", "event_name", "distinct_id", "session_id", "occurred_at", "received_at", "properties"].join(","),
    ...result.rows.map((row) => [
      row.id,
      row.event_name,
      row.distinct_id,
      row.session_id,
      row.occurred_at?.toISOString?.() ?? row.occurred_at,
      row.received_at?.toISOString?.() ?? row.received_at,
      row.properties,
    ].map(csvCell).join(",")),
  ];

  return new Response("\uFEFF" + lines.join("\r\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="insight-events-${projectId}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
