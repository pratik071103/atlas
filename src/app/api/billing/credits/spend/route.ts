import { NextResponse } from "next/server";
import { findPlaygroundAction } from "@shared/playground";
import { fail, readJson, withIdentity } from "@/lib/http";
import { runPlaygroundAction } from "@/lib/services/usage";
import { getWallet } from "@/lib/services/wallet";

// POST /api/billing/credits/spend
//
// Runs one playground action. The client sends only the action id — the credit
// cost comes from the shared catalog of actions, so a crafted request cannot
// pick its own price.
//
// This replaces the old /billing/credits/adjust, which took an arbitrary
// signed delta from the browser and would happily mint credits.
export async function POST(request: Request) {
  return withIdentity(async (identity) => {
    const { actionId } = await readJson<{ actionId?: string }>(request);
    const action = findPlaygroundAction(String(actionId));
    if (!action) return fail("Unknown playground action.", 400);

    const wallet = await getWallet(identity.userId);
    const result = await runPlaygroundAction(identity.userId, action, wallet);

    return NextResponse.json(result, { status: 201 });
  });
}
