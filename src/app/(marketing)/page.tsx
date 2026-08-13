import { KeyRound, Layers, ShieldCheck, Zap } from "lucide-react";
import { LICENSE_PRODUCT, SHELF } from "@shared/catalog";
import { ProductArt } from "@/components/ProductArt";
import { Button, CtaButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

const HIGHLIGHTS = [
  {
    icon: Layers,
    title: "Five billing models",
    body: "One-time, subscription, usage-based, seat-based, and on-demand — live in one catalog.",
    tint: "bg-lime-100",
    iconTint: "text-lime-800",
  },
  {
    icon: ShieldCheck,
    title: "Real checkout modes",
    body: "Switch between redirect, overlay, and inline checkout to see how each feels.",
    tint: "bg-lavender-100",
    iconTint: "text-lavender-600",
  },
  {
    icon: Zap,
    title: "A working dashboard",
    body: "Every purchase updates a real MongoDB-backed account, both credit buckets included.",
    tint: "bg-lime-100",
    iconTint: "text-lime-800",
  },
];

// The gallery strip is the catalog's own artwork, minus the pass — that one is
// the locked piece the license flow reveals, so it is teased separately below.
const GALLERY = SHELF.filter(({ product }) => !product.grantsLicense).slice(0, 6);

export default function LandingPage() {
  const passTier = LICENSE_PRODUCT.tiers[0];

  return (
    <main>
      <section className="mx-auto max-w-5xl px-6 pt-24 pb-16 text-center">
        <span className="eyebrow justify-center">
          <Zap size={13} /> Atlas Studio × Dodo Payments demo
        </span>
        <h1 className="mt-6 text-[3.25rem] sm:text-[5rem] leading-[0.98] font-bold tracking-tight text-ink-900">
          Generate art.
          <br />
          <span className="text-ink-900">Pay </span>
          <span className="bg-lime-400 px-3 rounded-2xl inline-block -rotate-1">how it fits</span>
          <span className="text-ink-900"> you.</span>
        </h1>
        <p className="mt-7 text-lg text-ink-600 max-w-xl mx-auto">
          A small AI image studio built to show every Dodo Payments billing model in one place —
          one-time packs, subscriptions, usage-based metering, seats, on-demand top-ups and
          license keys.
        </p>
        <div className="mt-9 flex items-center justify-center gap-3">
          <CtaButton href="/pricing">See pricing</CtaButton>
          <Button href="/pricing" variant="secondary" size="lg">
            Try as guest
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {GALLERY.map(({ product, tier }) => (
            <figure key={tier.id} className="group">
              <ProductArt
                art={tier.art}
                alt={`${product.name} — ${tier.label}`}
                className="aspect-[4/3] rounded-xl border border-ink-100 shadow-soft transition-transform duration-300 group-hover:-translate-y-1"
              />
              <figcaption className="mt-2 truncate text-xs font-medium text-ink-600">
                {tier.label}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid sm:grid-cols-3 gap-4">
          {HIGHLIGHTS.map(({ icon: Icon, title, body, tint, iconTint }) => (
            <Card key={title} className="p-6">
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${tint} ${iconTint}`}>
                <Icon size={19} strokeWidth={2.25} />
              </span>
              <h3 className="mt-4 text-base font-bold text-ink-900">{title}</h3>
              <p className="mt-1.5 text-sm text-ink-600">{body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <Card className="grid gap-6 overflow-hidden p-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <Badge tone="lavender">
              <span className="inline-flex items-center gap-1.5">
                <KeyRound size={12} /> License keys
              </span>
            </Badge>
            <h3 className="mt-3 text-2xl font-bold text-ink-900">
              The premium gallery stays blurred until a key checks out
            </h3>
            <p className="mt-2 max-w-xl text-sm text-ink-600">
              Buy the {LICENSE_PRODUCT.name}, paste the key Dodo issues, and the artwork resolves
              in place. Activation and validation go through Dodo&apos;s public license endpoints —
              deactivate and it blurs straight back.
            </p>
            <Button href="/studio" variant="secondary" className="mt-5">
              Open the studio
            </Button>
          </div>
          <ProductArt
            art={passTier.art}
            alt={`${LICENSE_PRODUCT.name} artwork, blurred until unlocked`}
            blurred
            className="h-36 w-full rounded-xl border border-ink-100 sm:w-56"
          />
        </Card>
      </section>
    </main>
  );
}
