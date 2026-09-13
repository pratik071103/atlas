"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronRight,
  ChevronsUpDown,
  LayoutDashboard,
  LogOut,
  Palette,
  PanelLeft,
  Sparkle,
  Tag,
  User,
  Users,
  Webhook,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useSidebarState } from "./SidebarContext";
import { useSession } from "./SessionProvider";
import { Skeleton } from "./ui/Skeleton";
import { TeamSwitcher } from "./TeamSwitcher";

// ---------------------------------------------------------------------------
// Nav structure — mirrors the current Navbar exactly
// ---------------------------------------------------------------------------

const PUBLIC_NAV = [
  { href: "/pricing", label: "Pricing", icon: Tag },
  { href: "/studio", label: "Studio", icon: Palette },
];

const AUTHED_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/team", label: "Team", icon: Users },
  { href: "/profile", label: "Profile", icon: User },
];

const DEV_NAV =
  process.env.NODE_ENV === "development"
    ? [{ href: "/dev/webhooks", label: "Webhooks", icon: Webhook }]
    : [];

// ---------------------------------------------------------------------------
// SidebarTrigger — exposed so LayoutShell can embed it in the content header
// ---------------------------------------------------------------------------

export function SidebarTrigger({ className }: { className?: string }) {
  const { toggleSidebar, sidebarOpen } = useSidebarState();
  return (
    <button
      id="sidebar-trigger"
      aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
      onClick={toggleSidebar}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        className
      )}
    >
      <PanelLeft size={17} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// NavUser — footer user block
// ---------------------------------------------------------------------------

function NavUser() {
  const { identity, loading, signOut, openAuthModal } = useSession();
  const { sidebarOpen } = useSidebarState();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
        {sidebarOpen && <Skeleton className="h-4 w-24 rounded" />}
      </div>
    );
  }

  if (!identity) {
    return (
      <div className="flex flex-col gap-1 px-2">
        {sidebarOpen ? (
          <>
            <button
              onClick={() => openAuthModal()}
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-xs font-semibold text-ink-800 transition-colors hover:bg-ink-50"
            >
              Login
            </button>
            <Link
              href="/pricing"
              className="w-full rounded-lg bg-lime-400 px-3 py-2 text-center text-xs font-bold text-ink-900 transition-colors hover:bg-lime-300"
            >
              Start generating
            </Link>
          </>
        ) : (
          <button
            onClick={() => openAuthModal()}
            title="Login"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-600 transition-colors hover:bg-ink-100"
          >
            <User size={16} />
          </button>
        )}
      </div>
    );
  }

  const initials = identity.name
    ? identity.name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "G";

  return (
    <div ref={menuRef} className="relative">
      <button
        id="nav-user-btn"
        onClick={() => setMenuOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--sidebar-accent)]",
          menuOpen && "bg-[var(--sidebar-accent)]"
        )}
      >
        {/* Avatar */}
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lime-400 text-xs font-bold text-ink-900">
          {identity.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={identity.image}
              alt={initials}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            initials
          )}
        </span>

        {sidebarOpen && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-ink-900">
                {identity.name ?? (identity.kind === "guest" ? "Guest" : "User")}
              </p>
              <p className="truncate text-[10px] text-ink-500">
                {identity.email ?? "Guest checkout"}
              </p>
            </div>
            <ChevronsUpDown size={13} className="shrink-0 text-ink-400" />
          </>
        )}
      </button>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            className="absolute bottom-full left-0 z-50 mb-1.5 min-w-[180px] overflow-hidden rounded-xl border border-ink-100 bg-white shadow-lg"
          >
            {identity.kind === "guest" && (
              <>
                <div className="px-3 pt-3 pb-2">
                  <p className="text-[11px] font-semibold text-ink-500">
                    Guest session
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-400">
                    Sign up to keep your credits
                  </p>
                </div>
                <div className="border-t border-ink-100" />
              </>
            )}
            <button
              onClick={async () => {
                setMenuOpen(false);
                await signOut();
                router.push("/");
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-ink-700 transition-colors hover:bg-ink-50"
            >
              <LogOut size={14} className="text-ink-400" />
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NavItem
// ---------------------------------------------------------------------------

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium transition-all",
        collapsed ? "justify-center" : "",
        active
          ? "bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-fg)] font-semibold"
          : "text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-fg)]"
      )}
    >
      <Icon
        size={17}
        className={cn(
          "shrink-0 transition-colors",
          active ? "text-ink-900" : "text-ink-500 group-hover:text-ink-700"
        )}
      />
      {!collapsed && <span className="truncate">{label}</span>}
      {!collapsed && active && (
        <ChevronRight size={13} className="ml-auto text-ink-400" />
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// AppSidebar
// ---------------------------------------------------------------------------

export function AppSidebar() {
  const pathname = usePathname();
  const { sidebarOpen } = useSidebarState();
  const { identity } = useSession();

  const navLinks = [
    ...PUBLIC_NAV,
    ...(identity ? AUTHED_NAV : []),
    ...DEV_NAV,
  ];

  const collapsed = !sidebarOpen;

  return (
    <>
      {/* ── Fixed sidebar panel ─────────────────────────────────── */}
      <motion.aside
        id="app-sidebar"
        aria-label="Application sidebar"
        initial={false}
        animate={{ width: collapsed ? "var(--sidebar-width-icon)" : "var(--sidebar-width)" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed inset-y-0 left-0 z-30 flex flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] overflow-hidden"
        style={{ willChange: "width" }}
      >
        {/* Header — logo */}
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-[var(--sidebar-border)]",
            collapsed ? "justify-center px-0" : "gap-2 px-4"
          )}
        >
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 font-display text-base font-bold text-ink-900"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lime-400 text-ink-900">
              <Sparkle size={15} strokeWidth={2.5} />
            </span>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="whitespace-nowrap"
              >
                Atlas Studio
              </motion.span>
            )}
          </Link>
        </div>

        {/* Content — nav groups */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
          {/* Platform group */}
          {!collapsed && (
            <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-400">
              Platform
            </p>
          )}
          <nav className="flex flex-col gap-0.5">
            {navLinks.map((link) => (
              <NavItem
                key={link.href}
                href={link.href}
                label={link.label}
                icon={link.icon}
                active={
                  link.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(link.href)
                }
                collapsed={collapsed}
              />
            ))}
          </nav>
        </div>

        {/* Footer — team switcher + user */}
        <div className="shrink-0 border-t border-[var(--sidebar-border)] px-2 py-3 flex flex-col gap-2">
          {!collapsed && identity && <TeamSwitcher />}
          <NavUser />
        </div>
      </motion.aside>

      {/* ── SidebarRail: thin hover target for expand on collapse ── */}
      {collapsed && (
        <div
          aria-hidden
          className="fixed inset-y-0 left-[var(--sidebar-width-icon)] z-20 w-1 cursor-col-resize"
        />
      )}
    </>
  );
}
