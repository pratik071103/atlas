"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Inbox, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, type WebhookEventRow } from "@/lib/api";

// ---------------------------------------------------------------------------
// Dev-only diagnostic page: every event Dodo delivered to
// POST /api/auth/dodopayments/webhooks — the adapter's verified endpoint —
// shown newest first, with the exact JSON that arrived.
//
// Point a tunnel at the app, register that URL in the Dodo dashboard, buy
// something, and watch the state machine run.
// ---------------------------------------------------------------------------

const REFRESH_MS = 5000;

const STATUS_TONE: Record<string, "lime" | "red" | "ink"> = {
  received: "lime",
  rejected: "red",
  replay: "ink",
};

export default function DevWebhooksPage() {
  const [events, setEvents] = useState<WebhookEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { events } = await api.getWebhookEvents();
      setEvents(events);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(load, REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="eyebrow">Dev tools</span>
          <h1 className="mt-2 text-3xl font-bold text-ink-900">Webhook log</h1>
          <p className="mt-2 text-sm text-ink-600">
            Every event delivered to{" "}
            <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-xs">
              POST /api/auth/dodopayments/webhooks
            </code>
            . Auto-refreshes every {REFRESH_MS / 1000}s — buy something, or fire a test event
            through your tunnel, and watch it land.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void load()} className="shrink-0">
          <RefreshCw size={15} /> Refresh
        </Button>
      </div>

      {error && (
        <Card className="mt-8 border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </Card>
      )}

      {loading ? (
        <div className="mt-8 space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl2" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <Card className="mt-8 p-10 text-center">
          <Inbox size={28} className="mx-auto text-ink-300" />
          <p className="mt-3 text-sm font-semibold text-ink-800">No webhooks received yet.</p>
          <p className="mt-1 text-xs text-ink-400">
            Complete a checkout in any mode, or send a test payment event, to see it land here.
            Simulated purchases skip Dodo entirely, so they never appear.
          </p>
        </Card>
      ) : (
        <ul className="mt-8 space-y-3">
          {events.map((e) => (
            <li key={e.id}>
              <Card className="p-4">
                <details className="group">
                  <summary className="cursor-pointer list-none outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                    <div className="flex flex-wrap items-center gap-2">
                      <ChevronDown
                        size={15}
                        className="shrink-0 text-ink-400 transition-transform group-open:rotate-180"
                      />
                      <code className="rounded bg-ink-100 px-2 py-0.5 font-mono text-xs font-medium text-ink-800">
                        {e.eventType}
                      </code>
                      <Badge tone={STATUS_TONE[e.status] ?? "ink"}>{e.status}</Badge>
                      <span className="ml-auto text-xs text-ink-400" title={e.createdAt}>
                        {new Date(e.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-xs text-ink-400" title={e.eventId ?? undefined}>
                      dedupe-key: {e.eventId ?? "n/a"}
                    </p>
                  </summary>
                  <pre className="mt-3 max-h-[32rem] overflow-auto rounded-lg bg-ink-50 p-3 font-mono text-xs leading-relaxed text-ink-700">
                    {e.payload}
                  </pre>
                </details>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
