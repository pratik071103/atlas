import { Link } from "react-router-dom";
import { Zap, ShieldCheck, Layers } from "lucide-react";

export function Landing() {
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
          A small AI image studio built to show every Dodo Payments billing model in one
          place — one-time packs, subscriptions, usage-based metering, seats, and on-demand
          top-ups.
        </p>
        <div className="mt-9 flex items-center justify-center gap-3">
          <Link to="/pricing" className="bc-cta bc-cta--centered" style={{ width: "auto" }}>
            <span className="bc-cta__label">See pricing</span>
          </Link>
          <Link to="/pricing" className="btn-secondary text-base px-6 py-3.5">
            Try as guest
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid sm:grid-cols-3 gap-4">
          {[
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
              body: "Every purchase updates a real SQLite-backed account, credits included.",
              tint: "bg-lime-100",
              iconTint: "text-lime-800",
            },
          ].map(({ icon: Icon, title, body, tint, iconTint }) => (
            <div key={title} className="card p-6">
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${tint} ${iconTint}`}>
                <Icon size={19} strokeWidth={2.25} />
              </span>
              <h3 className="mt-4 text-base font-bold text-ink-900">{title}</h3>
              <p className="mt-1.5 text-sm text-ink-600">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
