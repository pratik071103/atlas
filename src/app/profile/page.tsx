"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, KeyRound, LogOut, Sparkles, UserPlus, Users } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { CreditMeter } from "@/components/CreditMeter";
import { SubscriptionCard } from "@/components/SubscriptionCard";
import { useSession } from "@/components/SessionProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, type BillingSnapshot, type License, type TeamRow } from "@/lib/api";
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
  const [ownedTeam, setOwnedTeam] = useState<TeamRow | null>(null);
  const [memberOfTeam, setMemberOfTeam] = useState<TeamRow | null>(null);

  const [name, setName] = useState("");
  const [theme, setTheme] = useState<CheckoutTheme>("light");
  const [savingName, setSavingName] = useState(false);
  const [deactivatingLicense, setDeactivatingLicense] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!identity) {
      setLoading(false);
      return;
    }
    try {
      const [snapshot, licenseData, teamData] = await Promise.all([
        api.getBilling(),
        api.getLicenses(),
        api.getTeam().catch(() => ({ owned: null, memberOf: null })),
      ]);
      setBilling(snapshot);
      setLicenses(licenseData.licenses);
      setName(snapshot.identity.name ?? "");
      if (teamData.owned) setOwnedTeam(teamData.owned.team);
      if (teamData.memberOf) setMemberOfTeam(teamData.memberOf.team);
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

  async function deactivateProfileLicense(license: License) {
    setDeactivatingLicense(license.id);
    setError(null);
    setNotice(null);
    try {
      await api.deactivateLicense(license.key);
      setNotice("License instance deactivated.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeactivatingLicense(null);
    }
  }

  /** Real Dodo-hosted portal, via the adapter. Guests have no customer yet. */
  async function openPortal() {
    setError(null);
    setNotice(null);
    if (identity?.kind === "guest") {
      setError("Create an account to manage billing — guests have no customer record yet.");
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

          <div className="mt-5 flex flex-wrap gap-2 border-t border-ink-100 pt-4">
            <Button variant="secondary" onClick={openPortal}>
              <ExternalLink size={15} /> Customer portal
            </Button>
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

        {/* Team card */}
        <Card className="p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-ink-900">
            <Users size={14} /> Team workspace
          </h2>
          {ownedTeam ? (
            <>
              <p className="mt-2 text-sm text-ink-600">
                You own <strong>{ownedTeam.name}</strong> ({ownedTeam.seatCount} seat
                {ownedTeam.seatCount !== 1 ? "s" : ""})
              </p>
              <Button href="/team" variant="secondary" className="mt-4">
                Manage team →
              </Button>
            </>
          ) : memberOfTeam ? (
            <>
              <p className="mt-2 text-sm text-ink-600">
                Member of <strong>{memberOfTeam.name}</strong>
              </p>
              <Button href="/team" variant="secondary" className="mt-4">
                View workspace →
              </Button>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-ink-600">
                Buy seats to invite teammates. Each seat includes 20 monthly credits and a
                unique invite link.
              </p>
              <Button href="/pricing" variant="secondary" className="mt-4">
                <Users size={14} /> Add seats — $8/seat/mo
              </Button>
            </>
          )}
        </Card>

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
                    {l.instanceId && (
                      <p className="mt-1 text-[11px] text-ink-500">
                        {l.instanceName ?? "Instance"}: <code>{l.instanceId}</code>
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={l.status === "active" ? "lime" : "ink"}>{l.status}</Badge>
                    {l.status === "active" && (
                      <Button
                        variant="danger"
                        size="sm"
                        loading={deactivatingLicense === l.id}
                        onClick={() => void deactivateProfileLicense(l)}
                      >
                        Deactivate
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
