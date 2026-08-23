"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Menu, Sparkle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { useSession } from "./SessionProvider";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Skeleton } from "./ui/Skeleton";
import { TeamSwitcher } from "./TeamSwitcher";

const PUBLIC_LINKS = [{ href: "/pricing", label: "Pricing" }, { href: "/studio", label: "Studio" }];
const SIGNED_IN_LINKS = [{ href: "/dashboard", label: "Dashboard" }, { href: "/team", label: "Team" }, { href: "/profile", label: "Profile" }];

function NavbarButton({ children, className, ...props }: React.ComponentProps<typeof Button>) {
  return <Button {...props} className={cn("rounded-full px-4 py-2 text-sm", className)}>{children}</Button>;
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { identity, loading, signOut, openAuthModal } = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setMobileOpen(false), [pathname]);

  const links = [...PUBLIC_LINKS, ...(identity ? SIGNED_IN_LINKS : []), ...(process.env.NODE_ENV === "development" ? [{ href: "/dev/webhooks", label: "Webhooks" }] : [])];
  const renderAuth = (mobile = false) => <div className={cn("flex items-center gap-2", mobile && "w-full flex-col items-stretch")}>
    {loading ? <Skeleton className={cn("h-10 w-36 rounded-full", mobile && "w-full")} /> : identity ? <>
      <TeamSwitcher className={mobile ? "w-full" : undefined} />
      <span className="hidden text-sm text-ink-600 sm:inline">{identity.kind === "guest" ? <Badge tone="ink">Guest</Badge> : identity.name?.split(" ")[0] ?? "Guest"}</span>
      <NavbarButton variant="secondary" className={mobile ? "w-full" : undefined} onClick={async () => { await signOut(); router.push("/"); }}>Sign out</NavbarButton>
    </> : <>
      <NavbarButton variant="secondary" className={mobile ? "w-full" : undefined} onClick={() => openAuthModal()}>Login</NavbarButton>
      <NavbarButton href="/pricing" className={mobile ? "w-full" : undefined}>Start generating</NavbarButton>
    </>}
  </div>;

  return <header className="sticky top-0 z-40 w-full px-3 pt-3 sm:px-6">
    <motion.div animate={{ maxWidth: scrolled ? 860 : 1152, borderRadius: scrolled ? 28 : 18 }} transition={{ type: "spring", stiffness: 220, damping: 26 }} className="mx-auto border border-ink-100 bg-white/90 shadow-soft backdrop-blur">
      <div className={cn("mx-auto flex h-[64px] items-center justify-between gap-4 px-4 sm:px-6", scrolled && "sm:px-5")}>
        <Link href="/" className="flex shrink-0 items-center gap-2 font-display text-lg font-bold text-ink-900"><span className="grid h-8 w-8 place-items-center rounded-full bg-lime-400 text-ink-900"><Sparkle size={16} strokeWidth={2.5} /></span><span>Atlas Studio</span></Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-ink-700 md:flex">{links.map((link) => <Link key={link.href} href={link.href} className={cn("transition-colors hover:text-ink-900", pathname === link.href && "font-semibold text-ink-900")}>{link.label}</Link>)}</nav>
        <div className="hidden shrink-0 items-center md:flex">{renderAuth()}</div>
        <button type="button" aria-label={mobileOpen ? "Close menu" : "Open menu"} aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)} className="rounded-full p-2 text-ink-800 hover:bg-ink-50 md:hidden">{mobileOpen ? <X size={20} /> : <Menu size={20} />}</button>
      </div>
      <AnimatePresence initial={false}>{mobileOpen && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-t border-ink-100 px-4 pb-4 md:hidden">
        <nav className="flex flex-col gap-1 py-3">{links.map((link) => <Link key={link.href} href={link.href} className={cn("rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-ink-50", pathname === link.href && "bg-lime-50 font-semibold")}>{link.label}</Link>)}</nav>{renderAuth(true)}
      </motion.div>}</AnimatePresence>
    </motion.div>
  </header>;
}
