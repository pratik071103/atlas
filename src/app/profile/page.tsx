"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Info, KeyRound, LogOut, Sparkles, UserPlus } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { CreditMeter } from "@/components/CreditMeter";
import { SubscriptionCard } from "@/components/SubscriptionCard";
import { useSession } from "@/components/SessionProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, type BillingSnapshot, type License } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

type CheckoutTheme = "light" | "dark" | "system";

const THEMES: { id: CheckoutTheme; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

export default function ProfilePage() {
  const { identity, loading: sessionLoading, signOut, openAuthModal, refresh } = useSession();
  const router = useRouter();

  const [billing, setBilling] = useState<BillingSnapshot | null>(null);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [theme, setTheme] = useState<CheckoutTheme>("light");
  const [savingName, setSavingName] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Plan change settings (persisted in localStorage)
const [planChangeSettings, setPlanChangeSettings] = useState<{
    proration_billing_mode: "prorated_immediately" | "full_immediately" | "difference_immediately" | "do_not_bill";
    effective_at: "immediately" | "next_billing_date";
    on_payment_failure: "prevent_change" | "apply_change";
    discount_codes: string;
  }>({
    proration_billing_mode: "prorated_immediately",
    effective_at: "immediately",
    on_payment_failure: "prevent_change",
    discount_codes: "",
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Dodo constraint: next_billing_date only works with full_immediately proration
  const canSchedule = planChangeSettings.proration_billing_mode === "full_immediately";
  const effectiveProrationMode = planChangeSettings.effective_at === "next_billing_date"
    ? "full_immediately"
    : planChangeSettings.proration_billing_mode;
  const isProrationLocked = planChangeSettings.effective_at === "next_billing_date";

  // Load settings from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("planChangeSettings");
      if (saved) {
        try {
          setPlanChangeSettings(JSON.parse(saved));
        } catch {
          // ignore corrupted data
        }
      }
    }
  }, []);

  const load = useCallback(async () => {
    if (!identity) {
      setLoading(false);
      return;
    }
    try {
      const [snapshot, licenseData] = await Promise.all([api.getBilling(), api.getLicenses()]);
      setBilling(snapshot);
      setLicenses(licenseData.licenses);
      setName(snapshot.identity.name ?? "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [identity]);

  useEffect(() => {
    if (sessionLoading) return;
    void load();
  }, [sessionLoading, load]);

  // The theme lives on the Better Auth user record, not in this component —
  // seed the control from the session once it resolves.
  useEffect(() => {
    if (identity) setTheme(identity.checkoutTheme);
  }, [identity]);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setSavingName(true);
    setError(null);
    setNotice(null);
    try {
      const { error: updateError } = await authClient.updateUser({ name });
      if (updateError) throw new Error(updateError.message ?? "Could not save your name.");
      await refresh();
      setNotice("Display name updated.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingName(false);
    }
  }

  async function saveTheme(next: CheckoutTheme) {
    const previous = theme;
    setTheme(next);
    setError(null);
    try {
      const { error: updateError } = await authClient.updateUser({ checkoutTheme: next });
      if (updateError) throw new Error(updateError.message ?? "Could not save that preference.");
      setNotice(`Checkout will render in ${next} from now on.`);
    } catch (e) {
      setTheme(previous);
      setError((e as Error).message);
    }
  }

  function savePlanChangeSettings() {
    setSavingSettings(true);
    setError(null);
    setNotice(null);
    try {
      const toSave = {
        proration_billing_mode: planChangeSettings.proration_billing_mode,
        effective_at: planChangeSettings.effective_at,
        on_payment_failure: planChangeSettings.on_payment_failure,
        discount_codes: planChangeSettings.discount_codes,
      };
      localStorage.setItem("planChangeSettings", JSON.stringify(toSave));
      setNotice("Plan change defaults saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingSettings(false);
    }
  }

  /** Real Dodo-hosted portal, via the adapter. Requires a completed purchase. */
  async function openPortal() {
    setError(null);
    setNotice(null);
    if (!hasCompletedPurchase) {
      setError("Complete a purchase to access the customer portal.");
      return;
    }
    try {
      const { data, error: portalError } = await authClient.dodopayments.customer.portal();
      if (portalError || !data?.url) {
        setError(portalError?.message ?? "Could not open the customer portal.");
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (sessionLoading || loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <Skeleton className="h-10 w-48" />
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-xl2" />
          <Skeleton className="h-72 rounded-xl2" />
        </div>
      </main>
    );
  }

  if (!identity) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-24 text-center">
        <h1 className="text-2xl font-bold text-ink-900">Sign in to see your profile</h1>
        <Button className="mt-5" onClick={() => openAuthModal()}>
          Sign in or continue as guest
        </Button>
      </main>
    );
  }

  const isGuest = identity.kind === "guest";
  const wallet = billing?.wallet ?? { plan: 0, topup: 0, total: 0 };
  const subscription =
    billing?.purchases.find(
      (p) =>
        (p.billingModel === "subscription" || p.billingModel === "seat_based") &&
        (p.status === "active" || p.status === "scheduled_cancel")
    ) ?? null;

  // Only show portal if user has completed at least one purchase
  const hasCompletedPurchase = billing?.purchases.some(
    (p) => ["active", "scheduled_cancel", "cancelled"].includes(p.status)
  ) ?? false;

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <span className="eyebrow">Profile</span>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Avatar
          userId={identity.id}
          name={identity.name}
          className="h-16 w-16 text-xl"
        />
        <div>
          <h1 className="text-3xl font-bold text-ink-900">
            {identity.name ?? "Guest account"}
          </h1>
          <p className="mt-0.5 flex items-center gap-2 text-sm text-ink-600">
            {identity.email ?? "No email on file"}
            <Badge tone={isGuest ? "ink" : "lime"}>{isGuest ? "Guest" : "Registered"}</Badge>
          </p>
        </div>
      </div>

      {isGuest && (
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 border-lavender-200 bg-lavender-50 px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-lavender-600">
            <Sparkles size={15} />
            You&apos;re browsing as a guest. Create an account and every purchase, credit and
            license comes with you.
          </p>
          <Button variant="dark" onClick={() => openAuthModal()}>
            <UserPlus size={15} /> Create account
          </Button>
        </Card>
      )}

      {notice && (
        <Card className="mt-5 border-lime-100 bg-lime-50 px-4 py-3 text-sm text-lime-900">
          {notice}
        </Card>
      )}
      {error && (
        <Card className="mt-5 border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </Card>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-bold text-ink-900">Account</h2>

          <form onSubmit={saveName} className="mt-4 space-y-3">
            <Input
              label="Display name"
              value={name}
              onChange={setName}
              placeholder={isGuest ? "Add a name" : "Ada Lovelace"}
            />
            <Button type="submit" variant="secondary" loading={savingName} disabled={!name.trim()}>
              Save name
            </Button>
          </form>

          <div className="mt-5 border-t border-ink-100 pt-4">
            <p className="text-xs font-semibold text-ink-600">Checkout appearance</p>
            <p className="mt-0.5 text-xs text-ink-400">
              Applied to the Dodo-hosted, overlay and inline checkout.
            </p>
            <div className="mt-2 inline-flex rounded-full border border-ink-200 p-1">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => void saveTheme(t.id)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    theme === t.id ? "bg-ink-900 text-white" : "text-ink-600 hover:text-ink-900"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 border-t border-ink-100 pt-4">
            <p className="text-xs font-semibold text-ink-600">Plan change behavior</p>
            <p className="mt-0.5 text-xs text-ink-400">
              Defaults applied when upgrading or downgrading your subscription.
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Proration mode</label>
                <select
                  value={effectiveProrationMode}
                  onChange={isProrationLocked ? undefined : (e) => setPlanChangeSettings({ ...planChangeSettings, proration_billing_mode: e.target.value as any })}
                  disabled={isProrationLocked}
                  className={`w-full sm:w-64 px-3 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500 ${
                    isProrationLocked ? "bg-ink-50 text-ink-400 cursor-not-allowed" : "bg-white"
                  }`}
                >
                  <option value="prorated_immediately">Prorated immediately (charge/credit difference for remainder of period)</option>
                  <option value="full_immediately">Full immediately (charge full new price, credit unused portion)</option>
                  <option value="difference_immediately">Difference immediately (charge price difference for remainder)</option>
                  <option value="do_not_bill">Do not bill (change takes effect, no proration charge)</option>
                </select>
                {isProrationLocked && (
                  <p className="mt-1 text-[11px] text-lime-700">
                    ℹ Locked to "Full immediately" — required for scheduled changes (Dodo constraint).
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">When to apply</label>
                <select
                  value={planChangeSettings.effective_at}
                  onChange={(e) => {
                    const next = e.target.value as "immediately" | "next_billing_date";
                    // If user tries to select next_billing_date without full_immediately, force proration mode
                    if (next === "next_billing_date" && !canSchedule) {
                      setPlanChangeSettings({
                        ...planChangeSettings,
                        proration_billing_mode: "full_immediately",
                        effective_at: next,
                      });
                    } else {
                      setPlanChangeSettings({ ...planChangeSettings, effective_at: next });
                    }
                  }}
                  className="w-full sm:w-64 px-3 py-2 text-sm border border-ink-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-lime-500"
                >
                  <option value="immediately">Immediately</option>
                  <option
                    value="next_billing_date"
                    disabled={!canSchedule}
                  >
                    Next billing date{!canSchedule ? " (requires Full immediately proration)" : ""}
                  </option>
                </select>
                {!canSchedule && planChangeSettings.effective_at === "next_billing_date" && (
                  <p className="mt-1 text-[11px] text-lime-700">
                    ℹ Switched proration to "Full immediately" — required for scheduled changes.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">On payment failure</label>
                <select
                  value={planChangeSettings.on_payment_failure}
                  onChange={(e) => setPlanChangeSettings({ ...planChangeSettings, on_payment_failure: e.target.value as any })}
                  className="w-full sm:w-64 px-3 py-2 text-sm border border-ink-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-lime-500"
                >
                  <option value="prevent_change">Prevent change (keep current plan until payment succeeds)</option>
                  <option value="apply_change">Apply change anyway (grant new plan immediately)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Discount codes (comma-separated)</label>
                <input
                  type="text"
                  value={planChangeSettings.discount_codes}
                  onChange={(e) => setPlanChangeSettings({ ...planChangeSettings, discount_codes: e.target.value })}
                  placeholder="CODE1, CODE2"
                  className="w-full sm:w-64 px-3 py-2 text-sm border border-ink-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-lime-500"
                />
                <p className="mt-1 text-[11px] text-ink-400">Max 20 codes, applied in order. Empty = remove all discounts.</p>
              </div>
              <Button variant="secondary" onClick={savePlanChangeSettings} loading={savingSettings}>
                Save defaults
              </Button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-ink-100 pt-4">
            {hasCompletedPurchase && (
              <Button variant="secondary" onClick={openPortal}>
                <ExternalLink size={15} /> Customer portal
              </Button>
            )}
            <Button
              variant="danger"
              onClick={async () => {
                await signOut();
                router.push("/");
              }}
            >
              <LogOut size={15} /> Sign out
            </Button>
          </div>
        </Card>

        <CreditMeter wallet={wallet} ledger={billing?.ledger ?? []} />

        <SubscriptionCard subscription={subscription} onChanged={() => void load()} />

        <Card className="p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-ink-900">
            <KeyRound size={14} /> Licenses
          </h2>
          {licenses.length === 0 ? (
            <>
              <p className="mt-2 text-sm text-ink-600">
                No license keys yet. The Studio Pass issues one that unlocks the premium gallery.
              </p>
              <Button href="/studio" variant="secondary" className="mt-4">
                Open the studio
              </Button>
            </>
          ) : (
            <ul className="mt-3 divide-y divide-ink-100">
              {licenses.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <code className="block truncate font-mono text-xs text-ink-800">{l.key}</code>
                    <p className="text-[11px] text-ink-400">
                      {l.productName}
                      {l.simulated && " · simulated"}
                    </p>
                  </div>
                  <Badge tone={l.status === "active" ? "lime" : "ink"}>{l.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
