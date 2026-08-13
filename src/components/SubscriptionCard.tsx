"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Clock, XCircle } from "lucide-react";
import { findProduct, formatPrice, tierPrice, type PriceTier } from "@shared/catalog";
import { api, type Purchase } from "@/lib/api";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { CancelSubscriptionModal } from "./CancelSubscriptionModal";

// ---------------------------------------------------------------------------
// Current plan, and the two things you can do to it.
//
// Upgrade/downgrade go through subscriptions.changePlan with
// prorated_immediately. Dodo confirms asynchronously, so the card shows a
// "moving to X" banner from the moment the request is accepted until the
// plan_changed webhook actually repoints the purchase — rather than flipping
// the tier optimistically and having it snap back if the change is refused.
// ---------------------------------------------------------------------------

interface Props {
  subscription: Purchase | null;
  onChanged: () => void;
}

export function SubscriptionCard({ subscription, onChanged }: Props) {
  const [busyTierId, setBusyTierId] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!subscription) {
    return (
      <Card className="p-5">
        <h2 className="text-sm font-bold text-ink-900">Subscription</h2>
        <p className="mt-2 text-sm text-ink-600">
          No active plan. Subscriptions and seats grant plan credits that refresh every billing
          cycle.
        </p>
        <Button href="/pricing" variant="secondary" className="mt-4">
          See plans
        </Button>
      </Card>
    );
  }

  const product = findProduct(subscription.productId);
  const current = product?.tiers.find((t) => t.id === subscription.tierId) ?? null;
  const alternatives = product?.tiers.filter((t) => t.id !== subscription.tierId) ?? [];
  const cycle = subscription.billingCycle === "yearly" ? "yearly" : "monthly";
  const pendingTier = subscription.pendingTierId
    ? (product?.tiers.find((t) => t.id === subscription.pendingTierId) ?? null)
    : null;

  /** Ranked by price, so the button can say which direction you're going. */
  function isUpgrade(tier: PriceTier) {
    return current ? tierPrice(tier, cycle) > tierPrice(current, cycle) : true;
  }

  async function change(tier: PriceTier) {
    if (!subscription) return;
    setBusyTierId(tier.id);
    setError(null);
    setMessage(null);
    try {
      const result = await api.changePlan(subscription.id, tier.id);
      setMessage(
        result.applied
          ? `You're now on ${result.productName}.`
          : `Requested ${result.productName}. Dodo confirms plan changes by webhook — the card updates the moment it lands.`
      );
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyTierId(null);
    }
  }

  async function cancel(mode: "immediate" | "schedule") {
    if (!subscription) return;
    setError(null);
    try {
      const { status } = await api.cancelSubscription(subscription.id, mode);
      setMessage(
        status === "cancelled"
          ? `${subscription.productName} was cancelled immediately.`
          : `${subscription.productName} will cancel at the end of the current billing period.`
      );
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCancelOpen(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-ink-900">Subscription</h2>
          <p className="mt-1 text-2xl font-bold font-display text-ink-900">
            {current?.label ?? subscription.productName}
          </p>
          <p className="text-xs text-ink-400">
            {current ? formatPrice(tierPrice(current, cycle)) : formatPrice(subscription.amount)} ·{" "}
            {cycle === "yearly" ? "billed yearly" : "billed monthly"} ·{" "}
            {subscription.creditsGranted} plan credits
          </p>
        </div>
        <Badge tone={subscription.status === "scheduled_cancel" ? "lavender" : "lime"}>
          {subscription.status.replace("_", " ")}
        </Badge>
      </div>

      {pendingTier && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-lavender-200 bg-lavender-50 px-3 py-2 text-xs text-lavender-600">
          <Clock size={13} className="mt-0.5 shrink-0" />
          Moving to {pendingTier.label} — waiting on Dodo to confirm the plan change.
        </div>
      )}

      {alternatives.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            Change plan
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {alternatives.map((tier) => {
              const up = isUpgrade(tier);
              const Icon = up ? ArrowUpRight : ArrowDownRight;
              return (
                <button
                  key={tier.id}
                  type="button"
                  disabled={busyTierId !== null || subscription.status !== "active"}
                  onClick={() => void change(tier)}
                  className="flex items-center justify-between gap-2 rounded-lg border border-ink-100 px-3 py-2.5 text-left transition-colors hover:border-ink-800 disabled:pointer-events-none disabled:opacity-40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink-900">
                      {busyTierId === tier.id ? "Requesting…" : tier.label}
                    </span>
                    <span className="block text-xs text-ink-400">
                      {formatPrice(tierPrice(tier, cycle))} · {tier.credits ?? 0} credits
                    </span>
                  </span>
                  <Icon size={15} className={up ? "text-lime-700" : "text-ink-400"} />
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-ink-400">
            Changes bill <strong>prorated immediately</strong> — the difference for the rest of
            this period is settled straight away.
          </p>
        </div>
      )}

      {message && (
        <p className="mt-4 rounded-lg bg-lime-50 px-3 py-2 text-xs text-lime-900">{message}</p>
      )}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <Button
        variant="danger"
        className="mt-4"
        disabled={subscription.status !== "active"}
        onClick={() => setCancelOpen(true)}
      >
        <XCircle size={15} /> Cancel subscription
      </Button>

      {cancelOpen && (
        <CancelSubscriptionModal
          planName={subscription.productName}
          onClose={() => setCancelOpen(false)}
          onConfirm={cancel}
        />
      )}
    </Card>
  );
}
