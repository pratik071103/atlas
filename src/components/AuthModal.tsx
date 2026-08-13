"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { launchCheckout } from "@/lib/checkout";
import { useSession } from "./SessionProvider";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Input } from "./ui/Input";

type Tab = "guest" | "signin" | "signup";

const TAB_LABEL: Record<Tab, string> = {
  guest: "Guest",
  signin: "Log in",
  signup: "Sign up",
};

export function AuthModal() {
  const {
    authModalOpen,
    closeAuthModal,
    refresh,
    identity,
    pendingIntent,
    clearPendingIntent,
    setInlineCheckoutOpen,
  } = useSession();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("guest");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // A guest opening the modal is here to upgrade, not to start over — so drop
  // them straight on the sign-up tab.
  useEffect(() => {
    if (authModalOpen) setTab(identity?.kind === "guest" ? "signup" : "guest");
  }, [authModalOpen, identity?.kind]);

  // Escape closes, matching every other overlay in the app.
  useEffect(() => {
    if (!authModalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeAuthModal();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [authModalOpen, closeAuthModal]);

  if (!authModalOpen) return null;

  /**
   * Picks the purchase back up where the sign-in gate interrupted it, so the
   * customer lands on checkout rather than back at the pricing shelf.
   */
  async function resumePendingCheckout() {
    if (!pendingIntent) return;
    const intent = pendingIntent;
    clearPendingIntent();

    try {
      const session = await api.createCheckoutSession({
        productId: intent.productId,
        tierId: intent.tierId,
        billingCycle: intent.billingCycle,
        mode: intent.mode,
      });
      if (intent.mode === "inline") setInlineCheckoutOpen(true);
      await launchCheckout(session, intent.mode, () => router.push("/dashboard"));
    } catch {
      // Checkout failing should not strand a customer who did successfully
      // sign in — put them on the dashboard, signed in, and let them retry.
      router.push("/dashboard");
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // Better Auth returns errors in the response rather than throwing, so
      // each call is checked explicitly.
      const result =
        tab === "guest"
          ? await authClient.signIn.anonymous()
          : tab === "signup"
            ? await authClient.signUp.email({ name, email, password })
            : await authClient.signIn.email({ email, password });

      if (result.error) {
        setError(result.error.message ?? "Could not sign you in. Please try again.");
        return;
      }
      await refresh();
      closeAuthModal();
      setPassword("");
      await resumePendingCheckout();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const isGuestUpgrade = identity?.kind === "guest";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to Atlas Studio"
    >
      <Card className="w-full max-w-md p-6 relative animate-fade-up">
        <button
          onClick={closeAuthModal}
          className="absolute right-4 top-4 text-ink-400 hover:text-ink-800"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <h2 className="text-xl font-semibold text-ink-900">
          {pendingIntent
            ? `Continue to buy ${pendingIntent.tierLabel}`
            : isGuestUpgrade
              ? "Keep your guest progress"
              : "Sign in to Atlas Studio"}
        </h2>
        {pendingIntent && (
          <p className="mt-1 text-sm text-ink-400">
            {pendingIntent.productName} — ${pendingIntent.amount}
            {pendingIntent.billingCycle === "yearly" ? " /yr" : ""}
          </p>
        )}
        {isGuestUpgrade && !pendingIntent && (
          <p className="mt-1 text-sm text-ink-600">
            Create an account and every purchase, credit and license you picked up as a guest
            moves across with you.
          </p>
        )}

        <div className="mt-5 inline-flex rounded-lg border border-ink-100 p-1 w-full">
          {(Object.keys(TAB_LABEL) as Tab[])
            // A signed-in guest has no use for the guest tab.
            .filter((t) => !(isGuestUpgrade && t === "guest"))
            .map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 rounded-md px-2 py-1.5 text-sm font-semibold transition-colors ${
                  tab === t ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-50"
                }`}
              >
                {TAB_LABEL[t]}
              </button>
            ))}
        </div>

        <form onSubmit={submit} className="mt-5 space-y-3">
          {tab === "signup" && (
            <Input
              required
              label="Full name"
              value={name}
              onChange={setName}
              placeholder="Ada Lovelace"
            />
          )}
          {tab !== "guest" && (
            <Input
              required
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="ada@example.com"
            />
          )}
          {tab === "guest" && (
            <p className="text-xs leading-relaxed text-ink-400">
              Continue without an account — no details needed here. Billing information is
              collected on the secure payment page during checkout. If you create an account
              later, anything you bought as a guest moves across with you.
            </p>
          )}
          {tab !== "guest" && (
            <Input
              required
              minLength={8}
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
            />
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" loading={busy} fullWidth className="mt-2">
            {tab === "guest"
              ? "Continue as guest"
              : tab === "signin"
                ? "Log in"
                : "Create account"}
          </Button>
        </form>

        <p className="mt-4 text-xs text-ink-400 text-center">
          Auth by Better Auth with the Dodo Payments adapter — a customer record is created for
          you on sign-up.
        </p>
      </Card>
    </div>
  );
}
