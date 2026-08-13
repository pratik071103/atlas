import "server-only";

import { NextResponse } from "next/server";
import { getIdentity, type Identity } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Route-handler plumbing.
//
// The architecture rule is that handlers stay thin — parse, call a service,
// respond — so the two things every handler would otherwise repeat (resolving
// the session, turning a thrown service error into a status code) live here.
// ---------------------------------------------------------------------------

export function fail(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Maps service-layer errors onto responses; anything unrecognised is a 500. */
function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof Error) {
    // Named rather than instanceof-checked so http.ts does not have to import
    // every service that can throw.
    if (err.name === "InsufficientCreditsError") return fail(err.message, 400);
    if (err.name === "MongoServerSelectionError" || err.name === "MongoNetworkError") {
      console.error("[api] database unreachable:", err.message);
      return fail("Could not reach the database. Is MONGODB_URI set and the cluster up?", 503);
    }
    console.error("[api]", err);
    return fail(err.message || "Something went wrong. Please try again.", 500);
  }
  console.error("[api] non-error thrown:", err);
  return fail("Something went wrong. Please try again.", 500);
}

/**
 * Runs `handler` with the caller's identity, or 401s.
 *
 * A guest counts as an identity — they are an anonymous Better Auth user — so
 * every billing flow works before sign-up and follows them across it.
 */
export async function withIdentity(
  handler: (identity: Identity) => Promise<Response>
): Promise<Response> {
  let identity: Identity | null;
  try {
    identity = await getIdentity();
  } catch (err) {
    return toErrorResponse(err);
  }

  if (!identity) return fail("Not signed in. Continue as guest or sign in first.", 401);

  try {
    return await handler(identity);
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** Parses a JSON body, returning `{}` rather than throwing on an empty one. */
export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}
