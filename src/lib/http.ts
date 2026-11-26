import { NextResponse } from "next/server";
import { readBoundedText } from "@/lib/read-bounded-text";

const MAX_JSON_BODY_BYTES = 64 * 1024;
const PRIVATE_RESPONSE_HEADERS = { "Cache-Control": "private, no-store" };

export function apiError(message: string, status = 400, code = "BAD_REQUEST") {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: PRIVATE_RESPONSE_HEADERS },
  );
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(
    { data },
    { status, headers: PRIVATE_RESPONSE_HEADERS },
  );
}

export async function readJson<T = unknown>(request: Request): Promise<T | null> {
  try {
    const text = await readBoundedText(request, MAX_JSON_BODY_BYTES);
    if (text === null) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
