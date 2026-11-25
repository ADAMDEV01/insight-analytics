import { and, asc, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "@/db";
import { projects, workspaceMembers, workspaces } from "@/db/schema";

export async function ensurePersonalWorkspace(userId: string, userName: string) {
  const suffix = createHash("sha256").update(userId).digest("hex").slice(0, 12);
  const slug = "personal-" + suffix;
  await db.insert(workspaces).values({ name: userName.trim() ? userName + "'s workspace" : "Personal workspace", slug, createdBy: userId }).onConflictDoNothing({ target: workspaces.slug });
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1);
  if (!workspace) throw new Error("Could not initialize the personal workspace.");
  await db.insert(workspaceMembers).values({ workspaceId: workspace.id, userId, role: "owner" }).onConflictDoNothing({ target: [workspaceMembers.workspaceId, workspaceMembers.userId] });
  await db.insert(projects).values({ workspaceId: workspace.id, name: "Website", slug: "website", description: "Your first product analytics project" }).onConflictDoNothing({ target: [projects.workspaceId, projects.slug] });
  return workspace;
}

export async function getWorkspaceMembership(userId: string, workspaceId: string) {
  const [membership] = await db.select({ role: workspaceMembers.role, workspace: workspaces }).from(workspaceMembers).innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId)).where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.workspaceId, workspaceId))).limit(1);
  return membership ?? null;
}

export async function getDefaultWorkspace(userId: string) {
  const [membership] = await db.select({ workspace: workspaces, role: workspaceMembers.role }).from(workspaceMembers).innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId)).where(eq(workspaceMembers.userId, userId)).orderBy(asc(workspaces.createdAt)).limit(1);
  if (membership) return membership;
  const workspace = await ensurePersonalWorkspace(userId, "My");
  return { workspace, role: "owner" as const };
}
