import { NextResponse } from "next/server";
import { readJson, withIdentity } from "@/lib/http";
import { validateLicense } from "@/lib/services/licenses";

// POST /api/license/validate — Dodo's public licenses.validate endpoint.
//
// An invalid key is a legitimate answer, not an error, so this always 200s
// with `valid: false` rather than a status code the UI has to interpret.
export async function POST(request: Request) {
  return withIdentity(async (identity) => {
    const { key } = await readJson<{ key?: string }>(request);
    return NextResponse.json(await validateLicense(identity.userId, String(key ?? "")));
  });
}
