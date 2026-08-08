import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CreditCard, Wallet, Package, ExternalLink, Settings2, XCircle } from "lucide-react";
import { useApp } from "../lib/AppContext";
import { api, Purchase } from "../lib/api";
import { KpiCard } from "../components/KpiCard";
import { CreditPromptBar } from "../components/CreditPromptBar";
import { CancelSubscriptionModal } from "../components/CancelSubscriptionModal";

export function Dashboard() {
  const { identity, loadingIdentity } = useApp();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<Purchase | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!identity) return;
    api
      .getDashboard()
      .then((d) => {
        setPurchases(d.purchases);
        setBalance(d.creditBalance);
      })
      .finally(() => setLoading(false));
  }, [identity]);

  if (loadingIdentity || loading) {
    return <main className="mx-auto max-w-6xl px-6 py-16 text-ink-600">Loading dashboard…</main>;
  }

  if (!identity) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16 text-center">
        <p className="text-ink-600">You need to sign in to view your dashboard.</p>
        <Link to="/pricing" className="btn-primary mt-4 inline-flex">
          Go to pricing
        </Link>
      </main>
    );
  }

  const activePlan = purchases.find(
    (p) => p.billing_model === "subscription" && (p.status === "active" || p.status === "scheduled_cancel")
  );

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
            Welcome back, {identity.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-ink-600 mt-1">
            {identity.email} · {identity.kind === "guest" ? "Guest checkout" : "Registered account"}
          </p>
        </div>
        <Link to="/pricing" className="btn-secondary">
          Browse more products
        </Link>
      </div>

      {actionMsg && (
        <div className="mt-5 card px-4 py-3 bg-lavender-50 border-lavender-100 text-sm text-lavender-600 flex items-center justify-between gap-3">
          {actionMsg}
          <button onClick={() => setActionMsg(null)} className="text-lavender-600 font-semibold shrink-0">
            Dismiss
          </button>
        </div>
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
              ? "Renews automatically"
              : "No active subscription"
          }
        />
        <KpiCard
          label="Price"
          value={activePlan ? `$${activePlan.amount.toFixed(2)}` : "—"}
          icon={CreditCard}
          hint={activePlan ? `Billed ${activePlan.billing_cycle}` : "Pick a plan on pricing"}
        />
        <KpiCard label="Current credits" value={String(balance)} icon={Wallet} hint="Usable across all products" />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button onClick={handlePortal} className="btn-secondary">
          <ExternalLink size={15} /> Customer portal
        </button>
        <button onClick={handlePaymentMethod} className="btn-secondary">
          <Settings2 size={15} /> Update payment method
        </button>
        <button
          onClick={() => activePlan && setCancelTarget(activePlan)}
          disabled={!activePlan || activePlan.status !== "active"}
          className="btn-secondary hover:border-red-300 hover:text-red-600 disabled:opacity-40"
        >
          <XCircle size={15} /> Cancel subscription
        </button>
      </div>

      <div className="mt-8 grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 card p-5">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-lime-700" />
            <h2 className="text-sm font-bold text-ink-900">Your products</h2>
          </div>

          {purchases.length === 0 ? (
            <p className="mt-6 text-sm text-ink-600">
              Nothing purchased yet.{" "}
              <Link to="/pricing" className="text-lime-800 font-semibold">
                Browse pricing
              </Link>{" "}
              to get started.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-ink-100">
              {purchases.map((p) => (
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
                    <span
                      className={`pill ${
                        p.status === "active"
                          ? "bg-lime-100 text-lime-800"
                          : p.status === "scheduled_cancel"
                          ? "bg-lavender-100 text-lavender-600"
                          : "bg-ink-100 text-ink-600"
                      }`}
                    >
                      {p.status.replace("_", " ")}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

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
    </main>
  );
}
