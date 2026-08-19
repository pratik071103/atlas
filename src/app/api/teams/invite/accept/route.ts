import { NextResponse } from "next/server";
import { appUrl } from "@/lib/dodo";
import { fail, readJson, withIdentity } from "@/lib/http";
import { acceptInvite, getTeamByOwner, listMembers, toMemberView, toTeamView } from "@/lib/services/teams";

// ---------------------------------------------------------------------------
// POST /api/teams/invite/accept
//
// Accepts a single-use invite token. The caller must be authenticated.
// On success:
//   - The member slot is marked "active" with the caller's userId.
//   - 20 plan credits are seeded into the caller's wallet.
//   - The token cannot be reused.
//
// Returns the team snapshot so the client can immediately redirect to /team.
// ---------------------------------------------------------------------------

interface Body {
  token?: string;
}

export async function POST(request: Request) {
  return withIdentity(async (identity) => {
    const body = await readJson<Body>(request);
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) return fail("token is required.", 400);

    const result = await acceptInvite(token, identity.userId);
    if (!result) {
      return fail(
        "This invite link is invalid, has already been used, or the team is no longer active.",
        410
      );
    }

    const { team } = result;
    const base = appUrl();
    const members = await listMembers(team._id);

    return NextResponse.json({
      team: toTeamView(team),
      members: members.map((m) => toMemberView(m, base)),
    });
  });
}
