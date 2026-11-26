import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getRequiredSession } from "@/lib/session";
import { getDefaultWorkspace } from "@/lib/workspace";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getRequiredSession();
  if (!session) redirect("/sign-in");

  const context = await getDefaultWorkspace(session.user.id, session.user.name || "My");
  return (
    <DashboardShell
      user={{ name: session.user.name || "Member", email: session.user.email }}
      workspace={{ id: context.workspace.id, name: context.workspace.name, slug: context.workspace.slug }}
    >
      {children}
    </DashboardShell>
  );
}
