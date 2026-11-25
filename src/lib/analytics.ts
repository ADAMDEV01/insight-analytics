export function normalizeDateRange(days: number) {
  const safeDays = Math.min(90, Math.max(1, Math.floor(days)));
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (safeDays - 1));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), days: safeDays };
}
export function toIsoDay(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}
