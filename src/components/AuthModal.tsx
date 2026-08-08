import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { useApp } from "../lib/AppContext";
import { api } from "../lib/api";

type Tab = "guest" | "signin" | "signup";

export function AuthModal() {
  const { authModalOpen, closeAuthModal, refreshIdentity, pendingIntent, clearPendingIntent } =
    useApp();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("guest");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [billingAddress, setBillingAddress] = useState("");

  if (!authModalOpen) return null;

  async function afterAuthSuccess() {
    await refreshIdentity();
    if (pendingIntent) {
      try {
        await api.createCheckoutSession({
          productId: pendingIntent.productId,
          tierId: pendingIntent.tierId,
          billingCycle: pendingIntent.billingCycle,
          mode: pendingIntent.mode,
        });
      } catch {
        // If checkout fails, still land the user on the dashboard signed in.
      }
      clearPendingIntent();
    }
    closeAuthModal();
    navigate("/dashboard");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (tab === "guest") {
        await api.continueAsGuest(name, email, billingAddress);
      } else if (tab === "signup") {
        await api.signUp(name, email, password);
      } else {
        await api.signIn(email, password);
      }
      await afterAuthSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 px-4">
      <div className="card w-full max-w-md p-6 relative animate-fade-up">
        <button
          onClick={closeAuthModal}
          className="absolute right-4 top-4 text-ink-400 hover:text-ink-800"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <h2 className="text-xl font-semibold text-ink-900">
          {pendingIntent ? `Continue to buy ${pendingIntent.tierLabel}` : "Sign in to Atlas Studio"}
        </h2>
        {pendingIntent && (
          <p className="text-sm text-ink-400 mt-1">
            {pendingIntent.productName} — ${pendingIntent.amount}{" "}
            {pendingIntent.billingCycle === "yearly" ? "/yr" : ""}
          </p>
        )}

        <div className="mt-5 inline-flex rounded-lg border border-ink-100 p-1 w-full">
          {(["guest", "signin", "signup"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-md px-2 py-1.5 text-sm font-semibold transition-colors ${
                tab === t ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-50"
              }`}
            >
              {t === "guest" ? "Guest" : t === "signin" ? "Log in" : "Sign up"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-5 space-y-3">
          {(tab === "guest" || tab === "signup") && (
            <Field label="Full name" value={name} onChange={setName} placeholder="Ada Lovelace" />
          )}
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="ada@example.com"
          />
          {tab === "guest" && (
            <Field
              label="Billing address"
              value={billingAddress}
              onChange={setBillingAddress}
              placeholder="221B Baker Street, London"
            />
          )}
          {(tab === "signin" || tab === "signup") && (
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
            />
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={busy} className="btn-primary w-full mt-2">
            {busy
              ? "Working…"
              : tab === "guest"
              ? "Continue as guest"
              : tab === "signin"
              ? "Log in"
              : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-xs text-ink-400 text-center">
          Demo auth backed by a local SQLite database — no real payment is charged.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink-600">{label}</span>
      <input
        required
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-ink-800"
      />
    </label>
  );
}
