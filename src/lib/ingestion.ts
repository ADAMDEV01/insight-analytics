import { db } from "@/db";
import { eventOutbox, events } from "@/db/schema";

export interface IncomingEvent { eventName: string; distinctId: string; sessionId?: string; properties?: Record<string, unknown>; timestamp?: string; idempotencyKey: string; }

export async function persistEventBatch(projectId: string, input: IncomingEvent[]) {
  return db.transaction(async (tx) => {
    let accepted = 0;
    let duplicates = 0;
    for (const item of input) {
      const [inserted] = await tx.insert(events).values({
        projectId, eventName: item.eventName, distinctId: item.distinctId, sessionId: item.sessionId || null,
        properties: item.properties ?? {}, occurredAt: item.timestamp ? new Date(item.timestamp) : new Date(), idempotencyKey: item.idempotencyKey,
      }).onConflictDoNothing({ target: [events.projectId, events.idempotencyKey] }).returning({ id: events.id });
      if (!inserted) { duplicates += 1; continue; }
      await tx.insert(eventOutbox).values({ eventId: inserted.id });
      accepted += 1;
    }
    return { accepted, duplicates };
  });
}
