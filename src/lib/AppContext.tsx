import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, SessionIdentity } from "./api";

export interface CheckoutIntent {
  productId: string;
  productName: string;
  tierId: string;
  tierLabel: string;
  amount: number;
  billingCycle: "monthly" | "yearly";
  mode: "redirect" | "overlay" | "inline";
}

interface AppState {
  identity: SessionIdentity | null;
  loadingIdentity: boolean;
  refreshIdentity: () => Promise<void>;
  signOut: () => Promise<void>;
  authModalOpen: boolean;
  openAuthModal: (intent?: CheckoutIntent) => void;
  closeAuthModal: () => void;
  pendingIntent: CheckoutIntent | null;
  clearPendingIntent: () => void;
  inlineCheckoutOpen: boolean;
  setInlineCheckoutOpen: (open: boolean) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<SessionIdentity | null>(null);
  const [loadingIdentity, setLoadingIdentity] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<CheckoutIntent | null>(null);
  const [inlineCheckoutOpen, setInlineCheckoutOpen] = useState(false);

  const refreshIdentity = useCallback(async () => {
    setLoadingIdentity(true);
    try {
      const { identity } = await api.getSession();
      setIdentity(identity);
    } finally {
      setLoadingIdentity(false);
    }
  }, []);

  useEffect(() => {
    refreshIdentity();
  }, [refreshIdentity]);

  const signOut = useCallback(async () => {
    await api.signOut();
    setIdentity(null);
  }, []);

  const openAuthModal = useCallback((intent?: CheckoutIntent) => {
    if (intent) setPendingIntent(intent);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => setAuthModalOpen(false), []);
  const clearPendingIntent = useCallback(() => setPendingIntent(null), []);

  const value = useMemo(
    () => ({
      identity,
      loadingIdentity,
      refreshIdentity,
      signOut,
      authModalOpen,
      openAuthModal,
      closeAuthModal,
      pendingIntent,
      clearPendingIntent,
      inlineCheckoutOpen,
      setInlineCheckoutOpen,
    }),
    [identity, loadingIdentity, refreshIdentity, signOut, authModalOpen, openAuthModal, closeAuthModal, pendingIntent, clearPendingIntent, inlineCheckoutOpen]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
