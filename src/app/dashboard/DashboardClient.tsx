"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { StorefrontButton } from "@/components/ui/StorefrontButton";
import { SweptTitle, CAPTION_STYLE } from "@/components/ui/SweptTitle";
import { TextHighlight } from "@/components/ui/TextHighlight";
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
  const { identity, loading: sessionLoading, openAuthModal, setAppError } = useSession();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [data, setData] = useState<BillingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

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
      setAppError(null);
    } catch (e) {
      setAppError((e as Error).message, "Dashboard");
    }
  }, [identity, toast, setAppError]);

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
      // Was a dismissable <Card> banner wedged above the KPIs, which pushed
      // the whole page down on arrival. The toaster already exists for exactly
      // this kind of "something finished" message.
      const banner = BANNER_BY_OUTCOME[outcome];
      if (banner.kind === "success") toast("success", "Payment successful", banner.text);
      else setAppError(banner.text, "Payment");
      if (outcome === "success") void load();
    },
    [router, load, toast, setAppError]
  );

  if (sessionLoading || loading) return <DashboardSkeleton />;

  if (!identity) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-16 md:pt-24">
        <SweptTitle word="DASHBOARD" />
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <p className="max-w-sm" style={CAPTION_STYLE}>
            Everything you buy follows you if you sign up later —{" "}
            <TextHighlight animated={false} tone="blue">
              <span className="font-semibold text-white">continue as a guest.</span>
            </TextHighlight>
          </p>
          <StorefrontButton
            label="CONTINUE AS GUEST"
            variant="blue"
            onClick={() => openAuthModal()}
            ariaLabel="Continue as guest"
          />
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
    <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-16 md:pt-24">
      {/* Same opening as /pricing and /studio: the big swept title flush left,
          a mono caption pushed right. Replaces an eyebrow + <h1> + subtitle
          stack that shared nothing with the rest of the app. */}
      <SweptTitle word="DASHBOARD" />

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-sm" style={CAPTION_STYLE}>
          {identity.email ?? "No email on file"} ·{" "}
          <TextHighlight animated={false} tone={identity.kind === "guest" ? "lime" : "blue"}>
            <span
              className={`font-semibold ${identity.kind === "guest" ? "text-ink-900" : "text-white"}`}
            >
              {identity.kind === "guest" ? "guest checkout" : "registered account"}
            </span>
          </TextHighlight>
        </p>
        <StorefrontButton href="/pricing" label="BROWSE PRODUCTS" variant="blue" />
      </div>

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
