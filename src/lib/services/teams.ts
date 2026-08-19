import "server-only";

import crypto from "node:crypto";
import {
  getCollections,
  newId,
  withTransaction,
  type TeamDoc,
  type TeamMemberDoc,
} from "@/lib/db";
import { grantCreditsWithin, setPlanBalanceWithin } from "./wallet";

// ---------------------------------------------------------------------------
// Team service — seat-based billing
//
// One TeamDoc per seat-based purchase. Each purchased seat slot becomes a
// TeamMemberDoc with status "invited" and a random single-use token. The
// owner copies the invite URL; when an invitee accepts:
//   1. Their userId is written onto the member row.
//   2. Their plan wallet is seeded with the per-seat credit amount.
//   3. The token is consumed (status stays "active", token becomes invalid
//      because it no longer matches a row with status "invited").
//
// Credit refresh on renewal: the owner's subscription.renewed webhook calls
// refreshMemberCredits(), which resets each active member's plan balance.
// ---------------------------------------------------------------------------

function generateToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface CreateTeamInput {
  ownerId: string;
  purchaseId: string;
  dodoSubscriptionId: string | null;
  seatCount: number;
  name: string;
}

/**
 * Creates a team for the seat buyer. Idempotent: if the owner already has a
 * team (e.g. webhook re-delivery), the existing team is returned unchanged.
 */
export async function createTeam(input: CreateTeamInput): Promise<TeamDoc> {
  const c = await getCollections();
  const existing = await c.teams.findOne({ ownerId: input.ownerId, status: "active" });
  if (existing) return existing;

  const now = new Date();
  const doc: TeamDoc = {
    _id: newId("team"),
    ownerId: input.ownerId,
    name: input.name,
    purchaseId: input.purchaseId,
    dodoSubscriptionId: input.dodoSubscriptionId,
    seatCount: input.seatCount,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  await c.teams.insertOne(doc);
  return doc;
}

/**
 * Appends `count` new invited member slots (each with a fresh single-use
 * token) to the given team. Called when seats are first purchased and again
 * when the owner upgrades — only the delta is passed in.
 */
export async function generateInviteLinks(
  teamId: string,
  ownerId: string,
  count: number
): Promise<TeamMemberDoc[]> {
  if (count <= 0) return [];
  const c = await getCollections();
  const now = new Date();

  const docs: TeamMemberDoc[] = Array.from({ length: count }, () => ({
    _id: newId("mbr"),
    teamId,
    ownerId,
    userId: null,
    inviteToken: generateToken(),
    status: "invited" as const,
    joinedAt: null,
    createdAt: now,
  }));

  await c.teamMembers.insertMany(docs);
  return docs;
}

/**
 * Redeems an invite token. Single-use: the token must belong to an "invited"
 * member. On success:
 *   - The member row is updated (userId, status="active", joinedAt).
 *   - The new member's plan wallet is seeded with `creditsPerSeat` credits.
 *
 * Returns null when the token is invalid, already used, or the team is
 * cancelled — the caller converts this into a 404/410.
 */
export async function acceptInvite(
  token: string,
  userId: string,
  creditsPerSeat: number = 20
): Promise<{ team: TeamDoc; member: TeamMemberDoc } | null> {
  const c = await getCollections();

  const member = await c.teamMembers.findOne({ inviteToken: token, status: "invited" });
  if (!member) return null;

  const team = await c.teams.findOne({ _id: member.teamId, status: "active" });
  if (!team) return null;

  // Guard: userId must not already be an active member of this team.
  const already = await c.teamMembers.findOne({ teamId: team._id, userId, status: "active" });
  if (already) return null;

  return withTransaction(async (session) => {
    const opts = session ? { session } : {};
    const now = new Date();

    await c.teamMembers.updateOne(
      { _id: member._id },
      { $set: { userId, status: "active", joinedAt: now } },
      opts
    );

    // Seed the new member's plan wallet.
    if (creditsPerSeat > 0) {
      await setPlanBalanceWithin(
        session,
        userId,
        creditsPerSeat,
        `Joined team: ${team.name}`,
        `join-team:${member._id}`
      );

      // Deduct the seat credits from the owner's wallet (since the owner was granted all seat credits initially).
      await grantCreditsWithin(
        session,
        team.ownerId,
        "plan",
        -creditsPerSeat,
        `Teammate joined: ${userId}`,
        `deduct-owner-join:${member._id}`
      );
    }

    return {
      team,
      member: { ...member, userId, status: "active" as const, joinedAt: now },
    };
  });
}

/**
 * Removes a team member: marks their slot "removed" and zeros their plan
 * wallet. Only the team owner may call this.
 * Accepts just the memberId — resolves the teamId internally.
 */
export async function removeMember(
  memberId: string,
  callerId: string
): Promise<boolean> {
  const c = await getCollections();

  const member = await c.teamMembers.findOne({ _id: memberId, status: "active" });
  if (!member) return false;

  const team = await c.teams.findOne({ _id: member.teamId });
  if (!team || team.ownerId !== callerId) return false;

  return withTransaction(async (session) => {
    const opts = session ? { session } : {};
    await c.teamMembers.updateOne(
      { _id: memberId },
      { $set: { status: "removed" } },
      opts
    );

    // Zero the ex-member's plan balance immediately.
    if (member.userId) {
      await setPlanBalanceWithin(session, member.userId, 0, `Removed from team: ${team.name}`);
    }

    return true;
  });
}

/** Updates the seat count on the team doc (called on subscription.plan_changed). */
export async function updateSeatCount(teamId: string, newCount: number): Promise<void> {
  const c = await getCollections();
  await c.teams.updateOne(
    { _id: teamId },
    { $set: { seatCount: newCount, updatedAt: new Date() } }
  );
}

/**
 * Cancels the team: sets status "cancelled" and removes every active member
 * (zeroing their plan wallets). Called on subscription.cancelled.
 */
export async function cancelTeam(teamId: string): Promise<void> {
  const c = await getCollections();
  const team = await c.teams.findOne({ _id: teamId });
  if (!team) return;

  const activeMembers = await c.teamMembers
    .find({ teamId, status: "active", userId: { $ne: null } })
    .toArray();

  await withTransaction(async (session) => {
    const opts = session ? { session } : {};

    // Mark all invited/active slots removed.
    await c.teamMembers.updateMany(
      { teamId, status: { $in: ["invited", "active"] } },
      { $set: { status: "removed" } },
      opts
    );

    // Zero every active member's plan balance.
    for (const m of activeMembers) {
      if (m.userId) {
        await setPlanBalanceWithin(session, m.userId, 0, `Team cancelled: ${team.name}`);
      }
    }

    await c.teams.updateOne(
      { _id: teamId },
      { $set: { status: "cancelled", updatedAt: new Date() } },
      opts
    );
  });
}

/**
 * Refreshes every active member's plan wallet to `creditsPerSeat`.
 * Called from the subscription.renewed webhook handler (tied to owner's cycle).
 * Idempotent: the idempotencyKey prevents double-grants on webhook re-delivery.
 */
export async function refreshMemberCredits(
  teamId: string,
  creditsPerSeat: number,
  idempotencyKey: string
): Promise<void> {
  const c = await getCollections();
  const activeMembers = await c.teamMembers
    .find({ teamId, status: "active", userId: { $ne: null } })
    .toArray();

  for (const m of activeMembers) {
    if (!m.userId) continue;
    await withTransaction((session) =>
      setPlanBalanceWithin(
        session,
        m.userId!,
        creditsPerSeat,
        `Team seat renewal`,
        `${idempotencyKey}:${m._id}`
      )
    );
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getTeamByOwner(ownerId: string): Promise<TeamDoc | null> {
  const c = await getCollections();
  return c.teams.findOne({ ownerId, status: "active" });
}

export async function getTeamBySubscription(
  dodoSubscriptionId: string
): Promise<TeamDoc | null> {
  const c = await getCollections();
  return c.teams.findOne({ dodoSubscriptionId, status: "active" });
}

export async function getTeamForMember(
  userId: string
): Promise<{ team: TeamDoc; member: TeamMemberDoc } | null> {
  const c = await getCollections();
  const member = await c.teamMembers.findOne({ userId, status: "active" });
  if (!member) return null;
  const team = await c.teams.findOne({ _id: member.teamId, status: "active" });
  if (!team) return null;
  return { team, member };
}

export async function listMembers(teamId: string): Promise<TeamMemberDoc[]> {
  const c = await getCollections();
  return c.teamMembers
    .find({ teamId, status: { $in: ["invited", "active"] } })
    .sort({ createdAt: 1 })
    .toArray();
}

// ---------------------------------------------------------------------------
// View types (safe to send to the browser)
// ---------------------------------------------------------------------------

export interface TeamMemberView {
  id: string;
  userId: string | null;
  inviteToken: string;
  inviteUrl: string;
  status: string;
  joinedAt: string | null;
  createdAt: string;
}

export interface TeamView {
  id: string;
  ownerId: string;
  name: string;
  seatCount: number;
  status: string;
  dodoSubscriptionId: string | null;
  createdAt: string;
}

export function toTeamView(t: TeamDoc): TeamView {
  return {
    id: t._id,
    ownerId: t.ownerId,
    name: t.name,
    seatCount: t.seatCount,
    status: t.status,
    dodoSubscriptionId: t.dodoSubscriptionId,
    createdAt: t.createdAt.toISOString(),
  };
}

export function toMemberView(m: TeamMemberDoc, appUrl: string): TeamMemberView {
  return {
    id: m._id,
    userId: m.userId,
    inviteToken: m.inviteToken,
    inviteUrl: `${appUrl}/invite/${m.inviteToken}`,
    status: m.status,
    joinedAt: m.joinedAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
  };
}
