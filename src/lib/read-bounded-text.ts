/**
 * Read a Request body as UTF-8 while enforcing a byte limit during streaming.
 * Returns null when the body exceeds the limit. This avoids request.text()
 * buffering an arbitrarily large payload before the limit is checked.
 */
export async function readBoundedText(
  request: Request,
  maxBytes: number,
): Promise<string | null> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError("maxBytes must be a non-negative safe integer.");
  }

  const reader = request.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder("utf-8");
  let bytesRead = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
      }

      text += decoder.decode(value, { stream: true });
    }

    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
