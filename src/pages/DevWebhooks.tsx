import { useEffect, useState } from "react";
import { RefreshCw, Inbox } from "lucide-react";
import { api, WebhookEventRow } from "../lib/api";

// ---------------------------------------------------------------------------
// Dev-only diagnostic page: every webhook Dodo sent to POST /api/webhooks/dodo
// (or that you sent with a tunnel/ngrok during development) shows up here in
// real time — including failed signature checks. Auto-refreshes every 5s and
// also replays the events server-side, the exact JSON Dodo delivered.
// ---------------------------------------------------------------------------

const REFRESH_MS = 5000;

const STATUS_COLORS: Record<string, string> = {
  received: "bg-lime-100 text-lime-800",
  rejected: "bg-red-100 text-red-700",
  replay: "bg-ink-100 text-ink-600",
};

export function DevWebhooks() {
  const [events, setEvents] = useState<WebhookEventRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const { events } = await api.getWebhookEvents();
      setEvents(events);
    } catch {
      // Server unreachable — keep the last render.
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="eyebrow">Dev tools</span>
          <h1 className="mt-2 text-3xl font-bold text-ink-900">Webhook log</h1>
          <p className="mt-2 text-sm text-ink-600">
            Every event delivered to <code className="rounded bg-ink-100 px-1.5 py-0.5">POST /api/webhooks/dodo</code>.
            Auto-refreshes every {REFRESH_MS / 1000}s — buy something (or fire a test event with your tunnel) and watch it land.
          </p>
        </div>
        <button onClick={load} className="btn-secondary shrink-0">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-ink-600">Loading…</p>
      ) : events.length === 0 ? (
        <div className="mt-8 card p-10 text-center">
          <Inbox size={28} className="mx-auto text-ink-300" />
          <p className="mt-3 text-sm text-ink-500">No webhooks received yet.</p>
          <p className="mt-1 text-xs text-ink-400">
            Complete a checkout (any mode) or send a test payment event to see it land here.
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {events.map((e) => (
            <li key={e.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-800">
                  {e.eventType}
                </code>
                <span className={`pill ${STATUS_COLORS[e.status] ?? "bg-ink-100 text-ink-600"}`}>
                  {e.status}
                </span>
                <span className="ml-auto text-xs text-ink-400" title={e.createdAt}>
                  {new Date(e.createdAt + "Z").toLocaleString()}
                </span>
              </div>
              <div className="mt-2 flex justify-between gap-3">
                <p className="text-xs text-ink-500 truncate" title={e.eventId ?? undefined}>
                  webhook-id: {e.eventId ?? "n/a"}
                </p>
              </div>
              <pre className="mt-2 rounded-lg bg-ink-50 p-3 font-mono text-xs leading-relaxed text-ink-700 overflow-x-auto">
                {e.payloadPreview}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}