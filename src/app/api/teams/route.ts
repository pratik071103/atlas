import { NextResponse } from "next/server";
import { appUrl } from "@/lib/dodo";
import { fail, withIdentity } from "@/lib/http";
import {
  getTeamByOwner,
  getTeamForMember,
  listMembers,
  toTeamView,
  toMemberView,
} from "@/lib/services/teams";

// ---------------------------------------------------------------------------
// GET /api/teams
//
// Returns two snapshots:
//   owned    — the team this user owns (as a seat buyer), or null
//   memberOf — the team this user joined as an invitee, or null
//
// The client uses both to power the Switch Account dropdown and the /team page.
// ---------------------------------------------------------------------------

export async function GET() {
  return withIdentity(async (identity) => {
    const base = appUrl();

    const [ownedTeam, memberData] = await Promise.all([
      getTeamByOwner(identity.userId),
      getTeamForMember(identity.userId),
    ]);

    const owned = ownedTeam
      ? {
          team: toTeamView(ownedTeam),
          members: (await listMembers(ownedTeam._id)).map((m) => toMemberView(m, base)),
          isOwner: true,
        }
      : null;

    const memberOf = memberData
      ? {
          team: toTeamView(memberData.team),
          members: null, // members only visible to owner
          isOwner: false,
        }
      : null;

    // Don't expose owned team data when the user is only a member of someone else's team.
    if (!owned && !memberOf) {
      return NextResponse.json({ owned: null, memberOf: null });
    }

    return NextResponse.json({ owned, memberOf });
  });
}
