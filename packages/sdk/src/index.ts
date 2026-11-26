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

const MAX_QUEUE_EVENTS = 1000;
const MAX_BATCH_EVENTS = 100;
const MAX_BATCH_BYTES = 220_000;
const MAX_PROPERTIES_BYTES = 20_000;
const encoder = new TextEncoder();

function createSecureId(): string {
  const crypto = globalThis.crypto;
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  if (typeof crypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  throw new Error("INSIGHT requires secure browser cryptography to generate event identifiers.");
}

export function createInsight(options: InsightOptions): InsightClient {
  if (!options.apiKey.startsWith("ia_pub_")) {
    throw new Error("INSIGHT requires a publishable project key.");
  }

  const endpoint = options.endpoint.replace(/\/$/, "") + "/api/v1/ingest";
  const fetcher = options.fetcher || fetch;
  const flushAt = Math.max(1, Math.min(MAX_BATCH_EVENTS, options.flushAt ?? 10));
  const flushIntervalMs = Math.max(1000, options.flushIntervalMs ?? 5000);
  let distinctId = "anonymous";
  const sessionId = createSecureId();
  let queue: InsightEvent[] = [];
  let inFlightCount = 0;
  let flushing: Promise<void> | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;

  function takeBatch() {
    const batch: InsightEvent[] = [];
    const serializedEvents: string[] = [];
    let bodyBytes = encoder.encode('{"events":[]}').byteLength;

    while (queue.length > 0 && batch.length < MAX_BATCH_EVENTS) {
      const next = queue[0];
      const serialized = JSON.stringify(next);
      if (serialized === undefined) {
        throw new Error("INSIGHT could not serialize a queued event.");
      }
      const nextBytes =
        bodyBytes + encoder.encode(serialized).byteLength + (batch.length > 0 ? 1 : 0);

      if (nextBytes > MAX_BATCH_BYTES && batch.length > 0) break;
      if (nextBytes > MAX_BATCH_BYTES) {
        throw new Error("A single INSIGHT event exceeds the safe request size.");
      }

      queue.shift();
      batch.push(next);
      serializedEvents.push(serialized);
      bodyBytes = nextBytes;
    }

    return {
      batch,
      body: '{"events":[' + serializedEvents.join(",") + "]}",
    };
  }

  async function flush(): Promise<void> {
    if (flushing) {
      await flushing;
      if (queue.length > 0) await flush();
      return;
    }
    if (queue.length === 0) return;

    const { batch, body } = takeBatch();
    if (batch.length === 0) return;
    inFlightCount = batch.length;

    const request = (async () => {
      try {
        const response = await fetcher(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + options.apiKey,
          },
          body,
          keepalive: encoder.encode(body).byteLength <= 60000,
        });
        if (!response.ok) {
          throw new Error("INSIGHT ingestion returned HTTP " + response.status);
        }
        inFlightCount = 0;
      } catch (error) {
        // Retain the original idempotency keys so a retry cannot double-count events.
        queue = batch.concat(queue);
        inFlightCount = 0;
        throw error;
      }
    })();

    flushing = request;
    try {
      await request;
    } finally {
      if (flushing === request) flushing = null;
    }
    if (queue.length > 0) await flush();
  }

  function identify(value: string) {
    if (!value || !value.trim() || value.length > 160) {
      throw new Error("distinctId must contain 1 to 160 characters.");
    }
    distinctId = value;
  }

  function track(eventName: string, properties: Record<string, unknown> = {}) {
    if (!/^[a-zA-Z0-9_.:-]{1,120}$/.test(eventName)) {
      throw new Error("Invalid INSIGHT event name.");
    }
    if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
      throw new Error("Event properties must be a JSON-serializable object.");
    }

    let safeProperties: Record<string, unknown>;
    try {
      const serialized = JSON.stringify(properties);
      if (serialized === undefined || encoder.encode(serialized).byteLength > MAX_PROPERTIES_BYTES) {
        throw new Error("Event properties exceed the 20 KB limit.");
      }
      const parsed: unknown = JSON.parse(serialized);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Event properties must be a JSON object.");
      }
      safeProperties = parsed as Record<string, unknown>;
    } catch {
      throw new Error("Event properties must be a JSON-serializable object under 20 KB.");
    }

    if (queue.length + inFlightCount >= MAX_QUEUE_EVENTS) {
      throw new Error("INSIGHT event queue is full. Flush successfully before tracking more events.");
    }

    queue.push({
      eventName,
      distinctId,
      sessionId,
      properties: safeProperties,
      timestamp: new Date().toISOString(),
      idempotencyKey: createSecureId(),
    });

    if (queue.length >= flushAt && !flushing) void flush().catch(() => undefined);
  }

  if (typeof window !== "undefined") {
    timer = setInterval(() => { void flush().catch(() => undefined); }, flushIntervalMs);
  }

  return {
    identify,
    track,
    flush,
    async shutdown() {
      if (timer) clearInterval(timer);
      await flush();
    },
  };
}
