import { describe, expect, it } from "vitest";
import { readBoundedText } from "./read-bounded-text";

function requestFromChunks(chunks: Uint8Array[]): Request {
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index]);
        index += 1;
      } else {
        controller.close();
      }
    },
  });

  // Node's Fetch implementation requires duplex="half" for stream request bodies.
  const init = { method: "POST", body, duplex: "half" } as RequestInit;
  return new Request("http://localhost/api/v1/ingest", init);
}

describe("readBoundedText", () => {
  it("reads a chunked request body when Content-Length is absent", async () => {
    const request = requestFromChunks([
      new TextEncoder().encode('{"events":'),
      new TextEncoder().encode("[]}"),
    ]);

    expect(request.headers.get("content-length")).toBeNull();
    await expect(readBoundedText(request, 64)).resolves.toBe('{"events":[]}');
  });

  it("rejects a streamed body that exceeds the byte limit", async () => {
    const request = requestFromChunks([
      new Uint8Array([1, 2]),
      new Uint8Array([3]),
    ]);

    await expect(readBoundedText(request, 2)).resolves.toBeNull();
  });

  it("counts UTF-8 bytes and preserves a multibyte character split between chunks", async () => {
    const encoded = new TextEncoder().encode("é");
    const request = requestFromChunks([encoded.subarray(0, 1), encoded.subarray(1)]);

    await expect(readBoundedText(request, 2)).resolves.toBe("é");
    const tooSmall = requestFromChunks([encoded.subarray(0, 1), encoded.subarray(1)]);
    await expect(readBoundedText(tooSmall, 1)).resolves.toBeNull();
  });

  it("returns an empty string when the request has no body", async () => {
    const request = new Request("http://localhost/api/v1/ingest", { method: "POST" });
    await expect(readBoundedText(request, 64)).resolves.toBe("");
  });

  it("rejects invalid byte limits", async () => {
    const request = new Request("http://localhost/api/v1/ingest", { method: "POST" });
    await expect(readBoundedText(request, Number.POSITIVE_INFINITY)).rejects.toThrow(RangeError);
  });
});
