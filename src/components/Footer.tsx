import Link from "next/link";
import { Sparkle } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-ink-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="flex items-center gap-2 font-display text-base font-bold text-ink-900">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-lime-400 text-ink-900">
              <Sparkle size={14} strokeWidth={2.5} />
            </span>
            Atlas Studio
          </span>
          <p className="mt-2 text-xs text-ink-400">
            Demo storefront · Powered by Dodo Payments · No real charges
          </p>
        </div>

        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-ink-600">
          <Link href="/" className="hover:text-ink-900">
            Home
          </Link>
          <Link href="/pricing" className="hover:text-ink-900">
            Pricing
          </Link>
          <Link href="/dashboard" className="hover:text-ink-900">
            Dashboard
          </Link>
          <Link href="/studio" className="hover:text-ink-900">
            Studio
          </Link>
          <a
            href="https://dodopayments.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ink-900"
          >
            Dodo Payments
          </a>
        </nav>
      </div>
    </footer>
  );
}
