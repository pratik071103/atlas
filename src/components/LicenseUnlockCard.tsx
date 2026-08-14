"use client";

import { FormEvent, useState } from "react";
import { BadgeCheck, KeyRound, Lock, ShieldAlert, Unlock } from "lucide-react";
import { LICENSE_PRODUCT } from "@shared/catalog";
import { api, type License } from "@/lib/api";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Input } from "./ui/Input";

// ---------------------------------------------------------------------------
// The key panel next to the gallery: paste → activate → validate → unblur.
//
// Activation and validation are separate on purpose, because they are separate
// in Dodo too: activation claims one of the key's seats and hands back an
// instance id, validation is the cheap check a real product runs on every
// launch. Deactivating releases the seat, and the gallery blurs straight back.
// ---------------------------------------------------------------------------

const STATUS_TONE = {
  active: "lime",
  issued: "lavender",
  expired: "red",
  deactivated: "ink",
} as const;

interface Props {
  licenses: License[];
  unlocked: boolean;
  onChange: () => void | Promise<void>;
}

export function LicenseUnlockCard({ licenses, unlocked, onChange }: Props) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<"activate" | "validate" | "deactivate" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const activeLicense = licenses.find((l) => l.status === "active") ?? null;
  const issued = licenses.filter((l) => l.status !== "active");

  async function run(
    action: "activate" | "validate" | "deactivate",
    licenseKey: string
  ): Promise<void> {
    setBusy(action);
    setMessage(null);
    try {
      if (action === "activate") {
        const { license } = await api.activateLicense(licenseKey);
        setMessage({ tone: "ok", text: `Activated as “${license.instanceName}”.` });
        setKey("");
      } else if (action === "validate") {
        const result = await api.validateLicense(licenseKey);
        setMessage({ tone: result.valid ? "ok" : "bad", text: result.message });
      } else {
        await api.deactivateLicense(licenseKey);
        setMessage({ tone: "ok", text: "Activation released — the gallery is locked again." });
      }
      await onChange();
    } catch (e) {
      setMessage({ tone: "bad", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void run("activate", key);
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2.5">
        <span
          className={`grid h-9 w-9 place-items-center rounded-lg ${
            unlocked ? "bg-lime-100 text-lime-800" : "bg-ink-100 text-ink-600"
          }`}
        >
          {unlocked ? <Unlock size={17} /> : <Lock size={17} />}
        </span>
        <div>
          <h2 className="text-sm font-bold text-ink-900">
            {unlocked ? "Gallery unlocked" : "Enter your license key"}
          </h2>
          <p className="text-xs text-ink-600">
            {unlocked
              ? "Validated against Dodo. Deactivate to free the seat."
              : `Buy the ${LICENSE_PRODUCT.name} and paste the key Dodo issues.`}
          </p>
        </div>
      </div>

      {activeLicense ? (
        <div className="mt-4 rounded-xl border border-lime-200 bg-lime-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <code className="truncate font-mono text-xs font-semibold text-lime-900">
              {activeLicense.key}
            </code>
            <Badge tone="lime">
              <span className="inline-flex items-center gap-1">
                <BadgeCheck size={11} /> active
              </span>
            </Badge>
          </div>
          <p className="mt-1.5 text-xs text-lime-900/70">
            Instance {activeLicense.instanceId?.slice(0, 14) ?? "—"}
            {activeLicense.lastValidatedAt &&
              ` · last checked ${new Date(activeLicense.lastValidatedAt).toLocaleTimeString()}`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={busy === "validate"}
              onClick={() => void run("validate", activeLicense.key)}
            >
              Re-validate
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={busy === "deactivate"}
              onClick={() => void run("deactivate", activeLicense.key)}
            >
              Deactivate
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-2.5">
          <Input
            value={key}
            onChange={(v) => setKey(v.toUpperCase())}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            className="font-mono uppercase tracking-wider"
            aria-label="License key"
          />
          <Button type="submit" fullWidth loading={busy === "activate"} disabled={!key.trim()}>
            <KeyRound size={15} /> Activate key
          </Button>
        </form>
      )}

      {message && (
        <p
          className={`mt-3 flex items-start gap-1.5 text-xs ${
            message.tone === "ok" ? "text-lime-800" : "text-red-600"
          }`}
        >
          {message.tone === "bad" && <ShieldAlert size={13} className="mt-0.5 shrink-0" />}
          {message.text}
        </p>
      )}

      {issued.length > 0 && (
        <div className="mt-5 border-t border-ink-100 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Your keys</p>
          <ul className="mt-2 space-y-1.5">
            {issued.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setKey(l.key)}
                  className="truncate font-mono text-xs text-ink-600 underline-offset-2 hover:text-ink-900 hover:underline"
                  title="Use this key"
                >
                  {l.key}
                </button>
                <Badge tone={STATUS_TONE[l.status]}>{l.status}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      {licenses.length === 0 && (
        <Button href="/pricing" variant="secondary" fullWidth className="mt-4">
          Buy the {LICENSE_PRODUCT.name}
        </Button>
      )}
    </Card>
  );
}
