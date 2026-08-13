"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Coins, Package, Wallet } from "lucide-react";
import { KpiCard } from "@/components/KpiCard";
import { PaymentStatus, type PaymentOutcome } from "@/components/PaymentStatus";
import { PurchaseLibrary } from "@/components/PurchaseLibrary";
import { useSession } from "@/components/SessionProvider";
import { CtaButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { api, type BillingSnapshot } from "@/lib/api";
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

export function DashboardClient() {
  const { identity, loading: sessionLoading, openAuthModal } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [data, setData] = useState<BillingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);

  const checkoutId = searchParams.get("checkout");

  const load = useCallback(async () => {
    if (!identity) return;
    try {
      setData(await api.getBilling());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [identity]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!identity) {
      setLoading(false);
      return;
    }
    void load().finally(() => setLoading(false));
  }, [identity, sessionLoading, load]);

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
        p.billingModel === "subscription" &&
        (p.status === "active" || p.status === "scheduled_cancel")
    ) ?? null;

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

      <div className="mt-8">
        <PurchaseLibrary purchases={purchases} />
      </div>

      {checkoutId && (
        <PaymentStatus checkoutId={checkoutId} onResolved={handlePaymentResolved} />
      )}
    </main>
  );
}
