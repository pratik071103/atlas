"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Coins, Package, Wallet } from "lucide-react";
import { EventLogPanel } from "@/components/EventLogPanel";
import { KpiCard } from "@/components/KpiCard";
import { PaymentStatus, type PaymentOutcome } from "@/components/PaymentStatus";
import { PlaygroundButtons } from "@/components/PlaygroundButtons";
import { PurchaseLibrary } from "@/components/PurchaseLibrary";
import { SubscriptionCard } from "@/components/SubscriptionCard";
import { useSession } from "@/components/SessionProvider";
import { useToast } from "@/components/Toaster";
import { CtaButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { api, type BillingSnapshot, type UsageEvent, type WalletBalance } from "@/lib/api";
import { DashboardSkeleton } from "./DashboardSkeleton";

interface Banner {
  kind: "success" | "failure";
  text: string;
}

const BANNER_BY_OUTCOME: Record<PaymentOutcome, Banner> = {
  success: {
    kind: "success",
    text: "Payment successful — your purchase is active and credits have been added.",
  },
  failure: {
    kind: "failure",
    text: "Payment failed or was cancelled. Nothing was charged — you can retry from the pricing page.",
  },
  timeout: {
    kind: "failure",
    text: "We haven't received the payment confirmation yet. Check back soon or retry from the pricing page.",
  },
};

/** How often to re-check while something is waiting on a Dodo webhook. */
const WEBHOOK_POLL_MS = 5000;

export function DashboardClient() {
  const { identity, loading: sessionLoading, openAuthModal } = useSession();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [data, setData] = useState<BillingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);

  const checkoutId = searchParams.get("checkout");

  // Snapshot of the last state we told the customer about, so the poll below
  // can tell an actual change from another identical reading.
  const seenRef = useRef<{ statuses: Record<string, string>; tiers: Record<string, string> }>({
    statuses: {},
    tiers: {},
  });

  const load = useCallback(async () => {
    if (!identity) return;
    try {
      const next = await api.getBilling();

      // Webhooks land server-side; the browser only ever sees the result. This
      // is where a purchase going active or a plan change finally confirming
      // gets announced, since nothing the customer did here caused it.
      const seen = seenRef.current;
      const statuses: Record<string, string> = {};
      const tiers: Record<string, string> = {};

      for (const p of next.purchases) {
        statuses[p.id] = p.status;
        tiers[p.id] = p.tierId;

        const previousStatus = seen.statuses[p.id];
        if (previousStatus && previousStatus !== p.status && p.status === "active") {
          toast(
            "success",
            `${p.productName} is active`,
            p.creditsGranted > 0
              ? `${p.creditsGranted} ${p.creditBucket} credits added.`
              : undefined
          );
        }

        const previousTier = seen.tiers[p.id];
        if (previousTier && previousTier !== p.tierId) {
          toast("info", "Plan change confirmed", `You're now on ${p.productName}.`);
        }
      }

      seenRef.current = { statuses, tiers };
      setData(next);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [identity, toast]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!identity) {
      setLoading(false);
      return;
    }
    void load().finally(() => setLoading(false));
  }, [identity, sessionLoading, load]);

  // Poll only while something is genuinely outstanding — an unsettled checkout
  // or a requested plan change. Once nothing is waiting on Dodo, the dashboard
  // goes quiet instead of hammering the API forever.
  const awaitingWebhook =
    data?.purchases.some(
      (p) => p.status === "pending" || p.status === "processing" || p.pendingTierId
    ) ?? false;

  useEffect(() => {
    if (!awaitingWebhook) return;
    const interval = setInterval(() => void load(), WEBHOOK_POLL_MS);
    return () => clearInterval(interval);
  }, [awaitingWebhook, load]);

  // The playground updates the wallet optimistically off its own response, so
  // the credit meters move on the click rather than after a dashboard reload.
  const applyWallet = useCallback((wallet: WalletBalance) => {
    setData((prev) => (prev ? { ...prev, wallet } : prev));
  }, []);

  // Events arrive twice — once on the spend, once when the ingest settles —
  // so the second one replaces the first rather than stacking on top of it.
  const applyEvent = useCallback((event: UsageEvent) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            usageEvents: [event, ...prev.usageEvents.filter((e) => e.id !== event.id)],
          }
        : prev
    );
  }, []);

  const handlePaymentResolved = useCallback(
    (outcome: PaymentOutcome) => {
      // Drop ?checkout= so a refresh doesn't re-open the overlay.
      router.replace("/dashboard");
      setBanner(BANNER_BY_OUTCOME[outcome]);
      if (outcome === "success") void load();
    },
    [router, load]
  );

  if (sessionLoading || loading) return <DashboardSkeleton />;

  if (!identity) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h1 className="text-2xl font-bold text-ink-900">Your dashboard is one click away</h1>
        <p className="mt-2 text-ink-600">
          Continue as a guest — everything you buy follows you if you sign up later.
        </p>
        <div className="mx-auto mt-6 max-w-xs">
          <CtaButton fullWidth arrow onClick={() => openAuthModal()}>
            Continue as guest
          </CtaButton>
        </div>
      </main>
    );
  }

  const wallet = data?.wallet ?? { plan: 0, topup: 0, total: 0 };
  const purchases = data?.purchases ?? [];
  const activePlan =
    purchases.find(
      (p) =>
        (p.billingModel === "subscription" || p.billingModel === "seat_based") &&
        (p.status === "active" || p.status === "scheduled_cancel")
    ) ?? null;
  const usageEnabled = purchases.some(
    (p) => p.billingModel === "usage_based" && (p.status === "active" || p.status === "scheduled_cancel")
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="eyebrow">Dashboard</span>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-ink-900">
            Welcome back, {identity.name?.split(" ")[0] ?? "Guest"}
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            {identity.email ?? "No email on file"} ·{" "}
            {identity.kind === "guest" ? "Guest checkout" : "Registered account"}
          </p>
        </div>
        <CtaButton href="/pricing" dark arrow>
          Browse more products
        </CtaButton>
      </div>

      {banner && (
        <Card
          className={`mt-5 flex items-center justify-between gap-3 px-4 py-3 text-sm ${
            banner.kind === "success"
              ? "border-lime-100 bg-lime-50 text-lime-900"
              : "border-red-100 bg-red-50 text-red-700"
          }`}
        >
          {banner.text}
          <div className="flex shrink-0 items-center gap-3">
            {banner.kind === "failure" && (
              <Link href="/pricing" className="font-semibold underline">
                Retry
              </Link>
            )}
            <button onClick={() => setBanner(null)} className="font-semibold">
              Dismiss
            </button>
          </div>
        </Card>
      )}

      {error && (
        <Card className="mt-5 flex items-center justify-between gap-3 border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => void load()} className="shrink-0 font-semibold underline">
            Retry
          </button>
        </Card>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Active plan"
          value={activePlan ? (activePlan.productName.split("—")[1]?.trim() ?? "Active") : "None"}
          icon={Package}
          hint={
            activePlan?.status === "scheduled_cancel"
              ? "Cancels at period end"
              : activePlan
                ? activePlan.billingCycle === "yearly"
                  ? "Billed yearly"
                  : "Billed monthly"
                : "Pick a plan on pricing"
          }
        />
        <KpiCard
          label="Plan credits"
          value={String(wallet.plan)}
          icon={Wallet}
          hint="Refreshed every billing cycle — spent first"
        />
        <KpiCard
          label="Top-up credits"
          value={String(wallet.topup)}
          icon={Coins}
          tone="lavender"
          hint="Prepaid, never expire"
        />
      </div>

      <div className="mt-8 grid items-stretch gap-6 lg:grid-cols-5">
        <div className="flex flex-col gap-6 lg:col-span-3">
          <PlaygroundButtons
            wallet={wallet}
            simulated={data?.simulated ?? true}
            usageEnabled={usageEnabled}
            onWalletChange={applyWallet}
            onEvent={applyEvent}
          />
          <PurchaseLibrary purchases={purchases} />
        </div>
        <div className="flex min-h-0 flex-col gap-6 lg:col-span-2">
          <SubscriptionCard subscription={activePlan} onChanged={() => void load()} />
          <div className="min-h-0 flex-1">
            <EventLogPanel
              events={data?.usageEvents ?? []}
              simulated={data?.simulated ?? true}
            />
          </div>
        </div>
      </div>

      {checkoutId && (
        <PaymentStatus checkoutId={checkoutId} onResolved={handlePaymentResolved} />
      )}
    </main>
  );
}
