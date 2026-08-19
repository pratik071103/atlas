"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Copy,
  Check,
  Trash2,
  Plus,
  Minus,
  ShoppingCart,
  UserCheck,
  UserX,
  Clock,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSession } from "@/components/SessionProvider";
import { api, type TeamMemberRow, type TeamRow } from "@/lib/api";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      title="Copy invite link"
      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink-500 hover:bg-ink-100 hover:text-ink-800 transition-colors"
    >
      {copied ? <Check size={12} className="text-lime-600" /> : <Copy size={12} />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function SeatBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-ink-700">
          {used} of {total} seats filled
        </span>
        <span className="text-ink-400">{total - used} available</span>
      </div>
      <div className="h-2 w-full rounded-full bg-ink-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-lime-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function TeamPage() {
  const { identity, loading: sessionLoading } = useSession();
  const router = useRouter();

  const [ownedTeam, setOwnedTeam] = useState<TeamRow | null>(null);
  const [memberOfTeam, setMemberOfTeam] = useState<TeamRow | null>(null);
  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [buyQty, setBuyQty] = useState(1);
  const [buying, setBuying] = useState(false);

  const load = useCallback(async () => {
    if (!identity) { setLoading(false); return; }
    try {
      const { owned, memberOf } = await api.getTeam();
      if (owned) {
        setOwnedTeam(owned.team);
        setMembers(owned.members ?? []);
        setIsOwner(true);
      } else if (memberOf) {
        setMemberOfTeam(memberOf.team);
        setIsOwner(false);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [identity]);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [sessionLoading, load]);

  async function handleBuyMore() {
    setBuying(true);
    setError(null);
    try {
      const session = await api.createSeatsCheckout(buyQty, "overlay");
      if (session.checkoutUrl) window.location.href = session.checkoutUrl;
      else {
        // Simulated: reload
        await load();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBuying(false);
    }
  }

  // --- Loading ---
  if (sessionLoading || loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </main>
    );
  }

  // --- Not signed in ---
  if (!identity) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-2xl font-bold text-ink-900">Sign in to view your team</h1>
        <Button href="/pricing" className="mt-5">Get started</Button>
      </main>
    );
  }

  // --- No team at all ---
  const activeTeam = ownedTeam ?? memberOfTeam;
  if (!activeTeam) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <span className="eyebrow">Team</span>
        <h1 className="mt-2 text-3xl font-bold text-ink-900">No team yet</h1>
        <p className="mt-3 text-ink-600 max-w-md">
          Buy seats to create a team workspace. Each seat includes 20 monthly credits and a
          unique invite link for a teammate.
        </p>

        <Card className="mt-8 p-6 border-lavender-200 bg-lavender-50 max-w-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-lavender-100">
              <Users size={20} className="text-lavender-700" />
            </div>
            <div>
              <p className="font-semibold text-ink-900">Extra Seats</p>
              <p className="text-sm text-ink-500">$8 / seat / month · 20 credits each</p>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setBuyQty((q) => Math.max(1, q - 1))}
              className="grid h-8 w-8 place-items-center rounded-full border border-ink-200 hover:bg-ink-50"
            >
              <Minus size={14} />
            </button>
            <span className="w-8 text-center font-bold text-ink-900">{buyQty}</span>
            <button
              onClick={() => setBuyQty((q) => Math.min(50, q + 1))}
              className="grid h-8 w-8 place-items-center rounded-full border border-ink-200 hover:bg-ink-50"
            >
              <Plus size={14} />
            </button>
            <span className="text-sm text-ink-600">
              = <strong>${buyQty * 8}</strong>/month
            </span>
          </div>

          {error && (
            <p className="mb-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <Button onClick={handleBuyMore} loading={buying} className="w-full gap-2">
            <ShoppingCart size={15} /> Buy {buyQty} seat{buyQty !== 1 ? "s" : ""} — ${buyQty * 8}/mo
          </Button>
        </Card>
      </main>
    );
  }

  // --- Has a team ---
  const invitedSlots = members.filter((m) => m.status === "invited");
  const activeMembers = members.filter((m) => m.status === "active");
  const usedSeats = activeMembers.length;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <span className="eyebrow">Team</span>

      {/* Header */}
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink-900">{activeTeam.name}</h1>
          <p className="mt-1 text-sm text-ink-500">
            {activeTeam.seatCount} seat{activeTeam.seatCount !== 1 ? "s" : ""} · $
            {activeTeam.seatCount * 8}/month
          </p>
        </div>
        {isOwner && (
          <Button variant="secondary" href="/profile">
            Manage billing
          </Button>
        )}
      </div>

      {error && (
        <Card className="mt-4 border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</Card>
      )}

      {/* Seat bar (owner only) */}
      {isOwner && (
        <Card className="mt-6 p-5">
          <SeatBar used={usedSeats} total={activeTeam.seatCount} />
        </Card>
      )}

      {/* Active members (owner only) */}
      {isOwner && activeMembers.length > 0 && (
        <Card className="mt-4 p-5">
          <h2 className="text-sm font-bold text-ink-900 flex items-center gap-2">
            <UserCheck size={14} /> Active members ({activeMembers.length})
          </h2>
          <ul className="mt-3 divide-y divide-ink-100">
            {activeMembers.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-3">
                <Avatar userId={m.userId ?? m.id} name="Team member" className="h-8 w-8 text-xs shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-900 truncate">
                    {m.userId ? "Team member" : "Pending"}
                  </p>
                  {m.joinedAt && (
                    <p className="text-xs text-ink-400">
                      Joined {new Date(m.joinedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Badge tone="lime">Active</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Invite links (owner only) */}
      {isOwner && invitedSlots.length > 0 && (
        <Card className="mt-4 p-5">
          <h2 className="text-sm font-bold text-ink-900 flex items-center gap-2">
            <Clock size={14} /> Pending invite links ({invitedSlots.length})
          </h2>
          <p className="mt-1 text-xs text-ink-500">
            Each link is single-use. Share with a teammate — once accepted the link expires.
          </p>
          <ul className="mt-3 space-y-2">
            {invitedSlots.map((m, i) => (
              <li
                key={m.id}
                className="flex items-center gap-2 rounded-lg border border-ink-100 bg-ink-50 px-3 py-2"
              >
                <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-lavender-100 text-[10px] font-bold text-lavender-700">
                  {i + 1}
                </div>
                <code className="flex-1 truncate font-mono text-xs text-ink-600">
                  {m.inviteUrl}
                </code>
                <CopyButton text={m.inviteUrl} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Member view — not owner */}
      {!isOwner && (
        <Card className="mt-4 p-5 border-lavender-200 bg-lavender-50">
          <p className="text-sm text-lavender-700">
            You're a member of this workspace. Contact the team owner to manage seats.
          </p>
        </Card>
      )}
    </main>
  );
}
