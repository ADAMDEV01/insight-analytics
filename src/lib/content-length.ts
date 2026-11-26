/**
 * Parse an HTTP Content-Length header without accepting signs, whitespace,
 * decimals, or values outside JavaScript's safe integer range.
 *
 * undefined means the header is absent; null means it is malformed.
 */
export function parseContentLength(value: string | null): number | null | undefined {
  if (value === null) return undefined;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
