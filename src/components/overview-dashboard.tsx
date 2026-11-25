"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, CalendarDays, MousePointer2, Users, Zap } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Project = { id: string; name: string };
type Overview = { totals: { events: number; activeUsers: number; sessions: number; uniqueUserEvents: number }; previous: { events: number; activeUsers: number }; series: { day: string; events: number; activeUsers: number }[]; topEvents: { eventName: string; count: number }[] };

function Metric({ title, value, detail, icon: Icon, trend }: { title: string; value: string; detail: string; icon: typeof Activity; trend?: number }) {
  return <Card className="overflow-hidden"><CardContent className="p-5"><div className="flex items-center justify-between"><span className="text-xs font-medium text-muted">{title}</span><span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-soft text-accent"><Icon size={17} /></span></div><p className="mt-4 text-[28px] font-semibold tracking-tight tabular-nums">{value}</p><div className="mt-2 flex items-center gap-2 text-[11px] text-muted">{typeof trend === "number" && <span className={(trend >= 0 ? "text-emerald-400" : "text-rose-400") + " inline-flex items-center gap-1 font-semibold"}>{trend >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(trend).toFixed(1)}%</span>}{detail}</div></CardContent></Card>;
}

export function OverviewDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/v1/projects").then((r) => r.json()).then((r) => { const list = r.data?.projects ?? []; setProjects(list); if (list[0]) setProjectId(list[0].id); }).catch(() => setError("Projects could not be loaded.")); }, []);
  useEffect(() => {
    if (!projectId) return;
    let active = true;
    setLoading(true);
    fetch("/api/v1/analytics/overview?projectId=" + encodeURIComponent(projectId) + "&days=" + days)
      .then(async (r) => { const payload = await r.json(); if (!r.ok) throw new Error(payload.error?.message || "Analytics could not be loaded."); return payload.data as Overview; })
      .then((payload) => { if (active) { setData(payload); setError(""); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Analytics could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId, days]);
  const metrics = useMemo(() => {
    if (!data) return [];
    const change = (current: number, previous: number) => previous === 0 ? (current === 0 ? 0 : 100) : ((current - previous) / previous) * 100;
    return [
      { title: "Total events", value: data.totals.events.toLocaleString(), detail: "vs. previous period", icon: Activity, trend: change(data.totals.events, data.previous.events) },
      { title: "Active users", value: data.totals.activeUsers.toLocaleString(), detail: "unique users in range", icon: Users, trend: change(data.totals.activeUsers, data.previous.activeUsers) },
      { title: "Sessions", value: data.totals.sessions.toLocaleString(), detail: "observed sessions", icon: MousePointer2 },
      { title: "User-event pairs", value: data.totals.uniqueUserEvents.toLocaleString(), detail: "unique users per event", icon: Zap },
    ];
  }, [data]);

  return <div className="space-y-7">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-accent">Product intelligence</p><h1 className="text-3xl font-semibold tracking-tight">Overview</h1><p className="mt-2 text-sm text-muted">A clear view of how people experience your product.</p></div><div className="flex flex-wrap items-center gap-2">{projects.length > 1 && <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="surface h-10 rounded-xl px-3 text-xs">{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>}<div className="surface flex h-10 items-center gap-1 rounded-xl p-1">{[7,30,90].map((value) => <button key={value} onClick={() => setDays(value)} className={(days === value ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground") + " h-8 rounded-lg px-3 text-xs font-semibold"}>{value}d</button>)}</div><Button variant="secondary" size="icon" aria-label="Date range"><CalendarDays size={16} /></Button></div></div>
    {error && <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
    {loading && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map((item) => <div key={item} className="surface h-32 animate-pulse rounded-2xl" />)}</div>}
    {!loading && data && <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <Metric key={metric.title} {...metric} />)}</div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,.8fr)]"><Card><CardHeader><div><CardTitle>Activity over time</CardTitle><p className="mt-1 text-xs text-muted">Daily events and active users</p></div><span className="rounded-lg bg-accent-soft px-2.5 py-1 text-[10px] font-semibold text-accent">Last {days} days</span></CardHeader><CardContent className="pt-6"><div className="h-[300px] w-full">{data.series.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={data.series} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}><defs><linearGradient id="eventFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b7bff" stopOpacity={.32} /><stop offset="95%" stopColor="#8b7bff" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--grid)" strokeDasharray="3 5" /><XAxis dataKey="day" tickFormatter={(value) => format(new Date(value), "MMM d")} tickLine={false} axisLine={false} minTickGap={30} /><YAxis tickLine={false} axisLine={false} width={44} /><Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" }} labelFormatter={(value) => format(new Date(String(value)), "PPP")} /><Area type="monotone" dataKey="events" name="Events" stroke="#8b7bff" strokeWidth={2.5} fill="url(#eventFill)" activeDot={{ r: 5 }} /><Area type="monotone" dataKey="activeUsers" name="Active users" stroke="#35c99a" strokeWidth={2} fill="transparent" /></AreaChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-center"><div><Activity size={25} className="mx-auto text-muted" /><p className="mt-3 text-sm font-medium">No processed events yet</p><p className="mt-1 text-xs text-muted">Connect your project SDK to begin collecting events.</p></div></div>}</div><div className="mt-4 flex items-center gap-5 text-[11px] text-muted"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-violet-400" />Events</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-emerald-400" />Active users</span></div></CardContent></Card>
      <Card><CardHeader><div><CardTitle>Top events</CardTitle><p className="mt-1 text-xs text-muted">Most frequent actions</p></div><Activity size={17} className="text-muted" /></CardHeader><CardContent className="pt-5">{data.topEvents.length ? <div className="space-y-5">{data.topEvents.map((event, index) => { const max = data.topEvents[0]?.count || 1; return <div key={event.eventName}><div className="mb-2 flex items-center justify-between gap-3"><span className="truncate text-xs font-medium">{event.eventName}</span><span className="text-xs tabular-nums text-muted">{event.count.toLocaleString()}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-panel-raised"><div className="h-full rounded-full bg-accent" style={{ width: ((event.count / max) * 100) + "%", opacity: 1 - index * .08 }} /></div></div>; })}</div> : <div className="py-14 text-center"><Zap size={22} className="mx-auto text-muted" /><p className="mt-3 text-sm font-medium">Nothing to rank yet</p><p className="mt-1 text-xs text-muted">Your most-used events will appear here.</p></div>}</CardContent></Card></div>
    </>}
    {!loading && !data && !error && <Card className="p-10 text-center"><p className="text-sm text-muted">Select a project to view analytics.</p></Card>}
  </div>;
}
