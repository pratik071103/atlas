import { NextResponse } from "next/server";
import { fail, readJson, withIdentity } from "@/lib/http";
import { deactivateLicense, LicenseError } from "@/lib/services/licenses";

// POST /api/license/deactivate — releases the activation and re-blurs the art.
export async function POST(request: Request) {
  return withIdentity(async (identity) => {
    const { key } = await readJson<{ key?: string }>(request);

    try {
      const license = await deactivateLicense(identity.userId, String(key ?? ""));
      return NextResponse.json({ license });
    } catch (err) {
      if (err instanceof LicenseError) return fail(err.message, err.status);
      throw err;
    }
  });
}
