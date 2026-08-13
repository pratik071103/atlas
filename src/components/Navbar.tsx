"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Sparkle } from "lucide-react";
import { cn } from "@/lib/cn";
import { useSession } from "./SessionProvider";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Skeleton } from "./ui/Skeleton";

const PUBLIC_LINKS = [
  { href: "/", label: "Home" },
  { href: "/pricing", label: "Pricing" },
  { href: "/studio", label: "Studio" },
];

const SIGNED_IN_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/profile", label: "Profile" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { identity, loading, signOut, openAuthModal } = useSession();

  const links = identity ? [...PUBLIC_LINKS, ...SIGNED_IN_LINKS] : PUBLIC_LINKS;

  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-6 h-[72px] flex items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-lg font-bold text-ink-900 shrink-0"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-lime-400 text-ink-900">
            <Sparkle size={16} strokeWidth={2.5} />
          </span>
          Atlas Studio
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-[15px] font-medium text-ink-800">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "transition-colors hover:text-ink-900",
                pathname === l.href && "text-ink-900 font-semibold"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          {/* A fixed-width skeleton rather than nothing, so resolving the
              session doesn't shove the header contents sideways. */}
          {loading ? (
            <Skeleton className="h-10 w-36 rounded-full" />
          ) : identity ? (
            <>
              <span className="hidden sm:inline text-sm text-ink-600">
                {identity.name?.split(" ")[0] ?? "Guest"}
                {identity.kind === "guest" && (
                  <Badge tone="ink" className="ml-2">
                    Guest
                  </Badge>
                )}
              </span>
              <Button
                variant="secondary"
                onClick={async () => {
                  await signOut();
                  router.push("/");
                }}
              >
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={openAuthModal}>
                Login
              </Button>
              <Button href="/pricing">Start generating</Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
