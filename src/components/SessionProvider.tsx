"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { authClient, type SessionIdentity } from "@/lib/auth-client";
import type { CheckoutIntent } from "@/lib/checkout";
import { ErrorNotification } from "@/components/ErrorNotification";

// ---------------------------------------------------------------------------
// One client-side source of truth for "who is signed in" plus the auth modal.
//
// Better Auth's useSession keeps itself in sync, so there is no fetch-on-mount
// and no manual refresh after sign-in/sign-out — but it can only be called
// from a client component, and the sidebar, AuthModal, dashboard and profile
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
  /** The app-wide error channel, rendered by the global <ErrorNotification/>
   * below as a card pinned to the top-right. Shared so any flow — a failed
   * checkout, AuthModal's resume-purchase-after-guest-signin, /studio's key
   * activation — surfaces failures in one consistent place instead of each
   * page inventing its own red banner.
   *
   * Was `checkoutError`; renamed once it stopped being only about checkout.
   * `title` sets the card's kicker and defaults per call. */
  appError: { message: string; title?: string } | null;
  setAppError: (message: string | null, title?: string) => void;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<CheckoutIntent | null>(null);
  const [inlineCheckoutOpen, setInlineCheckoutOpen] = useState(false);
  const [appError, setAppErrorState] = useState<{ message: string; title?: string } | null>(null);
  const setAppError = useCallback(
    (message: string | null, title?: string) =>
      setAppErrorState(message ? { message, title } : null),
    []
  );
  const { data: session, isPending, refetch } = authClient.useSession();

  const identity: SessionIdentity | null = useMemo(() => {
    if (!session?.user) return null;
    const user = session.user as typeof session.user & {
      isAnonymous?: boolean | null;
      checkoutTheme?: string | null;
    };
    const isAnonymous = Boolean(user.isAnonymous);
    const theme = user.checkoutTheme;
    return {
      id: user.id,
      kind: isAnonymous ? "guest" : "user",
      // Anonymous users carry a generated placeholder name/email
      // (temp-…@guest.foundry.local); showing it would just be noise.
      name: isAnonymous ? null : user.name || null,
      email: isAnonymous ? null : user.email || null,
      image: user.image ?? null,
      checkoutTheme: theme === "dark" || theme === "system" ? theme : "light",
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
      appError,
      setAppError,
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
      appError,
      setAppError,
    ]
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
      <ErrorNotification
        message={appError?.message ?? null}
        title={appError?.title}
        onDismiss={() => setAppError(null)}
      />
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within <SessionProvider>");
  return ctx;
}
