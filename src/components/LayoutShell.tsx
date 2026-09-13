"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { AppSidebar, SidebarTrigger } from "./AppSidebar";
import { useSidebarState } from "./SidebarContext";
import { useSession } from "./SessionProvider";
import { api } from "@/lib/api";

// ---------------------------------------------------------------------------
// LayoutShell
//
// Renders one of two layouts depending on the current route and sidebar state:
//
//  • "/" (hero)   → completely nav-free; children fill the viewport.
//  • all others   → if sidebarUnlocked, show AppSidebar + content with
//                   margin-left that tracks sidebar width.
//                   If not unlocked, show children full-width (sidebar absent).
//
// Also checks on mount whether the user already has purchases — if yes,
// unlock the sidebar automatically so returning users always see it.
// ---------------------------------------------------------------------------

const HERO_ROUTE = "/";

export function LayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { sidebarUnlocked, sidebarOpen, unlockSidebar } = useSidebarState();
  const { identity, loading } = useSession();

  // Auto-unlock for users who already have purchases (returning users).
  useEffect(() => {
    if (sidebarUnlocked) return; // already unlocked
    if (loading || !identity) return;

    api
      .getBilling()
      .then((snapshot) => {
        if (snapshot.purchases.length > 0) {
          unlockSidebar();
        }
      })
      .catch(() => {
        // Silently ignore — sidebar just stays locked if billing check fails.
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, loading]); // intentionally exclude sidebarUnlocked/unlockSidebar to avoid re-running

  const isHero = pathname === HERO_ROUTE;
  const showSidebar = !isHero && sidebarUnlocked;

  // CSS offset for main content — depends on sidebar state
  const marginLeft = showSidebar
    ? sidebarOpen
      ? "var(--sidebar-width)"
      : "var(--sidebar-width-icon)"
    : "0px";

  if (isHero) {
    // Hero page: truly nav-free, full viewport
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      {showSidebar && <AppSidebar />}

      <motion.div
        className="flex min-h-screen flex-1 flex-col"
        animate={{ marginLeft }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        style={{ willChange: "margin-left" }}
      >
        {/* ── Inner content header with SidebarTrigger ─────────── */}
        {showSidebar && (
          <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b border-ink-100 bg-brand-cream/90 px-4 backdrop-blur">
            <SidebarTrigger />
          </header>
        )}

        <div className="flex-1 flex flex-col">{children}</div>
      </motion.div>
    </div>
  );
}
