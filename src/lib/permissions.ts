import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, workspaceMembers } from "@/db/schema";

const roleRank = { viewer: 0, analyst: 1, admin: 2, owner: 3 } as const;
export type WorkspaceRole = keyof typeof roleRank;

export async function getProjectAccess(userId: string, projectId: string) {
  const [result] = await db.select({ role: workspaceMembers.role, workspaceId: workspaceMembers.workspaceId, projectId: projects.id }).from(projects).innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, projects.workspaceId)).where(and(eq(projects.id, projectId), eq(workspaceMembers.userId, userId))).limit(1);
  return result ?? null;
}
export function hasMinimumRole(role: WorkspaceRole, minimum: WorkspaceRole) {
  return roleRank[role] >= roleRank[minimum];
}
