import { Zap } from "lucide-react";
import { Button, CtaButton } from "@/components/ui/Button";

export default function LandingPage() {
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
    </main>
  );
}
