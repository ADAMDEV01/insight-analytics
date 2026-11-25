"use client";

import { useEffect, useState, type FormEvent } from "react";
import { FileBarChart2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Project = { id: string; name: string };
type Report = { id: string; name: string; description: string | null; createdAt: string };

export function ReportsManager() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/projects")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message || "Projects could not be loaded.");
        const list = body.data.projects as Project[];
        setProjects(list);
        if (list[0]) setProjectId(list[0].id);
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Projects could not be loaded."));
  }, []);

  async function load(id: string) {
    if (!id) return;
    try {
      const response = await fetch("/api/v1/reports?projectId=" + encodeURIComponent(id));
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Reports could not be loaded.");
      setReports(body.data.reports);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reports could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(projectId); }, [projectId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/v1/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, name, description, configuration: { view: "overview", rangeDays: 30 } }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Report could not be saved.");
      setName("");
      setDescription("");
      await load(projectId);
      toast.success("Report saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Report could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div><p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-accent">Reusable analysis</p><h1 className="text-3xl font-semibold tracking-tight">Saved reports</h1><p className="mt-2 text-sm text-muted">Keep named snapshots of the analysis you return to.</p></div>
      <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <Card className="p-5">
          <div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><Save size={18} /></span><div><h2 className="text-sm font-semibold">Save a report</h2><p className="mt-1 text-xs text-muted">Reports are persisted in your workspace.</p></div></div>
          <form onSubmit={save} className="space-y-3">
            <label className="block text-xs font-medium text-muted">Project</label>
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="surface-raised h-10 w-full rounded-xl px-3 text-sm">{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
            <label className="block text-xs font-medium text-muted">Report name</label>
            <input required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className="surface-raised h-10 w-full rounded-xl px-3 text-sm outline-none" placeholder="Weekly activation review" />
            <label className="block text-xs font-medium text-muted">Description</label>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={240} rows={3} className="surface-raised w-full rounded-xl px-3 py-2 text-sm outline-none" placeholder="What question does this report answer?" />
            <Button type="submit" disabled={loading || !projectId || !name.trim()}><Plus size={15} />Save report</Button>
          </form>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Your saved reports</h2><p className="mt-1 text-xs text-muted">Stored in PostgreSQL and scoped to your project.</p></div><FileBarChart2 size={18} className="text-muted" /></div>
          {loading ? <div className="mt-5 h-32 animate-pulse rounded-xl bg-panel-raised" /> : reports.length ? (
            <div className="mt-5 space-y-2">{reports.map((report) => <div key={report.id} className="surface-raised flex items-center gap-3 rounded-xl p-4"><span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-accent"><FileBarChart2 size={16} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{report.name}</p><p className="mt-1 truncate text-xs text-muted">{report.description || "Overview · 30-day range"}</p></div><span className="shrink-0 text-[10px] text-muted">{new Date(report.createdAt).toLocaleDateString()}</span></div>)}</div>
          ) : <div className="grid min-h-[280px] place-items-center text-center"><div><FileBarChart2 size={26} className="mx-auto text-muted" /><p className="mt-3 text-sm font-semibold">No saved reports</p><p className="mt-1 text-xs text-muted">Save your first analysis to see it here.</p></div></div>}
        </Card>
      </div>
    </div>
  );
}
