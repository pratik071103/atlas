"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Loader2, OctagonX, X } from "lucide-react";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

interface Props {
  planName: string;
  onClose: () => void;
  onConfirm: (mode: "immediate" | "schedule") => Promise<void>;
}

export function CancelSubscriptionModal({ planName, onClose, onConfirm }: Props) {
  const [busy, setBusy] = useState<"immediate" | "schedule" | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && busy === null) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  async function handle(mode: "immediate" | "schedule") {
    setBusy(mode);
    try {
      await onConfirm(mode);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <Card className="relative w-full max-w-md p-6 animate-pop-in">
        <button
          onClick={onClose}
          disabled={busy !== null}
          className="absolute right-4 top-4 text-ink-400 hover:text-ink-800 disabled:opacity-40"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <h2 className="text-xl font-bold text-ink-900">Cancel {planName}?</h2>
        <p className="mt-1.5 text-sm text-ink-600">
          Choose how you&apos;d like to cancel this subscription.
        </p>

        <div className="mt-5 space-y-3">
          <button
            disabled={busy !== null}
            onClick={() => void handle("schedule")}
            className="card w-full p-4 text-left transition-colors hover:border-ink-800 disabled:opacity-60"
          >
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-lime-100 text-lime-800">
                <CalendarClock size={17} />
              </span>
              <div>
                <p className="flex items-center gap-1.5 text-sm font-bold text-ink-900">
                  {busy === "schedule" && <Loader2 size={14} className="animate-spin" />}
                  {busy === "schedule" ? "Scheduling…" : "Schedule cancellation"}
                </p>
                <p className="mt-0.5 text-xs text-ink-600">
                  Keep access — and your plan credits — until the end of the current billing
                  period, then it won&apos;t renew.
                </p>
              </div>
            </div>
          </button>

          <button
            disabled={busy !== null}
            onClick={() => void handle("immediate")}
            className="card w-full p-4 text-left transition-colors hover:border-red-300 disabled:opacity-60"
          >
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600">
                <OctagonX size={17} />
              </span>
              <div>
                <p className="flex items-center gap-1.5 text-sm font-bold text-ink-900">
                  {busy === "immediate" && <Loader2 size={14} className="animate-spin" />}
                  {busy === "immediate" ? "Cancelling…" : "Cancel immediately"}
                </p>
                <p className="mt-0.5 text-xs text-ink-600">
                  Access and plan credits end right away. No further charges, no refund for the
                  time remaining.
                </p>
              </div>
            </div>
          </button>
        </div>

        <Button
          variant="secondary"
          fullWidth
          onClick={onClose}
          disabled={busy !== null}
          className="mt-4"
        >
          Never mind, keep my plan
        </Button>
      </Card>
    </div>
  );
}
