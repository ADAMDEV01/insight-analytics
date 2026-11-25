import { NextResponse } from "next/server";
import { pool } from "@/db";
import { verifySecret } from "@/lib/crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

async function process(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") || "";
  if (!secret || !verifySecret(secret, authorization.replace(/^Bearer /, ""))) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid cron credential." } }, { status: 401 });
  }
  const client = await pool.connect();
  let processed = 0;
  let retried = 0;
  let failed = 0;
  try {
    await client.query("BEGIN");
    const pending = await client.query(
      "SELECT o.id AS outbox_id, e.id AS event_id, e.project_id, e.event_name, e.distinct_id, e.occurred_at::date AS bucket_date FROM event_outbox o INNER JOIN events e ON e.id=o.event_id WHERE o.processed_at IS NULL AND o.failed_at IS NULL AND o.available_at<=NOW() ORDER BY o.created_at FOR UPDATE OF o SKIP LOCKED LIMIT 250",
    );
    for (const event of pending.rows) {
      await client.query("SAVEPOINT insight_event");
      try {
        await client.query(
          "INSERT INTO daily_rollups (project_id,bucket_date,event_name,event_count,unique_users) VALUES ($1,$2::date,$3,1,0) ON CONFLICT (project_id,bucket_date,event_name) DO UPDATE SET event_count=daily_rollups.event_count+1",
          [event.project_id, event.bucket_date, event.event_name],
        );
        const eventUser = await client.query(
          "INSERT INTO daily_event_users (project_id,bucket_date,event_name,distinct_id) VALUES ($1,$2::date,$3,$4) ON CONFLICT DO NOTHING RETURNING id",
          [event.project_id, event.bucket_date, event.event_name, event.distinct_id],
        );
        if (eventUser.rowCount) {
          await client.query("UPDATE daily_rollups SET unique_users=unique_users+1 WHERE project_id=$1 AND bucket_date=$2::date AND event_name=$3", [event.project_id, event.bucket_date, event.event_name]);
        }
        await client.query(
          "INSERT INTO daily_project_users (project_id,bucket_date,distinct_id) VALUES ($1,$2::date,$3) ON CONFLICT DO NOTHING",
          [event.project_id, event.bucket_date, event.distinct_id],
        );
        await client.query("UPDATE event_outbox SET processed_at=NOW(),last_error=NULL WHERE id=$1", [event.outbox_id]);
        await client.query("RELEASE SAVEPOINT insight_event");
        processed += 1;
      } catch (error) {
        await client.query("ROLLBACK TO SAVEPOINT insight_event");
        const message = error instanceof Error ? error.message.slice(0, 1000) : "Unknown processing error";
        const result = await client.query(
          "UPDATE event_outbox SET attempts=attempts+1,last_error=$2,available_at=NOW()+(LEAST(POWER(2,attempts+1),3600)*INTERVAL '1 second'),failed_at=CASE WHEN attempts+1>=8 THEN NOW() ELSE NULL END WHERE id=$1 RETURNING failed_at",
          [event.outbox_id, message],
        );
        if (result.rows[0]?.failed_at) failed += 1; else retried += 1;
        await client.query("RELEASE SAVEPOINT insight_event");
      }
    }
    await client.query("COMMIT");
    return NextResponse.json({ data: { claimed: pending.rows.length, processed, retried, failed } });
  } catch {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: { code: "PROCESSOR_FAILED", message: "The event batch was rolled back and can be retried." } }, { status: 500 });
  } finally {
    client.release();
  }
}
export const GET = process;
export const POST = process;
