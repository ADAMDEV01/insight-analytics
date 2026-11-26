import { describe, expect, it } from "vitest";
import { createInsight } from "../../packages/sdk/src/index";

const apiKey = "ia_pub_" + "a".repeat(32);

describe("INSIGHT browser SDK", () => {
  it("splits large queues into requests below the ingestion byte and event limits", async () => {
    const bodies: string[] = [];
    const client = createInsight({
      apiKey,
      endpoint: "https://insight.example",
      flushAt: 100,
      fetcher: async (_input, init) => {
        bodies.push(String(init?.body ?? ""));
        return new Response(null, { status: 202 });
      },
    });

    for (let index = 0; index < 20; index += 1) {
      client.track("large_payload", { index, description: "x".repeat(15_000) });
    }
    await client.flush();

    expect(bodies.length).toBeGreaterThan(1);
    const sent = bodies.flatMap((body) => {
      expect(new TextEncoder().encode(body).byteLength).toBeLessThanOrEqual(220_000);
      const payload = JSON.parse(body) as { events: unknown[] };
      expect(payload.events.length).toBeLessThanOrEqual(100);
      return payload.events;
    });
    expect(sent).toHaveLength(20);
  });

  it("requeues failed batches with their original idempotency keys", async () => {
    const bodies: string[] = [];
    let attempts = 0;
    const client = createInsight({
      apiKey,
      endpoint: "https://insight.example",
      fetcher: async (_input, init) => {
        bodies.push(String(init?.body ?? ""));
        attempts += 1;
        if (attempts === 1) throw new Error("temporary network failure");
        return new Response(null, { status: 202 });
      },
    });

    client.track("page_view", { path: "/pricing" });
    await expect(client.flush()).rejects.toThrow("temporary network failure");
    await client.flush();

    const firstEvent = (JSON.parse(bodies[0]) as { events: Array<{ idempotencyKey: string }> }).events[0];
    const retriedEvent = (JSON.parse(bodies[1]) as { events: Array<{ idempotencyKey: string }> }).events[0];
    expect(retriedEvent.idempotencyKey).toBe(firstEvent.idempotencyKey);
  });

  it("rejects non-object and oversized event properties before queueing", () => {
    const client = createInsight({
      apiKey,
      endpoint: "https://insight.example",
      fetcher: async () => new Response(null, { status: 202 }),
    });

    expect(() => client.track("invalid", [] as unknown as Record<string, unknown>))
      .toThrow("Event properties must be a JSON-serializable object.");
    expect(() => client.track("oversized", { value: "x".repeat(20_001) }))
      .toThrow("Event properties must be a JSON-serializable object under 20 KB.");
    expect(() => client.identify("   ")).toThrow("distinctId must contain 1 to 160 characters.");
  });
});
