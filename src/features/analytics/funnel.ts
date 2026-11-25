export interface FunnelEvent { distinctId: string; eventName: string; occurredAt: Date | string; }
export interface FunnelStepResult { eventName: string; users: number; conversionFromPrevious: number; dropOff: number; }

export function computeFunnel(events: FunnelEvent[], steps: string[]): FunnelStepResult[] {
  if (steps.length < 2 || steps.length > 8) throw new Error("A funnel must contain between 2 and 8 steps.");
  const timelines = new Map<string, FunnelEvent[]>();
  for (const event of events) { const current = timelines.get(event.distinctId) ?? []; current.push(event); timelines.set(event.distinctId, current); }
  const reached = steps.map(() => new Set<string>());
  for (const [distinctId, timeline] of timelines) {
    timeline.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
    let cursor = -1;
    for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
      const nextIndex = timeline.findIndex((event, index) => index > cursor && event.eventName === steps[stepIndex]);
      if (nextIndex < 0) break;
      reached[stepIndex].add(distinctId);
      cursor = nextIndex;
    }
  }
  return steps.map((eventName, index) => {
    const users = reached[index].size;
    const previous = index === 0 ? users : reached[index - 1].size;
    return { eventName, users, conversionFromPrevious: previous === 0 ? 0 : Number(((users / previous) * 100).toFixed(1)), dropOff: previous === 0 ? 0 : Number((((previous - users) / previous) * 100).toFixed(1)) };
  });
}
