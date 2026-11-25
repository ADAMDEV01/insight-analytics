import { db } from "@/db";
import { eventOutbox, events } from "@/db/schema";

export interface IncomingEvent {
  eventName: string;
  distinctId: string;
  sessionId?: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
  idempotencyKey: string;
}

export async function persistEventBatch(projectId: string, input: IncomingEvent[]) {
  if (input.length === 0) return { accepted: 0, duplicates: 0 };

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(events)
      .values(input.map((item) => ({
        projectId,
        eventName: item.eventName,
        distinctId: item.distinctId,
        sessionId: item.sessionId || null,
        properties: item.properties ?? {},
        occurredAt: item.timestamp ? new Date(item.timestamp) : new Date(),
        idempotencyKey: item.idempotencyKey,
      })))
      .onConflictDoNothing({ target: [events.projectId, events.idempotencyKey] })
      .returning({ id: events.id });

    if (inserted.length > 0) {
      await tx.insert(eventOutbox).values(inserted.map(({ id }) => ({ eventId: id })));
    }

    return { accepted: inserted.length, duplicates: input.length - inserted.length };
  });
}
