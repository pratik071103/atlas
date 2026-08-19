import { notFound } from "next/navigation";
import { getCollections, mongoDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { InviteAcceptClient } from "./InviteAcceptClient";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params;

  // Look up the invite slot to get team/owner details for the branding page.
  const c = await getCollections();
  const member = await c.teamMembers.findOne({ inviteToken: token, status: "invited" });

  if (!member) {
    // Token not found or already used — show expired state via the client component.
    return <InviteAcceptClient token={token} invalid />;
  }

  const team = await c.teams.findOne({ _id: member.teamId, status: "active" });
  if (!team) {
    return <InviteAcceptClient token={token} invalid />;
  }

  // Look up owner name from Better Auth's "user" collection (schemaless Mongo).
  let ownerName = "Your teammate";
  try {
    const userDoc = await mongoDb
      .collection("user")
      .findOne({ id: team.ownerId }, { projection: { name: 1 } });
    if (userDoc && typeof userDoc.name === "string" && userDoc.name) {
      ownerName = userDoc.name;
    }
  } catch {
    // Keep fallback.
  }

  // Check if the visitor is already signed in.
  const session = await auth.api.getSession({ headers: await headers() });
  const isSignedIn = Boolean(session?.user && !(session.user as any).isAnonymous);
  const alreadyMember = isSignedIn
    ? Boolean(await c.teamMembers.findOne({ teamId: team._id, userId: session!.user.id, status: "active" }))
    : false;

  return (
    <InviteAcceptClient
      token={token}
      teamName={team.name}
      ownerName={ownerName}
      seatCount={team.seatCount}
      isSignedIn={isSignedIn}
      alreadyMember={alreadyMember}
    />
  );
}

export async function generateMetadata({ params }: Props) {
  const { token } = await params;
  const c = await getCollections();
  const member = await c.teamMembers.findOne({ inviteToken: token, status: "invited" });
  const team = member ? await c.teams.findOne({ _id: member.teamId }) : null;

  return {
    title: team ? `Join ${team.name} on Atlas Studio` : "Invite — Atlas Studio",
    description: team
      ? `You've been invited to join ${team.name}'s workspace on Atlas Studio.`
      : "This invite link is no longer valid.",
  };
}
