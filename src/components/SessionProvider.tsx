"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { authClient, type SessionIdentity } from "@/lib/auth-client";
import type { CheckoutIntent } from "@/lib/checkout";

// ---------------------------------------------------------------------------
// One client-side source of truth for "who is signed in" plus the auth modal.
//
// Better Auth's useSession keeps itself in sync, so there is no fetch-on-mount
// and no manual refresh after sign-in/sign-out — but it can only be called
// from a client component, and the Navbar, AuthModal, dashboard and profile
// all need the same answer. This provider is that shared subscription.
// ---------------------------------------------------------------------------

interface SessionState {
  identity: SessionIdentity | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  authModalOpen: boolean;
  /** Pass an intent to have the modal resume that purchase after signing in. */
  openAuthModal: (intent?: CheckoutIntent) => void;
  closeAuthModal: () => void;
  pendingIntent: CheckoutIntent | null;
  clearPendingIntent: () => void;
  /** True while the inline checkout frame has taken over the pricing page. */
  inlineCheckoutOpen: boolean;
  setInlineCheckoutOpen: (open: boolean) => void;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<CheckoutIntent | null>(null);
  const [inlineCheckoutOpen, setInlineCheckoutOpen] = useState(false);
  const { data: session, isPending, refetch } = authClient.useSession();

  const identity: SessionIdentity | null = useMemo(() => {
    if (!session?.user) return null;
    const user = session.user as typeof session.user & {
      isAnonymous?: boolean | null;
      checkoutTheme?: string | null;
      dodoCustomerId?: string | null;
    };
    const isAnonymous = Boolean(user.isAnonymous);
    const theme = user.checkoutTheme;
    return {
      id: user.id,
      kind: isAnonymous ? "guest" : "user",
      // Anonymous users carry a generated placeholder name/email
      // (temp-…@guest.atlas.local); showing it would just be noise.
      name: isAnonymous ? null : user.name || null,
      email: isAnonymous ? null : user.email || null,
      image: user.image ?? null,
      checkoutTheme: theme === "dark" || theme === "system" ? theme : "light",
      dodoCustomerId: user.dodoCustomerId ?? null,
    };
  }, [session]);

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const signOut = useCallback(async () => {
    await authClient.signOut();
    await refetch();
  }, [refetch]);

  const openAuthModal = useCallback((intent?: CheckoutIntent) => {
    if (intent) setPendingIntent(intent);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => setAuthModalOpen(false), []);
  const clearPendingIntent = useCallback(() => setPendingIntent(null), []);

  const value = useMemo(
    () => ({
      identity,
      loading: isPending,
      refresh,
      signOut,
      authModalOpen,
      openAuthModal,
      closeAuthModal,
      pendingIntent,
      clearPendingIntent,
      inlineCheckoutOpen,
      setInlineCheckoutOpen,
    }),
    [
      identity,
      isPending,
      refresh,
      signOut,
      authModalOpen,
      openAuthModal,
      closeAuthModal,
      pendingIntent,
      clearPendingIntent,
      inlineCheckoutOpen,
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within <SessionProvider>");
  return ctx;
}
