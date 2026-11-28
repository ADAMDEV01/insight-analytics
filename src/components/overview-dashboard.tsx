"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity, ArrowDownRight, ArrowUpRight, Code2, ExternalLink, Info,
  KeyRound, MousePointer2, RefreshCw, Users, Zap,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Project = { id: string; name: string };
type Overview = {
  totals: { events: number; activeUsers: number; sessions: number; uniqueUserEvents: number };
  previous: { events: number; activeUsers: number };
  series: { day: string; events: number; activeUsers: number }[];
  topEvents: { eventName: string; count: number }[];
};

function Metric({
  title, value, detail, icon: Icon, trend, tooltip,
}: {
  title: string; value: string; detail: string; icon: typeof Activity;
  trend?: number | null; tooltip?: string;
}) {
  return (
    <Card className="metric-card overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-xs font-medium text-muted">{title}</span>
            {tooltip && <span role="note" tabIndex={0} title={tooltip} aria-label={tooltip}
              className="shrink-0 cursor-help text-muted transition-colors hover:text-foreground focus-visible:text-foreground">
              <Info size={13} />
            </span>}
          </div>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-subtle bg-panel-raised text-muted">
            <Icon size={17} />
          </span>
        </div>
        <p className="metric-value mt-4 text-[27px] font-semibold tracking-tight tabular-nums">{value}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
          {typeof trend === "number" && (
            <span className={(trend > 0 ? "text-emerald-400" : trend < 0 ? "text-rose-400" : "text-muted") +
              " inline-flex items-center gap-1 font-semibold tabular-nums"}>
              {trend > 0 ? <ArrowUpRight size={13} /> : trend < 0 ? <ArrowDownRight size={13} /> : <span aria-hidden="true">—</span>}
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
          <span>{detail}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function OverviewDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Overview | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/v1/projects")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message || "Projects could not be loaded.");
        return (body.data?.projects ?? []) as Project[];
      })
      .then((list) => {
        if (!active) return;
        setProjects(list);
        if (list[0]) setProjectId(list[0].id);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Projects could not be loaded.");
      })
      .finally(() => { if (active) setProjectsLoaded(true); });
    return () => { active = false; };
  }, []);

  const requestKey = projectId ? projectId + ":" + days + ":" + refreshToken : "";
  const loading = Boolean(requestKey) && loadedKey !== requestKey;

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    const currentKey = projectId + ":" + days + ":" + refreshToken;
    fetch("/api/v1/analytics/overview?projectId=" + encodeURIComponent(projectId) + "&days=" + days)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error?.message || "Analytics could not be loaded.");
        return payload.data as Overview;
      })
      .then((payload) => {
        if (!active) return;
        setData(payload);
        setLastUpdated(new Date());
        setError("");
        setLoadedKey(currentKey);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Analytics could not be loaded.");
        setLoadedKey(currentKey);
      });
    return () => { active = false; };
  }, [projectId, days, refreshToken]);

  const hasChartData = Boolean(data?.series.some((point) => point.events > 0 || point.activeUsers > 0));
  const hasEvents = Boolean(data && (data.totals.events > 0 || hasChartData));

  const metrics = useMemo(() => {
    if (!data) return [];
    const change = (current: number, previous: number): number | null =>
      previous === 0 ? null : ((current - previous) / previous) * 100;
    const eventsChange = change(data.totals.events, data.previous.events);
    const usersChange = change(data.totals.activeUsers, data.previous.activeUsers);
    return [
      { title: "Total events", value: data.totals.events.toLocaleString(),
        detail: eventsChange === null ? "No previous period baseline" : "vs. previous period",
        icon: Activity, trend: eventsChange },
      { title: "Active users", value: data.totals.activeUsers.toLocaleString(),
        detail: usersChange === null ? "No previous period baseline" : "vs. previous period",
        icon: Users, trend: usersChange },
      { title: "Sessions", value: data.totals.sessions.toLocaleString(), detail: "Observed sessions",
        icon: MousePointer2, tooltip: "A session groups events that share the same session identifier." },
      { title: "Unique user-event pairs", value: data.totals.uniqueUserEvents.toLocaleString(),
        detail: "Distinct user and event combinations", icon: Zap,
        tooltip: "A pair is one distinct user combined with one event name. One user can contribute multiple pairs by triggering different event types." },
    ];
  }, [data]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-muted">Product intelligence</p>
          <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-2 text-sm text-muted">A clear view of how people experience your product.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {projects.length > 1 && <select value={projectId} onChange={(event) => setProjectId(event.target.value)}
            className="surface h-10 rounded-xl px-3 text-xs" aria-label="Select project">
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>}
          <div className="surface flex h-10 items-center gap-1 rounded-xl p-1" aria-label="Analytics date range">
            {[7, 30, 90].map((value) => <button key={value} onClick={() => setDays(value)}
              aria-pressed={days === value}
              className={(days === value ? "bg-accent-soft text-accent" : "text-muted hover:bg-panel-raised hover:text-foreground") +
                " h-8 rounded-lg px-3 text-xs font-semibold transition-colors"}>{value}d</button>)}
          </div>
          <span className="px-1 text-[10px] text-muted">
            {lastUpdated ? "Updated " + formatDistanceToNow(lastUpdated, { addSuffix: true }) : "Waiting for data"}
          </span>
          <Button variant="secondary" size="icon" aria-label="Refresh analytics" title="Refresh analytics"
            disabled={loading || !projectId} onClick={() => setRefreshToken((value) => value + 1)}>
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
      {loading && <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => <div key={item} className="surface h-32 animate-pulse rounded-2xl" />)}
      </div>}

      {!loading && data && !hasEvents && (
        <section className="rounded-2xl border border-subtle bg-panel p-5 shadow-[0_12px_36px_rgba(0,0,0,.12)] sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-subtle bg-panel-raised px-3 py-1 text-[10px] font-semibold uppercase tracking-[.14em] text-muted">
                <Code2 size={13} /> Getting started
              </div>
              <h2 className="text-lg font-semibold tracking-tight">Send your first event to unlock your analytics</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                Your workspace is ready. Connect a project and send an event; your activity, trends, and top events will appear here automatically.
              </p>
              <ol className="mt-5 grid gap-3 text-xs text-muted sm:grid-cols-3">
                <li className="flex items-start gap-2"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-panel-raised font-semibold text-foreground">1</span><span>Open Projects &amp; keys and create a publishable key.</span></li>
                <li className="flex items-start gap-2"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-panel-raised font-semibold text-foreground">2</span><span>Install and initialize the browser SDK with that key.</span></li>
                <li className="flex items-start gap-2"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-panel-raised font-semibold text-foreground">3</span><span>Call track() and refresh this page after processing.</span></li>
              </ol>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:min-w-[190px] lg:flex-col">
              <Link href="/projects"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-xs font-semibold text-[var(--accent-foreground)] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                <KeyRound size={14} /> Projects &amp; keys
              </Link>
              <a href="https://github.com/ADAMDEV01/insight-analytics/tree/main/packages/sdk#readme"
                target="_blank" rel="noreferrer"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-subtle px-4 text-xs font-semibold text-muted transition hover:bg-panel-raised hover:text-foreground">
                SDK quickstart <ExternalLink size={13} />
              </a>
            </div>
          </div>
        </section>
      )}

      {!loading && data && <>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => <Metric key={metric.title} {...metric} />)}
        </div>
        <div className="grid gap-5 pt-1 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,.8fr)]">
          <Card>
            <CardHeader>
              <div><CardTitle>Activity over time</CardTitle><p className="mt-1 text-xs text-muted">Daily events and active users</p></div>
              <span className="rounded-lg border border-subtle bg-panel-raised px-2.5 py-1 text-[10px] font-semibold text-muted">Last {days} days</span>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-[300px] w-full">
                {hasChartData ? <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.series} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="eventFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2DD4BF" stopOpacity={0.28} /><stop offset="95%" stopColor="#2DD4BF" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="usersFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#818CF8" stopOpacity={0.2} /><stop offset="95%" stopColor="#818CF8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--grid)" strokeDasharray="3 5" />
                    <XAxis dataKey="day" tickFormatter={(value) => format(new Date(value), "MMM d")}
                      tickLine={false} axisLine={false} minTickGap={30} />
                    <YAxis tickLine={false} axisLine={false} width={44} />
                    <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)",
                      borderRadius: 12, color: "var(--foreground)" }}
                      labelFormatter={(value) => format(new Date(String(value)), "PPP")} />
                    <Area type="monotone" dataKey="events" name="Events" stroke="#2DD4BF"
                      strokeWidth={2.5} fill="url(#eventFill)" activeDot={{ r: 5 }} />
                    <Area type="monotone" dataKey="activeUsers" name="Active users" stroke="#818CF8"
                      strokeWidth={2} fill="url(#usersFill)" activeDot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer> : <div className="grid h-full place-items-center px-4 text-center">
                  <div>
                    <Activity size={25} className="mx-auto text-muted" />
                    <p className="mt-3 text-sm font-medium">No activity to chart yet</p>
                    <p className="mt-1 text-xs text-muted">The chart will appear after your first events have been processed.</p>
                  </div>
                </div>}
              </div>
              {hasChartData && <div className="mt-4 flex flex-wrap items-center gap-5 text-[11px] text-muted">
                <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#2DD4BF]" />Events</span>
                <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#818CF8]" />Active users</span>
              </div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div><CardTitle>Top events</CardTitle><p className="mt-1 text-xs text-muted">Most frequent actions</p></div>
              <Activity size={17} className="text-muted" />
            </CardHeader>
            <CardContent className="pt-5">
              {data.topEvents.length ? <div className="space-y-5">
                {data.topEvents.map((event, index) => {
                  const max = data.topEvents[0]?.count || 1;
                  return <div key={event.eventName}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="truncate text-xs font-medium">{event.eventName}</span>
                      <span className="metric-value text-xs tabular-nums text-muted">{event.count.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-panel-raised">
                      <div className="h-full rounded-full bg-accent"
                        style={{ width: (event.count / max) * 100 + "%", opacity: 1 - index * 0.08 }} />
                    </div>
                  </div>;
                })}
              </div> : <div className="py-14 text-center">
                <Zap size={22} className="mx-auto text-muted" />
                <p className="mt-3 text-sm font-medium">Nothing to rank yet</p>
                <p className="mt-1 text-xs text-muted">Your most-used events will appear here after ingestion.</p>
                <Link href="/projects" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-accent underline-offset-4 hover:underline">
                  Create an API key <KeyRound size={13} />
                </Link>
              </div>}
            </CardContent>
          </Card>
        </div>
      </>}

      {projectsLoaded && projects.length === 0 && !error && <Card className="p-9 text-center">
        <KeyRound size={24} className="mx-auto text-muted" />
        <h2 className="mt-3 text-sm font-semibold">Create your first project</h2>
        <p className="mt-1 text-xs text-muted">Create a project and publishable key before sending events.</p>
        <Link href="/projects" className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-xs font-semibold text-[var(--accent-foreground)] transition hover:brightness-110">
          Open Projects &amp; keys <KeyRound size={14} />
        </Link>
      </Card>}
    </div>
  );
}
