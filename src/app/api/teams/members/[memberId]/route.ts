import { NextResponse } from "next/server";
import { fail, withIdentity } from "@/lib/http";
import { removeMember } from "@/lib/services/teams";

// ---------------------------------------------------------------------------
// DELETE /api/teams/members/[memberId]
//
// Owner-only: removes a team member, zeros their plan wallet immediately, and
// marks their invite slot as "removed". Returns 403 if the caller is not the
// team owner or the member is not found.
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  return withIdentity(async (identity) => {
    const { memberId } = await params;
    if (!memberId) return fail("memberId is required.", 400);

    const ok = await removeMember(memberId, identity.userId);

    if (!ok) {
      return fail("Member not found, already removed, or you are not the team owner.", 403);
    }

    return NextResponse.json({ ok: true });
  });
}
