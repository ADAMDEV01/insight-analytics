"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, ChevronDown, Command, Database, FileText, FolderKanban, Funnel, LayoutDashboard, LogOut, Menu, Search, Settings2, Sparkles, Users, X } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

type UserInfo = { name: string; email: string };
type WorkspaceInfo = { id: string; name: string; slug: string };
const nav = [
  { label: "Workspace", items: [
    { href: "/overview", label: "Overview", icon: LayoutDashboard },
    { href: "/events", label: "Events", icon: Activity },
    { href: "/funnels", label: "Funnels", icon: Funnel },
    { href: "/retention", label: "Retention", icon: Users },
  ] },
  { label: "Manage", items: [
    { href: "/projects", label: "Projects & keys", icon: FolderKanban },
    { href: "/reports", label: "Saved reports", icon: FileText },
    { href: "/settings", label: "Settings", icon: Settings2 },
  ] },
];
const allItems = nav.flatMap((group) => group.items);

export function DashboardShell({ user, workspace, children }: { user: UserInfo; workspace: WorkspaceInfo; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const filteredItems = useMemo(() => allItems.filter((item) => item.label.toLowerCase().includes(commandQuery.toLowerCase())), [commandQuery]);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen((value) => !value); setCommandQuery(""); }
      if (event.key === "Escape") { setCommandOpen(false); setMobileOpen(false); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  useEffect(() => setMobileOpen(false), [pathname]);
  const initials = user.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "IN";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className={(mobileOpen ? "translate-x-0" : "-translate-x-full") + " fixed inset-y-0 left-0 z-40 flex w-[258px] flex-col border-r border-subtle bg-panel transition-transform duration-200 lg:translate-x-0"}>
        <div className="flex h-[76px] items-center gap-3 border-b border-subtle px-6"><div className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-white"><Sparkles size={18} /></div><div><p className="text-[15px] font-bold tracking-tight">INSIGHT</p><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-muted">Analytics workspace</p></div><button onClick={() => setMobileOpen(false)} className="ml-auto text-muted lg:hidden" aria-label="Close navigation"><X size={18} /></button></div>
        <div className="border-b border-subtle p-4"><div className="surface-raised flex w-full items-center gap-3 rounded-xl p-3"><div className="grid h-8 w-8 place-items-center rounded-lg bg-accent-soft text-accent"><Database size={16} /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{workspace.name}</p><p className="mt-0.5 text-[10px] text-muted">Personal workspace</p></div><ChevronDown size={15} className="text-muted" /></div></div>
        <nav className="flex-1 space-y-7 overflow-y-auto px-3 py-6">{nav.map((group) => <div key={group.label}><p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.17em] text-muted">{group.label}</p><div className="space-y-1">{group.items.map((item) => { const active = pathname === item.href || pathname.startsWith(item.href + "/"); const Icon = item.icon; return <Link key={item.href} href={item.href} className={(active ? "bg-accent-soft text-accent" : "text-muted hover:bg-panel-raised hover:text-foreground") + " flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-colors"}><Icon size={17} strokeWidth={1.8} /><span>{item.label}</span>{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />}</Link>; })}</div></div>)}</nav>
        <div className="border-t border-subtle p-4"><div className="rounded-xl bg-accent-soft p-3"><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-accent"><Sparkles size={14} /> Product analytics</div><p className="text-[11px] leading-5 text-muted">Understand events, funnels, and retention in one focused workspace.</p></div><div className="mt-4 flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-panel-raised text-xs font-bold">{initials}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{user.name}</p><p className="truncate text-[10px] text-muted">{user.email}</p></div><button aria-label="Sign out" title="Sign out" onClick={async () => { await authClient.signOut(); router.replace("/sign-in"); router.refresh(); }} className="text-muted hover:text-foreground"><LogOut size={16} /></button></div></div>
      </aside>
      {mobileOpen && <button aria-label="Close menu overlay" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-black/50 lg:hidden" />}
      <div className="min-h-screen lg:pl-[258px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-subtle bg-background/85 px-4 backdrop-blur-xl sm:px-7 lg:px-9"><div className="flex items-center gap-3"><Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19} /></Button><div className="hidden items-center gap-2 text-xs text-muted sm:flex"><span>Workspace</span><span>/</span><span className="font-semibold text-foreground">{allItems.find((item) => item.href === pathname)?.label || "Analytics"}</span></div><button onClick={() => { setCommandOpen(true); setCommandQuery(""); }} className="surface-raised flex h-9 items-center gap-3 rounded-xl px-3 text-xs text-muted sm:ml-3"><Search size={14} /><span className="hidden sm:inline">Search anything...</span><span className="ml-2 hidden items-center gap-1 rounded-md border border-subtle px-1.5 py-0.5 text-[10px] sm:flex"><Command size={10} /> K</span></button></div><div className="flex items-center gap-2"><div className="hidden text-right sm:block"><p className="text-[11px] font-semibold">{workspace.name}</p><p className="text-[10px] text-muted">Personal workspace</p></div><ThemeToggle /></div></header>
        <main className="mx-auto w-full max-w-[1600px] px-4 py-7 sm:px-7 sm:py-9 lg:px-9">{children}</main>
      </div>
      {commandOpen && <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/65 px-4 pt-[15vh]" onMouseDown={(event) => { if (event.target === event.currentTarget) setCommandOpen(false); }}><div role="dialog" aria-modal="true" aria-label="Quick navigation" className="surface w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl"><div className="flex items-center gap-3 border-b border-subtle px-4"><Search size={17} className="text-muted" /><input autoFocus value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && filteredItems[0]) { router.push(filteredItems[0].href); setCommandOpen(false); } }} placeholder="Jump to a page..." className="h-14 flex-1 bg-transparent text-sm outline-none" /><span className="text-[10px] text-muted">ESC</span></div><div className="max-h-72 overflow-y-auto p-2">{filteredItems.map((item) => { const Icon = item.icon; return <button key={item.href} onClick={() => { router.push(item.href); setCommandOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-muted hover:bg-panel-raised hover:text-foreground"><Icon size={16} />{item.label}<span className="ml-auto text-xs">↵</span></button>; })}{filteredItems.length===0&&<p className="px-3 py-5 text-center text-xs text-muted">No matching page.</p>}</div></div></div>}
    </div>
  );
}
