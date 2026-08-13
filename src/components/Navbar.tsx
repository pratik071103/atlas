"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkle } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./ui/Button";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/pricing", label: "Pricing" },
  { href: "/studio", label: "Studio" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-6 h-[72px] flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-lg font-bold text-ink-900"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-lime-400 text-ink-900">
            <Sparkle size={16} strokeWidth={2.5} />
          </span>
          Atlas Studio
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-[15px] font-medium text-ink-800">
          {LINKS.map((l) => (
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

        <div className="flex items-center gap-3">
          <Button href="/pricing">Start generating</Button>
        </div>
      </div>
    </header>
  );
}
