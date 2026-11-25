import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, projects } from "@/db/schema";
import { apiError, apiSuccess, readJson } from "@/lib/http";
import { getRequiredSession } from "@/lib/session";
import { getDefaultWorkspace, getWorkspaceMembership } from "@/lib/workspace";
import { hasMinimumRole } from "@/lib/permissions";
import { randomBytes } from "node:crypto";

const createSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(200).optional(),
});

export async function GET(request: Request) {
  const session = await getRequiredSession(request);
  if (!session) return apiError("Sign in to access projects.", 401, "UNAUTHORIZED");

  const requestedWorkspace = new URL(request.url).searchParams.get("workspaceId");
  const context = requestedWorkspace
    ? await getWorkspaceMembership(session.user.id, requestedWorkspace)
    : await getDefaultWorkspace(session.user.id);
  if (!context) return apiError("Workspace not found.", 404, "NOT_FOUND");

  const list = await db
    .select({ id: projects.id, name: projects.name, slug: projects.slug, description: projects.description, createdAt: projects.createdAt })
    .from(projects)
    .where(eq(projects.workspaceId, context.workspace.id))
    .orderBy(asc(projects.createdAt));

  return apiSuccess({ projects: list, workspaceId: context.workspace.id, role: context.role });
}

export async function POST(request: Request) {
  const session = await getRequiredSession(request);
  if (!session) return apiError("Sign in to create a project.", 401, "UNAUTHORIZED");

  const body = createSchema.safeParse(await readJson(request));
  if (!body.success) return apiError(body.error.issues[0]?.message || "Invalid project details.", 422, "VALIDATION_ERROR");

  const context = await getDefaultWorkspace(session.user.id);
  if (!hasMinimumRole(context.role, "admin")) return apiError("You do not have permission to create projects.", 403, "FORBIDDEN");

  const slugBase = body.data.name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "project";
  const slug = slugBase + "-" + randomBytes(3).toString("hex");
  const created = await db.transaction(async (tx) => {
    const [project] = await tx.insert(projects).values({
      workspaceId: context.workspace.id,
      name: body.data.name,
      slug,
      description: body.data.description || null,
    }).returning();
    await tx.insert(auditLogs).values({
      workspaceId: context.workspace.id,
      actorUserId: session.user.id,
      action: "project.created",
      resourceType: "project",
      resourceId: project.id,
      metadata: { name: project.name },
    });
    return project;
  });

  return apiSuccess({ project: created }, 201);
}
