"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Sparkles, CheckCircle, XCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

interface Props {
  token: string;
  invalid?: boolean;
  teamName?: string;
  ownerName?: string;
  seatCount?: number;
  isSignedIn?: boolean;
  alreadyMember?: boolean;
}

export function InviteAcceptClient({
  token,
  invalid,
  teamName,
  ownerName,
  seatCount,
  isSignedIn,
  alreadyMember,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  // --- Token invalid / expired ---
  if (invalid) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ink-50 to-lavender-50 px-4">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-100">
            <XCircle size={28} className="text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-ink-900">Invite link expired</h1>
          <p className="text-sm text-ink-600">
            This invite link has already been used or is no longer valid. Ask your team owner to
            send a new one.
          </p>
          <Button href="/" variant="secondary" className="mt-2">
            Go to Atlas Studio
          </Button>
        </Card>
      </main>
    );
  }

  // --- Already a member ---
  if (alreadyMember) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ink-50 to-lavender-50 px-4">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-lime-100">
            <CheckCircle size={28} className="text-lime-600" />
          </div>
          <h1 className="text-xl font-bold text-ink-900">You're already on this team!</h1>
          <p className="text-sm text-ink-600">
            You're already an active member of <strong>{teamName}</strong>.
          </p>
          <Button href="/team" className="mt-2">
            Go to team workspace →
          </Button>
        </Card>
      </main>
    );
  }

  // --- Accepted state ---
  if (accepted) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ink-50 to-lavender-50 px-4">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-lime-100">
            <CheckCircle size={28} className="text-lime-600" />
          </div>
          <h1 className="text-xl font-bold text-ink-900">You've joined {teamName}!</h1>
          <p className="text-sm text-ink-600">
            20 plan credits have been added to your wallet. Welcome to the team 🎉
          </p>
          <Button href="/team" className="mt-2">
            Go to team workspace →
          </Button>
        </Card>
      </main>
    );
  }

  async function acceptAndRedirect() {
    setLoading(true);
    setError(null);
    try {
      await api.acceptInvite(token);
      setAccepted(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) throw new Error(result.error.message ?? "Sign in failed.");
      await acceptAndRedirect();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await authClient.signUp.email({ email, password, name });
      if (result.error) throw new Error(result.error.message ?? "Sign up failed.");
      await acceptAndRedirect();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ink-50 to-lavender-50 px-4 py-12">
      <div className="max-w-md w-full space-y-5">
        {/* Team branding card */}
        <Card className="p-6 text-center space-y-3 border-lavender-200 bg-white">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-lavender-100">
            <Users size={26} className="text-lavender-700" />
          </div>
          <div>
            <p className="text-sm text-ink-500">You've been invited by</p>
            <p className="font-semibold text-ink-900">{ownerName}</p>
          </div>
          <div className="rounded-xl bg-lavender-50 px-4 py-3">
            <p className="text-base font-bold text-lavender-800">{teamName}</p>
            <p className="text-xs text-lavender-600 mt-0.5">
              {seatCount} seat workspace · 20 credits / month included
            </p>
          </div>
          <div className="flex items-center gap-1.5 justify-center text-xs text-ink-400">
            <Sparkles size={11} />
            Joining adds 20 plan credits to your wallet
          </div>
        </Card>

        {/* Auth / confirm card */}
        <Card className="p-6">
          {isSignedIn ? (
            /* Already signed in — just confirm */
            <div className="space-y-4 text-center">
              <h2 className="text-lg font-bold text-ink-900">Join as yourself?</h2>
              <p className="text-sm text-ink-500">
                Click below to accept this invite and join <strong>{teamName}</strong>.
              </p>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
              <Button onClick={acceptAndRedirect} loading={loading} className="w-full">
                Accept invitation →
              </Button>
            </div>
          ) : (
            /* Not signed in — show inline auth */
            <>
              {/* Tab switcher */}
              <div className="flex rounded-lg border border-ink-200 p-0.5 mb-5">
                {(["signup", "signin"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex-1 rounded-md py-1.5 text-sm font-semibold transition-all ${
                      tab === t
                        ? "bg-ink-900 text-white shadow-sm"
                        : "text-ink-500 hover:text-ink-800"
                    }`}
                  >
                    {t === "signup" ? "Create account" : "Sign in"}
                  </button>
                ))}
              </div>

              {error && (
                <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}

              {tab === "signup" ? (
                <form onSubmit={handleSignUp} className="space-y-3">
                  <Input label="Name" value={name} onChange={setName} placeholder="Ada Lovelace" />
                  <Input
                    label="Email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="ada@example.com"
                  />
                  <Input
                    label="Password"
                    type="password"
                    value={password}
                    onChange={setPassword}
                    placeholder="••••••••"
                  />
                  <Button type="submit" loading={loading} className="w-full mt-1">
                    Create account & join team →
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleSignIn} className="space-y-3">
                  <Input
                    label="Email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="ada@example.com"
                  />
                  <Input
                    label="Password"
                    type="password"
                    value={password}
                    onChange={setPassword}
                    placeholder="••••••••"
                  />
                  <Button type="submit" loading={loading} className="w-full mt-1">
                    Sign in & join team →
                  </Button>
                </form>
              )}
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
