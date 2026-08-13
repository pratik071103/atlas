import { NextResponse } from "next/server";
import { withIdentity } from "@/lib/http";
import { listUsageEvents } from "@/lib/services/usage";

// GET /api/usage/events — the live event log behind the dashboard panel.
export async function GET() {
  return withIdentity(async (identity) => {
    return NextResponse.json({ events: await listUsageEvents(identity.userId) });
  });
}
