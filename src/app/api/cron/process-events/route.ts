import { NextResponse } from "next/server";
import { verifySecret } from "@/lib/crypto";
import { processOutboxBatch } from "@/lib/process-outbox";

export const runtime = "nodejs";
export const maxDuration = 60;

async function process(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") || "";
  if (!secret || !verifySecret(secret, authorization.replace(/^Bearer /, ""))) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid cron credential." } },
      { status: 401 },
    );
  }

  try {
    const result = await processOutboxBatch(250);
    return NextResponse.json({ data: result });
  } catch {
    return NextResponse.json(
      { error: { code: "PROCESSOR_FAILED", message: "The event batch was rolled back and can be retried." } },
      { status: 500 },
    );
  }
}

export const GET = process;
export const POST = process;
