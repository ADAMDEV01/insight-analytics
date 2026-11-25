export interface InsightEvent {
  eventName: string;
  distinctId: string;
  sessionId?: string;
  properties?: Record<string, unknown>;
  timestamp: string;
  idempotencyKey: string;
}
export interface InsightOptions {
  apiKey: string;
  endpoint: string;
  flushAt?: number;
  flushIntervalMs?: number;
  fetcher?: typeof fetch;
}
export interface InsightClient {
  identify(distinctId: string): void;
  track(eventName: string, properties?: Record<string, unknown>): void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

export function createInsight(options: InsightOptions): InsightClient {
  if (!options.apiKey.startsWith("ia_pub_")) throw new Error("INSIGHT requires a publishable project key.");
  const endpoint = options.endpoint.replace(/\\/$/, "") + "/api/v1/ingest";
  const fetcher = options.fetcher || fetch;
  const flushAt = Math.max(1, Math.min(100, options.flushAt ?? 10));
  let distinctId = "anonymous";
  let sessionId = globalThis.crypto?.randomUUID?.() || String(Date.now());
  let queue: InsightEvent[] = [];
  let flushing: Promise<void> | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;

  async function flush() {
    if (flushing) return flushing;
    if (queue.length === 0) return;
    const batch = queue.splice(0, 100);
    flushing = (async () => {
      try {
        const response = await fetcher(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + options.apiKey },
          body: JSON.stringify({ events: batch }),
          keepalive: true,
        });
        if (!response.ok) throw new Error("INSIGHT ingestion returned HTTP " + response.status);
      } catch (error) {
        queue = batch.concat(queue).slice(0, 1000);
        throw error;
      } finally {
        flushing = null;
      }
    })();
    return flushing;
  }

  function identify(value: string) {
    if (!value || value.length > 160) throw new Error("distinctId must contain 1 to 160 characters.");
    distinctId = value;
  }

  function track(eventName: string, properties: Record<string, unknown> = {}) {
    if (!/^[a-zA-Z0-9_.:-]{1,120}$/.test(eventName)) throw new Error("Invalid INSIGHT event name.");
    let safeProperties: Record<string, unknown>;
    try {
      const serialized = JSON.stringify(properties);
      if (serialized === undefined || serialized.length > 20000) throw new Error("Event properties exceed the 20 KB limit.");
      safeProperties = JSON.parse(serialized) as Record<string, unknown>;
    } catch {
      throw new Error("Event properties must be a JSON-serializable object under 20 KB.");
    }
    queue.push({ eventName, distinctId, sessionId, properties: safeProperties, timestamp: new Date().toISOString(), idempotencyKey: globalThis.crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2)) });
    if (queue.length >= flushAt) void flush().catch(() => undefined);
  }

  if (typeof window !== "undefined") timer = setInterval(() => { void flush().catch(() => undefined); }, options.flushIntervalMs ?? 5000);
  return {
    identify,
    track,
    flush,
    async shutdown() { if (timer) clearInterval(timer); await flush(); },
  };
}
