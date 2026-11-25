"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Copy, FolderPlus, KeyRound, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Project = { id: string; name: string; slug: string; description: string | null; createdAt: string };
type ApiKey = { id: string; name: string; prefix: string; allowedOrigins: string[]; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };

export function ProjectManager() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [keyName, setKeyName] = useState("Browser SDK");
  const [allowedOrigins, setAllowedOrigins] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [selectedProject, setSelectedProject] = useState("");

  async function loadProjects() {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/projects");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Could not load projects.");
      const list = body.data.projects as Project[];
      setProjects(list);
      setSelectedProject((current) => list.some((item) => item.id === current) ? current : list[0]?.id || "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load projects.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/v1/projects")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message || "Could not load projects.");
        return body.data.projects as Project[];
      })
      .then((list) => {
        if (!active) return;
        setProjects(list);
        setSelectedProject(list[0]?.id || "");
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (active) {
          toast.error(error instanceof Error ? error.message : "Could not load projects.");
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    let active = true;
    fetch("/api/v1/api-keys?projectId=" + encodeURIComponent(selectedProject))
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message || "Could not load API keys.");
        return body.data.keys as ApiKey[];
      })
      .then((data) => { if (active) setKeys(data); })
      .catch((error: unknown) => {
        if (active) toast.error(error instanceof Error ? error.message : "Could not load API keys.");
      });
    return () => { active = false; };
  }, [selectedProject]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/v1/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Project creation failed.");
      setName("");
      setDescription("");
      await loadProjects();
      toast.success("Project created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Project creation failed.");
    } finally {
      setSaving(false);
    }
  }

  async function createKey() {
    if (!selectedProject) return;
    setSaving(true);
    try {
      const origins = allowedOrigins.split(",").map((value) => value.trim()).filter(Boolean);
      const response = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProject, name: keyName, allowedOrigins: origins }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Key creation failed.");
      setApiKey(body.data.key);
      setAllowedOrigins("");
      const refreshed = await fetch("/api/v1/api-keys?projectId=" + encodeURIComponent(selectedProject));
      const refreshedBody = await refreshed.json();
      if (refreshed.ok) setKeys(refreshedBody.data.keys);
      toast.success("Publishable key created. Copy it now; it will not be shown again.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Key creation failed.");
    } finally {
      setSaving(false);
    }
  }

  async function revokeKey(keyId: string) {
    if (!window.confirm("Revoke this key? New events using it will be rejected immediately.")) return;
    try {
      const response = await fetch("/api/v1/api-keys?keyId=" + encodeURIComponent(keyId), { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Key revocation failed.");
      const refreshed = await fetch("/api/v1/api-keys?projectId=" + encodeURIComponent(selectedProject));
      const refreshedBody = await refreshed.json();
      if (refreshed.ok) setKeys(refreshedBody.data.keys);
      toast.success("API key revoked.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Key revocation failed.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-accent">Manage data sources</p>
        <h1 className="text-3xl font-semibold tracking-tight">Projects & keys</h1>
        <p className="mt-2 text-sm text-muted">Create projects and manage publishable keys for event collection.</p>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <Card className="p-5">
          <div className="mb-5 flex items-center justify-between">
            <div><h2 className="text-sm font-semibold">Your projects</h2><p className="mt-1 text-xs text-muted">Projects belong to your current workspace.</p></div>
            <button onClick={() => void loadProjects()} className="text-muted" aria-label="Refresh projects"><RefreshCw size={15} /></button>
          </div>
          {loading ? <div className="space-y-3">{[1,2].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-panel-raised" />)}</div> : (
            <div className="space-y-2">
              {projects.map((project) => (
                <button key={project.id} onClick={() => { setSelectedProject(project.id); setApiKey(""); setKeys([]); }} className={(selectedProject === project.id ? "border-accent bg-accent-soft" : "border-subtle bg-panel-raised") + " flex w-full items-center gap-3 rounded-xl border p-3 text-left"}>
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-background text-accent"><FolderPlus size={17} /></div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{project.name}</p><p className="truncate text-[11px] text-muted">{project.description || project.slug}</p></div>
                  <span className="text-[10px] text-muted">{new Date(project.createdAt).toLocaleDateString()}</span>
                </button>
              ))}
              {projects.length === 0 && <p className="rounded-xl bg-panel-raised px-4 py-8 text-center text-sm text-muted">No projects yet. Create one below.</p>}
            </div>
          )}
          <form onSubmit={createProject} className="mt-6 space-y-3 border-t border-subtle pt-5">
            <p className="text-xs font-semibold">Create a project</p>
            <input required minLength={2} maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Marketing website" className="surface-raised h-10 w-full rounded-xl px-3 text-sm outline-none focus:border-accent" />
            <input maxLength={200} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What are you measuring? (optional)" className="surface-raised h-10 w-full rounded-xl px-3 text-sm outline-none focus:border-accent" />
            <Button type="submit" disabled={saving || !name.trim()}><Plus size={15} />Create project</Button>
          </form>
        </Card>

        <Card className="p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><KeyRound size={18} /></div>
            <div><h2 className="text-sm font-semibold">Publishable keys</h2><p className="mt-1 text-xs text-muted">Keys used by your website SDK.</p></div>
          </div>
          <label className="mb-2 block text-xs font-medium text-muted">Project</label>
          <select value={selectedProject} onChange={(event) => { setSelectedProject(event.target.value); setApiKey(""); setKeys([]); }} className="surface-raised mb-4 h-10 w-full rounded-xl px-3 text-sm">
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <label className="mb-2 block text-xs font-medium text-muted">Key label</label>
          <input value={keyName} onChange={(event) => setKeyName(event.target.value)} maxLength={50} className="surface-raised h-10 w-full rounded-xl px-3 text-sm outline-none" />
          <label className="mb-2 mt-4 block text-xs font-medium text-muted">Allowed origins (comma-separated, optional)</label>
          <input value={allowedOrigins} onChange={(event) => setAllowedOrigins(event.target.value)} placeholder="https://example.com, http://localhost:3000" className="surface-raised h-10 w-full rounded-xl px-3 text-sm outline-none" />
          <Button onClick={() => void createKey()} disabled={saving || !selectedProject || !keyName.trim()} className="mt-4 w-full"><KeyRound size={15} />Generate key</Button>

          {apiKey && (
            <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3">
              <p className="text-xs font-semibold text-emerald-400">Copy this key now</p>
              <p className="mt-1 break-all font-mono text-xs text-foreground">{apiKey}</p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => { void navigator.clipboard.writeText(apiKey); toast.success("Key copied."); }}><Copy size={13} />Copy key</Button>
              <p className="mt-2 text-[10px] leading-4 text-muted">The full key is shown once. It is publishable by design, not a server secret.</p>
            </div>
          )}

          <div className="mt-6 border-t border-subtle pt-5">
            <div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold">Issued keys</p><span className="text-[10px] text-muted">{keys.length} total</span></div>
            {keys.length ? <div className="space-y-2">
              {keys.map((key) => <div key={key.id} className="surface-raised flex items-center gap-3 rounded-xl p-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-background text-muted">{key.revokedAt ? <Trash2 size={14} /> : <ShieldCheck size={15} className="text-emerald-400" />}</div>
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{key.name}</p><p className="mt-1 truncate font-mono text-[10px] text-muted">{key.prefix}••• · {key.revokedAt ? "Revoked" : key.lastUsedAt ? "Recently used " + new Date(key.lastUsedAt).toLocaleDateString() : "Not used yet"}</p></div>
                {!key.revokedAt && <button onClick={() => void revokeKey(key.id)} className="text-xs font-semibold text-rose-400 hover:text-rose-300">Revoke</button>}
              </div>)}
            </div> : <p className="rounded-xl bg-panel-raised p-4 text-xs text-muted">No keys have been issued for this project.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
