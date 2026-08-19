"use client";

import { useEffect, useState } from "react";
import { Gauge, Radio } from "lucide-react";
import type { IngestStatus, UsageEvent } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { Badge } from "./ui/Badge";
import { Card } from "./ui/Card";

// ---------------------------------------------------------------------------
// Live log of playground events.
//
// Each row shows what was spent, which bucket it came out of, and what Dodo
// said about the ingest — the whole point being that the local wallet and the
// remote meter are two separate things you can watch disagree.
//
// The meters strip underneath comes from the adapter
// (authClient.dodopayments.usage.meters.list), so it reflects what Dodo has
// actually recorded for this customer rather than what we think we sent.
// ---------------------------------------------------------------------------

const INGEST_TONE: Record<IngestStatus, "lime" | "ink" | "red" | "amber" | "lavender"> = {
  ok: "lime",
  simulated: "ink",
  failed: "red",
  pending: "amber",
  not_applicable: "lavender",
};

const INGEST_LABEL: Record<IngestStatus, string> = {
  ok: "ingested",
  simulated: "simulated",
  failed: "ingest failed",
  pending: "sending…",
  not_applicable: "not metered",
};

interface Meter {
  id?: string;
  event_name?: string;
  name?: string;
  total_units?: number;
}

interface Props {
  events: UsageEvent[];
  simulated: boolean;
}

export function EventLogPanel({ events, simulated }: Props) {
  const [meters, setMeters] = useState<Meter[] | null>(null);

  useEffect(() => {
    if (simulated) return;
    let cancelled = false;

    void authClient.dodopayments.usage.meters
      .list()
      .then((res) => {
        const items = (res.data as { items?: Meter[] } | null)?.items;
        if (!cancelled && Array.isArray(items)) setMeters(items);
      })
      // A customer with no metered subscription has no meters; that is not an
      // error worth showing, so the strip just stays hidden.
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [simulated, events.length]);

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden p-5">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-ink-900 text-lime-300">
          <Radio size={14} />
        </span>
        <div>
          <h2 className="text-sm font-bold text-ink-900">Event log</h2>
          <p className="text-xs text-ink-600">Wallet spend ↔ Dodo ingest, side by side</p>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <Gauge size={26} className="text-ink-300" />
          <p className="mt-3 text-sm font-semibold text-ink-800">No events yet</p>
          <p className="mt-1 max-w-[16rem] text-xs text-ink-400">
            Run something from the playground — each click lands here with what it cost and how
            the Dodo ingest went.
          </p>
        </div>
      ) : (
        <ul className="mt-4 min-h-0 flex-1 divide-y divide-ink-100 overflow-y-auto pr-1">
          {events.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 animate-fade-up">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-900">{e.label}</p>
                <p className="truncate font-mono text-[11px] text-ink-400">
                  {e.eventName} · {new Date(e.createdAt).toLocaleTimeString()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs font-semibold text-ink-800">
                  {e.credits > 0 ? `−${e.credits} ${e.bucket ?? ""}` : "no credits"}
                </span>
                <Badge tone={INGEST_TONE[e.ingestStatus]} className="whitespace-nowrap">
                  {INGEST_LABEL[e.ingestStatus]}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}

      {meters && meters.length > 0 && (
        <div className="mt-4 border-t border-ink-100 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            Dodo meters
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {meters.map((m, i) => (
              <li key={m.id ?? i}>
                <Badge tone="lavender">
                  {m.event_name ?? m.name ?? "meter"}
                  {typeof m.total_units === "number" ? ` · ${m.total_units}` : ""}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
