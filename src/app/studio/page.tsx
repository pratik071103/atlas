"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, Sparkles } from "lucide-react";
import { SHELF } from "@shared/catalog";
import { LicenseUnlockCard } from "@/components/LicenseUnlockCard";
import { ProductArt } from "@/components/ProductArt";
import { useSession } from "@/components/SessionProvider";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CtaButton } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, type License } from "@/lib/api";

// ---------------------------------------------------------------------------
// The premium gallery.
//
// Every piece renders blurred until a license key activates and validates,
// then the same <ProductArt> elements resolve in place — the artwork is
// mounted the whole time, so it is one CSS transition rather than an asset
// swap. Deactivating the key blurs them straight back.
// ---------------------------------------------------------------------------

const GALLERY = SHELF.map(({ product, tier }) => ({
  id: tier.id,
  title: `${product.name} — ${tier.label}`,
  art: tier.art,
}));

export default function StudioPage() {
  const { identity, loading: sessionLoading, openAuthModal } = useSession();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!identity) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.getLicenses();
      setLicenses(data.licenses);
      setUnlocked(data.unlocked);
    } finally {
      setLoading(false);
    }
  }, [identity]);

  useEffect(() => {
    if (sessionLoading) return;
    void load();
  }, [sessionLoading, load]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Studio</span>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink-900 sm:text-5xl">
            The premium gallery
          </h1>
          <p className="mt-3 max-w-xl text-lg text-ink-600">
            Licensed artwork, blurred until a key checks out. Activation and validation go
            through Dodo&apos;s public license endpoints — the same calls a desktop app would
            make on launch.
          </p>
        </div>
        <Badge tone={unlocked ? "lime-solid" : "ink"}>
          <span className="inline-flex items-center gap-1.5">
            {unlocked ? <Sparkles size={12} /> : <Lock size={12} />}
            {unlocked ? "Unlocked" : "Locked"}
          </span>
        </Badge>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {GALLERY.map((piece) => (
            <figure key={piece.id} className="overflow-hidden rounded-xl2 border border-ink-100 bg-white shadow-soft">
              <div className="relative">
                <ProductArt
                  art={piece.art}
                  alt={piece.title}
                  blurred={!unlocked}
                  className="aspect-[4/3]"
                />
                {!unlocked && (
                  <span className="pointer-events-none absolute inset-0 grid place-items-center">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-white/85 text-ink-800 shadow-soft backdrop-blur-sm">
                      <Lock size={16} />
                    </span>
                  </span>
                )}
              </div>
              <figcaption className="px-4 py-3 text-sm font-semibold text-ink-900">
                {piece.title}
              </figcaption>
            </figure>
          ))}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          {sessionLoading || loading ? (
            <Skeleton className="h-64 rounded-xl2" />
          ) : !identity ? (
            <Card className="p-5">
              <h2 className="text-sm font-bold text-ink-900">Sign in to use a key</h2>
              <p className="mt-2 text-sm text-ink-600">
                Continue as a guest — keys you activate now follow you if you sign up later.
              </p>
              <div className="mt-4">
                <CtaButton fullWidth arrow onClick={() => openAuthModal()}>
                  Continue as guest
                </CtaButton>
              </div>
            </Card>
          ) : (
            <LicenseUnlockCard licenses={licenses} unlocked={unlocked} onChange={load} />
          )}
        </aside>
      </div>
    </main>
  );
}
