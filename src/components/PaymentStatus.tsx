import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, CheckoutStatus } from "../lib/api";
import { Card } from "./ui/Card";

// ---------------------------------------------------------------------------
// PaymentStatus — "Verifying payment…" overlay for the dashboard.
//
// The browser can't receive Dodo webhooks directly, so after a checkout the
// purchase row is advanced server-side by payment.* webhooks and this
// component polls the purchase status until it reaches a terminal state:
//   active     → success
//   failed     → failure
//   cancelled  → failure
//
// This is the ONLY page shown — no timed-out second screen. If the webhook
// never arrives the overlay keeps waiting quietly (the dashboard banner can
// still be opened with Escape, which marks the result as "timeout").
// ---------------------------------------------------------------------------

export type PaymentOutcome = "success" | "failure" | "timeout";

const POLL_INTERVAL_MS = 2000;
const STALL_WARNING_MS = 120_000;

const TERMINAL_SUCCESS = ["active"];
const TERMINAL_FAILURE = ["failed", "cancelled"];

interface Props {
  checkoutId: string;
  onResolved: (outcome: PaymentOutcome) => void;
}

export function PaymentStatus({ checkoutId, onResolved }: Props) {
  const [status, setStatus] = useState<CheckoutStatus | null>(null);
  const [slow, setSlow] = useState(false);
  const resolvedRef = useRef(false);
  const onResolvedRef = useRef(onResolved);
  onResolvedRef.current = onResolved;

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    async function tick() {
      try {
        const s = await api.getCheckoutStatus(checkoutId);
        if (cancelled || resolvedRef.current) return;
        setStatus(s);

        if (TERMINAL_SUCCESS.includes(s.status) || TERMINAL_FAILURE.includes(s.status)) {
          resolvedRef.current = true;
          clearInterval(interval);
          onResolvedRef.current(TERMINAL_SUCCESS.includes(s.status) ? "success" : "failure");
        }
      } catch {
        // Transient network error — keep polling.
      }
    }

    tick();
    interval = setInterval(tick, POLL_INTERVAL_MS);

    const warning = setTimeout(() => {
      if (!resolvedRef.current && !cancelled) setSlow(true);
    }, STALL_WARNING_MS);

    // Escape closes the overlay only — it never moves the user to another
    // page. The dashboard banner then reports the outcome as undetermined.
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !resolvedRef.current) {
        resolvedRef.current = true;
        clearInterval(interval);
        onResolvedRef.current("timeout");
      }
    }
    window.addEventListener("keydown", onKey);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(warning);
      window.removeEventListener("keydown", onKey);
    };
  }, [checkoutId]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/50 backdrop-blur-sm px-4">
      <Card className="w-full max-w-sm p-6 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-lime-100 text-lime-800">
          <Loader2 size={22} className="animate-spin" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-ink-900">Verifying payment…</h2>
        <p className="mt-2 text-sm text-ink-600">
          {slow
            ? "Confirming with Dodo Payments — this is taking longer than usual. Your purchase will appear here the moment it's confirmed."
            : "Confirming your payment with Dodo Payments. This usually takes a few seconds."}
        </p>

        {status && (
          <p className="mt-3 text-xs text-ink-400">
            {status.productName} · {status.status}
          </p>
        )}
      </Card>
    </div>
  );
}