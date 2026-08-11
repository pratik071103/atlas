import { useState } from "react";
import { X, CalendarClock, OctagonX } from "lucide-react";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

interface Props {
  planName: string;
  onClose: () => void;
  onConfirm: (mode: "immediate" | "schedule") => Promise<void>;
}

export function CancelSubscriptionModal({ planName, onClose, onConfirm }: Props) {
  const [busy, setBusy] = useState<"immediate" | "schedule" | null>(null);

  async function handle(mode: "immediate" | "schedule") {
    setBusy(mode);
    try {
      await onConfirm(mode);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 backdrop-blur-sm px-4">
      <Card className="w-full max-w-md p-6 relative animate-pop-in">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-ink-400 hover:text-ink-800"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <h2 className="text-xl font-bold text-ink-900">Cancel {planName}?</h2>
        <p className="mt-1.5 text-sm text-ink-600">
          Choose how you'd like to cancel this subscription.
        </p>

        <div className="mt-5 space-y-3">
          <button
            disabled={busy !== null}
            onClick={() => handle("schedule")}
            className="w-full text-left card p-4 hover:border-ink-800 transition-colors disabled:opacity-60"
          >
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-lime-100 text-lime-800 shrink-0">
                <CalendarClock size={17} />
              </span>
              <div>
                <p className="text-sm font-bold text-ink-900">
                  {busy === "schedule" ? "Scheduling…" : "Schedule cancellation"}
                </p>
                <p className="text-xs text-ink-600 mt-0.5">
                  Keep access until the end of the current billing period, then it won't renew.
                </p>
              </div>
            </div>
          </button>

          <button
            disabled={busy !== null}
            onClick={() => handle("immediate")}
            className="w-full text-left card p-4 hover:border-red-300 transition-colors disabled:opacity-60"
          >
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-red-50 text-red-600 shrink-0">
                <OctagonX size={17} />
              </span>
              <div>
                <p className="text-sm font-bold text-ink-900">
                  {busy === "immediate" ? "Cancelling…" : "Cancel immediately"}
                </p>
                <p className="text-xs text-ink-600 mt-0.5">
                  Access ends right away. No further charges, no refund for time remaining.
                </p>
              </div>
            </div>
          </button>
        </div>

        <Button variant="secondary" fullWidth onClick={onClose} className="mt-4">
          Never mind, keep my plan
        </Button>
      </Card>
    </div>
  );
}
