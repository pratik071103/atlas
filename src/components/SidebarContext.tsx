"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// SidebarContext
//
// Two pieces of state:
//   sidebarUnlocked — once the user clicks a product buy CTA this becomes true
//                     and is persisted in localStorage so it survives refreshes.
//                     Also set to true on mount if the user already has purchases.
//   sidebarOpen     — expanded vs icon-only; persisted in localStorage.
// ---------------------------------------------------------------------------

const UNLOCK_KEY = "atlas-sidebar-unlocked";
const OPEN_KEY = "atlas-sidebar-open";

interface SidebarCtx {
  /** Whether the sidebar has been unlocked (user has initiated a purchase). */
  sidebarUnlocked: boolean;
  /** Whether the sidebar is expanded (true) or collapsed to icons (false). */
  sidebarOpen: boolean;
  /** Call this when the user clicks a product buy CTA. */
  unlockSidebar: () => void;
  /** Toggle expanded ↔ icon-only. */
  toggleSidebar: () => void;
  /** Force the open state (e.g. for mobile sheet). */
  setSidebarOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarCtx | null>(null);

export function SidebarStateProvider({ children }: { children: ReactNode }) {
  // Read from localStorage during first render (client-only).
  const [sidebarUnlocked, setSidebarUnlocked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true); // default: expanded
  const [mounted, setMounted] = useState(false);

  // Hydrate from localStorage after mount to avoid SSR mismatch.
  useEffect(() => {
    const unlocked = localStorage.getItem(UNLOCK_KEY) === "1";
    const open = localStorage.getItem(OPEN_KEY);
    setSidebarUnlocked(unlocked);
    // If we have a saved preference, use it; otherwise default to expanded.
    setSidebarOpen(open !== null ? open === "1" : true);
    setMounted(true);
  }, []);

  const unlockSidebar = useCallback(() => {
    setSidebarUnlocked(true);
    localStorage.setItem(UNLOCK_KEY, "1");
    // Open expanded on first unlock.
    setSidebarOpen(true);
    localStorage.setItem(OPEN_KEY, "1");
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem(OPEN_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const setSidebarOpenWithPersist = useCallback((open: boolean) => {
    setSidebarOpen(open);
    localStorage.setItem(OPEN_KEY, open ? "1" : "0");
  }, []);

  const value = useMemo(
    () => ({
      sidebarUnlocked: mounted ? sidebarUnlocked : false,
      sidebarOpen: mounted ? sidebarOpen : true,
      unlockSidebar,
      toggleSidebar,
      setSidebarOpen: setSidebarOpenWithPersist,
    }),
    [
      mounted,
      sidebarUnlocked,
      sidebarOpen,
      unlockSidebar,
      toggleSidebar,
      setSidebarOpenWithPersist,
    ]
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

export function useSidebarState() {
  const ctx = useContext(SidebarContext);
  if (!ctx)
    throw new Error("useSidebarState must be used within <SidebarStateProvider>");
  return ctx;
}
