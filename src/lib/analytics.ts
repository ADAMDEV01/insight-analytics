export function normalizeDateRange(days: number) {
  const requested = Number.isFinite(days) ? Math.floor(days) : 30;
  const safeDays = Math.min(90, Math.max(1, requested));
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (safeDays - 1));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    days: safeDays,
  };
}

export interface DailySeriesPoint {
  day: string;
  events: number;
  activeUsers: number;
}

export function buildDailySeries(
  from: string,
  days: number,
  eventRows: Array<{ day: string; events: number }>,
  userRows: Array<{ day: string; users: number }>,
): DailySeriesPoint[] {
  if (!isIsoDateString(from)) throw new Error("Invalid series start date.");

  const safeDays = Number.isFinite(days) ? Math.min(90, Math.max(1, Math.floor(days))) : 30;
  const start = new Date(from + "T00:00:00.000Z");
  const points = Array.from({ length: safeDays }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    return { day: date.toISOString().slice(0, 10), events: 0, activeUsers: 0 };
  });
  const byDay = new Map(points.map((point) => [point.day, point]));

  for (const row of eventRows) {
    const point = byDay.get(row.day);
    if (point) point.events = Number(row.events) || 0;
  }
  for (const row of userRows) {
    const point = byDay.get(row.day);
    if (point) point.activeUsers = Number(row.users) || 0;
  }

  return points;
}

export function toIsoDay(value: Date | string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid date.");
  return date.toISOString().slice(0, 10);
}

export function isIsoDateString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
