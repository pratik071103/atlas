import { NextResponse } from "next/server";
import { getCollections } from "@/lib/db";
import { fail } from "@/lib/http";

// ---------------------------------------------------------------------------
// GET /api/webhooks/events — dev-only webhook inspector feed.
//
// The receiving endpoint lives inside Better Auth, mounted by the Dodo adapter
// at POST /api/auth/dodopayments/webhooks; signature verification and dispatch
// happen there. This is the read-only audit view behind /dev/webhooks: point a
// tunnel at the app, buy something, and watch the events land.
//
// Webhook bodies carry customer emails and payment ids, so this is refused
// outside development.
// ---------------------------------------------------------------------------

const EVENT_LIMIT = 50;
const PAYLOAD_PREVIEW_CHARS = 600;

export async function GET() {
  if (process.env.NODE_ENV === "production") return fail("Not found.", 404);

  const c = await getCollections();
  const rows = await c.webhookEvents
    .find({})
    .sort({ createdAt: -1, _id: -1 })
    .limit(EVENT_LIMIT)
    .toArray();

  return NextResponse.json({
    events: rows.map((r) => ({
      id: r._id,
      eventType: r.eventType,
      status: r.status,
      eventId: r.eventId,
      createdAt: r.createdAt.toISOString(),
      payloadPreview: JSON.stringify(r.payload, null, 2).slice(0, PAYLOAD_PREVIEW_CHARS),
    })),
  });
}
