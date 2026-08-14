"use client";

import { useState } from "react";
import { Activity, Image as ImageIcon, Sparkles, type LucideIcon } from "lucide-react";
import { PLAYGROUND_ACTIONS, type PlaygroundIcon } from "@shared/playground";
import { api, type UsageEvent, type WalletBalance } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { Badge } from "./ui/Badge";
import { Card } from "./ui/Card";

// ---------------------------------------------------------------------------
// The usage-billing playground.
//
// Every click does two things that are deliberately independent:
//
//   1. spends credits from the local wallet (plan bucket first) and writes an
//      event row — one transaction, server-side
//   2. reports the event to Dodo through the adapter's usage plugin, which is
//      what actually bills a usage-based subscription
//
// Step 2 runs from the browser because that is where the adapter exposes it,
// and it is best-effort: a metering outage marks the row 'failed' and leaves
// the spend standing rather than rolling the demo back.
//
// The wallet updates optimistically off the spend response, so the meter moves
// on the click rather than after the round trip to record the ingest result.
// ---------------------------------------------------------------------------

const ICONS: Record<PlaygroundIcon, LucideIcon> = {
  image: ImageIcon,
  sparkles: Sparkles,
  activity: Activity,
};

interface Props {
  wallet: WalletBalance;
  /** True when the server has no Dodo key — the ingest call would 4xx. */
  simulated: boolean;
  onWalletChange: (wallet: WalletBalance) => void;
  onEvent: (event: UsageEvent) => void;
}

export function PlaygroundButtons({ wallet, simulated, onWalletChange, onEvent }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(actionId: string, eventName: string) {
    setBusyId(actionId);
    setError(null);
    try {
      const { wallet: next, event } = await api.runPlaygroundAction(actionId);
      onWalletChange(next);
      onEvent(event);

      const settled = await ingest(event.id, eventName);
      onEvent(settled);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  /** Reports the event to Dodo and records how that went. */
  async function ingest(eventId: string, eventName: string): Promise<UsageEvent> {
    if (simulated) {
      const { event } = await api.recordIngestResult(
        eventId,
        "simulated",
        "No DODO_API_KEY configured — nothing was sent."
      );
      return event;
    }

    try {
      const { error: ingestError } = await authClient.dodopayments.usage.ingest({
        // Dodo dedupes on event_id, so it has to be unique per click. Reusing
        // the local row's id keeps the two logs correlated.
        event_id: eventId,
        event_name: eventName,
      });
      const { event } = await api.recordIngestResult(
        eventId,
        ingestError ? "failed" : "ok",
        ingestError?.message
      );
      return event;
    } catch (e) {
      const { event } = await api.recordIngestResult(eventId, "failed", (e as Error).message);
      return event;
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-ink-900">Usage playground</h2>
          <p className="mt-0.5 text-xs text-ink-600">
            Spend credits and report metered events to Dodo.
          </p>
        </div>
        <Badge tone={simulated ? "ink" : "lime"}>{simulated ? "Simulated" : "Live meter"}</Badge>
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
        {PLAYGROUND_ACTIONS.map((action) => {
          const Icon = ICONS[action.icon];
          const unaffordable = action.credits > wallet.total;
          return (
            <button
              key={action.id}
              type="button"
              disabled={busyId !== null || unaffordable}
              onClick={() => void run(action.id, action.eventName)}
              className="group flex flex-col gap-1.5 rounded-xl border border-ink-100 p-3 text-left transition-all hover:border-ink-800 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-40"
            >
              <span className="flex items-center justify-between">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime-100 text-lime-800">
                  <Icon size={15} />
                </span>
                <Badge tone={action.credits > 0 ? "lime" : "lavender"}>
                  {action.credits > 0 ? `${action.credits} cr` : "metered"}
                </Badge>
              </span>
              <span className="text-sm font-semibold text-ink-900">
                {busyId === action.id ? "Working…" : action.label}
              </span>
              <span className="text-xs leading-snug text-ink-400">
                {unaffordable ? "Not enough credits" : action.description}
              </span>
            </button>
          );
        })}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Card>
  );
}
