"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { authClient, type SessionIdentity } from "@/lib/auth-client";

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
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { data: session, isPending, refetch } = authClient.useSession();

  const identity: SessionIdentity | null = useMemo(() => {
    if (!session?.user) return null;
    const user = session.user as typeof session.user & { isAnonymous?: boolean | null };
    const isAnonymous = Boolean(user.isAnonymous);
    return {
      id: user.id,
      kind: isAnonymous ? "guest" : "user",
      // Anonymous users carry a generated placeholder name/email
      // (temp-…@guest.atlas.local); showing it would just be noise.
      name: isAnonymous ? null : user.name || null,
      email: isAnonymous ? null : user.email || null,
      image: user.image ?? null,
    };
  }, [session]);

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const signOut = useCallback(async () => {
    await authClient.signOut();
    await refetch();
  }, [refetch]);

  const openAuthModal = useCallback(() => setAuthModalOpen(true), []);
  const closeAuthModal = useCallback(() => setAuthModalOpen(false), []);

  const value = useMemo(
    () => ({
      identity,
      loading: isPending,
      refresh,
      signOut,
      authModalOpen,
      openAuthModal,
      closeAuthModal,
    }),
    [identity, isPending, refresh, signOut, authModalOpen, openAuthModal, closeAuthModal]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within <SessionProvider>");
  return ctx;
}
