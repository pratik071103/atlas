import { NextResponse } from "next/server";
import type { IngestStatus } from "@/lib/db";
import { fail, readJson, withIdentity } from "@/lib/http";
import { markIngestResult } from "@/lib/services/usage";

const STATUSES: IngestStatus[] = ["pending", "ok", "simulated", "failed"];

// PATCH /api/usage/:eventId
//
// Records how the browser's authClient.dodopayments.usage.ingest() call went.
// Ingestion is deliberately done from the client — that is the adapter's usage
// plugin doing the work — so the outcome has to come back here to be shown in
// the event log.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;

  return withIdentity(async (identity) => {
    const body = await readJson<{ status?: string; message?: string }>(request);
    const status = body.status as IngestStatus;
    if (!STATUSES.includes(status)) return fail("Unknown ingest status.", 400);

    const event = await markIngestResult(
      identity.userId,
      eventId,
      status,
      body.message?.slice(0, 300) ?? null
    );
    if (!event) return fail("Usage event not found.", 404);

    return NextResponse.json({ event });
  });
}
