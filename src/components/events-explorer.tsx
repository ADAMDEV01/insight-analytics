"use client";

import { useEffect, useState } from "react";
import { Activity, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Card } from "@/components/ui/card";

type Project = { id: string; name: string };
type EventRow = { id: string; eventName: string; distinctId: string; sessionId: string | null; occurredAt: string; properties: Record<string, unknown> };
export function EventsExplorer() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<EventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<EventRow | null>(null);
  useEffect(() => { fetch("/api/v1/projects").then((r) => r.json()).then((r) => { const list = r.data?.projects ?? []; setProjects(list); if (list[0]) setProjectId(list[0].id); }).catch(() => setError("Projects could not be loaded.")); }, []);
  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    setLoading(true);
    const params = new URLSearchParams({ projectId, limit: "25", offset: String(page * 25), search });
    fetch("/api/v1/analytics/events?" + params.toString()).then(async (r) => { const body = await r.json(); if (!r.ok) throw new Error(body.error?.message || "Events could not be loaded."); return body.data; }).then((data) => { if (alive) { setRows(data.events); setTotal(data.total); setError(""); } }).catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : "Events could not be loaded."); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [projectId, page, search]);
  return <div className="space-y-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-accent">Event stream</p><h1 className="text-3xl font-semibold tracking-tight">Events explorer</h1><p className="mt-2 text-sm text-muted">Inspect the individual events flowing through your product.</p></div>{projects.length > 1 && <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setPage(0); }} className="surface h-10 rounded-xl px-3 text-xs">{projects.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select>}</div>
    <Card className="overflow-hidden"><div className="flex flex-col gap-3 border-b border-subtle p-4 sm:flex-row sm:items-center"><div className="surface-raised flex h-10 flex-1 items-center gap-2 rounded-xl px-3"><Search size={16} className="text-muted" /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search event names or distinct IDs..." className="w-full bg-transparent text-sm outline-none" /></div><span className="text-xs text-muted">{total.toLocaleString()} events</span></div>
      {error && <p role="alert" className="m-4 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}
      <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-xs"><thead className="bg-panel-raised text-[10px] uppercase tracking-wider text-muted"><tr><th className="px-5 py-3 font-semibold">Event</th><th className="px-5 py-3 font-semibold">Distinct ID</th><th className="px-5 py-3 font-semibold">Session</th><th className="px-5 py-3 font-semibold">Occurred at</th><th className="px-5 py-3 font-semibold">Properties</th></tr></thead><tbody className="divide-y divide-[var(--border)]">{loading ? Array.from({ length: 6 }, (_, i) => <tr key={i}><td colSpan={5} className="px-5 py-5"><div className="h-4 animate-pulse rounded bg-panel-raised" /></td></tr>) : rows.map((row) => <tr key={row.id} onClick={() => setSelected(row)} className="cursor-pointer transition-colors hover:bg-panel-raised/70"><td className="px-5 py-4"><span className="inline-flex items-center gap-2 font-semibold"><span className="h-2 w-2 rounded-full bg-accent" />{row.eventName}</span></td><td className="px-5 py-4 font-mono text-muted">{row.distinctId}</td><td className="px-5 py-4 font-mono text-muted">{row.sessionId || "—"}</td><td className="px-5 py-4 text-muted">{new Date(row.occurredAt).toLocaleString()}</td><td className="px-5 py-4 text-muted">{Object.keys(row.properties || {}).length} fields</td></tr>)}</tbody></table></div>
      {!loading && rows.length === 0 && <div className="px-5 py-16 text-center"><Activity size={26} className="mx-auto text-muted" /><p className="mt-3 text-sm font-semibold">No events found</p><p className="mt-1 text-xs text-muted">Send events with your project publishable key to populate this explorer.</p></div>}
      <div className="flex items-center justify-between border-t border-subtle px-5 py-3"><p className="text-[11px] text-muted">Page {page + 1} of {Math.max(1, Math.ceil(total / 25))}</p><div className="flex gap-2"><button disabled={page === 0 || loading} onClick={() => setPage((value) => Math.max(0, value - 1))} className="surface grid h-8 w-8 place-items-center rounded-lg disabled:opacity-30" aria-label="Previous page"><ChevronLeft size={15} /></button><button disabled={(page + 1) * 25 >= total || loading} onClick={() => setPage((value) => value + 1)} className="surface grid h-8 w-8 place-items-center rounded-lg disabled:opacity-30" aria-label="Next page"><ChevronRight size={15} /></button></div></div>
    </Card>
    {selected && <div className="fixed inset-0 z-40 flex justify-end bg-black/55" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}><section role="dialog" aria-modal="true" aria-label="Event details" className="h-full w-full max-w-lg overflow-y-auto border-l border-subtle bg-panel p-6 shadow-2xl"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.16em] text-accent">Event details</p><button onClick={() => setSelected(null)} className="text-muted">Close</button></div><h2 className="mt-5 text-xl font-semibold">{selected.eventName}</h2><p className="mt-1 text-xs text-muted">{new Date(selected.occurredAt).toLocaleString()}</p><pre className="mt-6 overflow-x-auto rounded-xl bg-background p-4 text-xs leading-6 text-emerald-300">{JSON.stringify({ distinctId: selected.distinctId, sessionId: selected.sessionId, properties: selected.properties }, null, 2)}</pre></section></div>}
  </div>;
}
