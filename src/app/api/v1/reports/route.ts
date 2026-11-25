import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { savedReports } from "@/db/schema";
import { apiError, apiSuccess, readJson } from "@/lib/http";
import { getRequiredSession } from "@/lib/session";
import { getProjectAccess, hasMinimumRole } from "@/lib/permissions";

const schema = z.object({ projectId: z.string().uuid(), name: z.string().trim().min(2).max(80), description: z.string().trim().max(240).optional(), configuration: z.record(z.string(), z.unknown()).default({}) });
export async function GET(request: Request) {
  const session = await getRequiredSession(request);
  if (!session) return apiError("Sign in to view reports.", 401, "UNAUTHORIZED");
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) return apiError("projectId is required.");
  const access = await getProjectAccess(session.user.id, projectId);
  if (!access) return apiError("Project not found.", 404, "NOT_FOUND");
  const reports = await db.select({ id: savedReports.id, name: savedReports.name, description: savedReports.description, configuration: savedReports.configuration, createdAt: savedReports.createdAt, updatedAt: savedReports.updatedAt }).from(savedReports).where(and(eq(savedReports.workspaceId, access.workspaceId), eq(savedReports.projectId, projectId))).orderBy(desc(savedReports.updatedAt));
  return apiSuccess({ reports });
}
export async function POST(request: Request) {
  const session = await getRequiredSession(request);
  if (!session) return apiError("Sign in to save reports.", 401, "UNAUTHORIZED");
  const body = schema.safeParse(await readJson(request));
  if (!body.success) return apiError(body.error.issues[0]?.message || "Invalid report.", 422, "VALIDATION_ERROR");
  const access = await getProjectAccess(session.user.id, body.data.projectId);
  if (!access) return apiError("Project not found.", 404, "NOT_FOUND");
  if (!hasMinimumRole(access.role, "analyst")) return apiError("Your workspace role cannot save reports.", 403, "FORBIDDEN");
  const [report] = await db.insert(savedReports).values({ workspaceId: access.workspaceId, projectId: body.data.projectId, createdBy: session.user.id, name: body.data.name, description: body.data.description || null, configuration: body.data.configuration }).returning({ id: savedReports.id, name: savedReports.name, createdAt: savedReports.createdAt });
  return apiSuccess({ report }, 201);
}
