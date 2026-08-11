import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CreditCard, Wallet, Package, ExternalLink, Settings2, XCircle } from "lucide-react";
import { useApp } from "../lib/AppContext";
import { api, Purchase } from "../lib/api";
import { KpiCard } from "../components/KpiCard";
import { CreditPromptBar } from "../components/CreditPromptBar";
import { CancelSubscriptionModal } from "../components/CancelSubscriptionModal";
import { PaymentStatus, PaymentOutcome } from "../components/PaymentStatus";
import { Button, CtaButton } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";

interface PaymentBanner {
  kind: "success" | "failure";
  text: string;
}

export function Dashboard() {
  const { identity, loadingIdentity } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<Purchase | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [paymentBanner, setPaymentBanner] = useState<PaymentBanner | null>(null);

  const checkoutId = searchParams.get("checkout");

  const loadDashboard = useCallback(async () => {
    if (!identity) return;
    const d = await api.getDashboard();
    setPurchases(d.purchases);
    setBalance(d.creditBalance);
  }, [identity]);

  useEffect(() => {
    if (!identity) return;
    loadDashboard().finally(() => setLoading(false));
  }, [identity, loadDashboard]);

  const handlePaymentResolved = useCallback(
    (outcome: PaymentOutcome) => {
      // Clear the ?checkout= param so a refresh doesn't re-open the overlay.
      setSearchParams({}, { replace: true });
      if (outcome === "success") {
        setPaymentBanner({
          kind: "success",
          text: "Payment successful — your purchase is active and credits have been added.",
        });
        loadDashboard();
      } else if (outcome === "failure") {
        setPaymentBanner({
          kind: "failure",
          text: "Payment failed or was cancelled. Nothing was charged — you can retry from the pricing page.",
        });
      } else {
        setPaymentBanner({
          kind: "failure",
          text: "We haven't received the payment confirmation yet. Check back soon or retry from the pricing page.",
        });
      }
    },
    [setSearchParams, loadDashboard]
  );

  if (loadingIdentity || loading) {
    return <main className="mx-auto max-w-6xl px-6 py-16 text-ink-600">Loading dashboard…</main>;
  }

  if (!identity) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16 text-center">
        <p className="text-ink-600">You need to sign in to view your dashboard.</p>
        <CtaButton to="/pricing" arrow fullWidth className="mt-4 max-w-xs mx-auto">
          Go to pricing
        </CtaButton>
      </main>
    );
  }

  // Filter out pending/processing items older than 24 hours (86400000 ms)
  const now = Date.now();
  const validPurchases = purchases.filter((p) => {
    if (p.status === "pending" || p.status === "processing") {
      const createdTime = new Date(p.created_at).getTime();
      return !isNaN(createdTime) && now - createdTime < 24 * 60 * 60 * 1000;
    }
    return true;
  });

  const awaitingPayment = validPurchases.some(
    (p) => p.status === "pending" || p.status === "processing"
  );
  const activePlan =
    validPurchases.find((p) => p.status === "active" || p.status === "scheduled_cancel") ?? null;

  function planHint(p: Purchase): string {
    switch (p.billing_model) {
      case "subscription":
        return p.billing_cycle === "yearly" ? "Billed yearly" : "Billed monthly";
      case "seat_based":
        return "Per seat, billed monthly";
      case "usage_based":
        return "Billed by usage";
      case "on_demand":
        return "Prepaid — never expires";
      default:
        return "One-time purchase";
    }
  }

  async function handlePortal() {
    const { url } = await api.openCustomerPortal();
    setActionMsg(`Demo only — a real integration would redirect to: ${url}`);
  }

  async function handlePaymentMethod() {
    const { url } = await api.updatePaymentMethod();
    setActionMsg(`Demo only — a real integration would redirect to: ${url}`);
  }

  async function handleCancelConfirm(mode: "immediate" | "schedule") {
    if (!cancelTarget) return;
    const { status } = await api.cancelSubscription(cancelTarget.id, mode);
    setPurchases((prev) =>
      prev.map((p) => (p.id === cancelTarget.id ? { ...p, status } : p))
    );
    setCancelTarget(null);
    setActionMsg(
      status === "canceled"
        ? `${cancelTarget.product_name} was cancelled immediately.`
        : `${cancelTarget.product_name} will cancel at the end of the current billing period.`
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="eyebrow">Dashboard</span>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-ink-900">
            Welcome back, {identity.name?.split(" ")[0] ?? "Guest"}
          </h1>
          <p className="text-sm text-ink-600 mt-1">
            {identity.email ?? "No email on file"} ·{" "}
            {identity.kind === "guest" ? "Guest checkout" : "Registered account"}
          </p>
        </div>
        <CtaButton to="/pricing" dark arrow>
          Browse more products
        </CtaButton>
      </div>

      {paymentBanner && (
        <Card
          className={`mt-5 px-4 py-3 text-sm flex items-center justify-between gap-3 ${
            paymentBanner.kind === "success"
              ? "bg-lime-50 border-lime-100 text-lime-900"
              : "bg-red-50 border-red-100 text-red-700"
          }`}
        >
          {paymentBanner.text}
          <div className="flex items-center gap-3 shrink-0">
            {paymentBanner.kind === "failure" && (
              <Link to="/pricing" className="font-semibold underline">
                Retry
              </Link>
            )}
            <button
              onClick={() => setPaymentBanner(null)}
              className="font-semibold shrink-0"
            >
              Dismiss
            </button>
          </div>
        </Card>
      )}

      {actionMsg && (
        <Card className="mt-5 px-4 py-3 bg-lavender-50 border-lavender-100 text-sm text-lavender-600 flex items-center justify-between gap-3">
          {actionMsg}
          <button onClick={() => setActionMsg(null)} className="text-lavender-600 font-semibold shrink-0">
            Dismiss
          </button>
        </Card>
      )}

      <div className="mt-8 grid sm:grid-cols-3 gap-4">
        <KpiCard
          label="Active plan"
          value={activePlan ? activePlan.product_name.split("—")[1]?.trim() ?? activePlan.product_name : "None"}
          icon={Package}
          hint={
            activePlan?.status === "scheduled_cancel"
              ? "Cancels at period end"
              : activePlan
              ? planHint(activePlan)
              : awaitingPayment
              ? "Awaiting payment confirmation"
              : "Pick a plan on pricing"
          }
        />
        <KpiCard
          label="Price"
          value={activePlan ? `$${activePlan.amount.toFixed(2)}` : "—"}
          icon={CreditCard}
          hint={activePlan ? planHint(activePlan) : "Pick a plan on pricing"}
        />
        <KpiCard label="Current credits" value={String(balance)} icon={Wallet} hint="Usable across all products" />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button variant="secondary" onClick={handlePortal}>
          <ExternalLink size={15} /> Customer portal
        </Button>
        <Button variant="secondary" onClick={handlePaymentMethod}>
          <Settings2 size={15} /> Update payment method
        </Button>
        <Button
          variant="danger"
          onClick={() =>
            activePlan &&
            activePlan.billing_model === "subscription" &&
            activePlan.status === "active" &&
            setCancelTarget(activePlan)
          }
          disabled={
            !activePlan ||
            activePlan.billing_model !== "subscription" ||
            activePlan.status !== "active"
          }
        >
          <XCircle size={15} /> Cancel subscription
        </Button>
      </div>

      <div className="mt-8 grid lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3 p-5 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-lime-700" />
              <h2 className="text-sm font-bold text-ink-900">Your products</h2>
            </div>
            {validPurchases.length > 5 && (
              <span className="text-xs text-ink-400 font-medium">
                {validPurchases.length} items (scroll to view all)
              </span>
            )}
          </div>

          {validPurchases.length === 0 ? (
            <p className="mt-6 text-sm text-ink-600">
              Nothing purchased yet.{" "}
              <Link to="/pricing" className="text-lime-800 font-semibold">
                Browse pricing
              </Link>{" "}
              to get started.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-ink-100 max-h-[320px] overflow-y-auto pr-1.5">
              {validPurchases.map((p) => (
                <li key={p.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{p.product_name}</p>
                    <p className="text-xs text-ink-400">
                      {p.billing_model.replace("_", " ")} · {p.checkout_mode} ·{" "}
                      {new Date(p.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-ink-900">${p.amount.toFixed(2)}</p>
                    <Badge
                      tone={
                        p.status === "active"
                          ? "lime"
                          : p.status === "scheduled_cancel"
                          ? "lavender"
                          : "ink"
                      }
                    >
                      {p.status.replace("_", " ")}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="lg:col-span-2">
          <CreditPromptBar balance={balance} onBalanceChange={setBalance} />
        </div>
      </div>

      {cancelTarget && (
        <CancelSubscriptionModal
          planName={cancelTarget.product_name}
          onClose={() => setCancelTarget(null)}
          onConfirm={handleCancelConfirm}
        />
      )}

      {checkoutId && (
        <PaymentStatus checkoutId={checkoutId} onResolved={handlePaymentResolved} />
      )}
    </main>
  );
}
