import { NextResponse } from "next/server";
import { withIdentity } from "@/lib/http";
import { hasActiveLicense, listLicenses } from "@/lib/services/licenses";

// GET /api/license — the customer's keys, and whether the studio is unlocked.
export async function GET() {
  return withIdentity(async (identity) => {
    const [licenses, unlocked] = await Promise.all([
      listLicenses(identity.userId),
      hasActiveLicense(identity.userId),
    ]);
    return NextResponse.json({ licenses, unlocked });
  });
}
