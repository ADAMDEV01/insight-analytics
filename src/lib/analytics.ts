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
