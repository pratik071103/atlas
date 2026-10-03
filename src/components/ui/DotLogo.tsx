import { cn } from "@/lib/cn";

// The brand mark — literally the "." from the hero's "FOUNDRY . STUDIO"
// reveal (see Hero.tsx's BRAND_STYLE + .Brand-highlight in globals.css):
// Anton "." on the slanted lime highlighter. It is NOT a square icon — the
// highlight is a narrow, tall chip sized by the glyph + its padding, same as
// the hero. Size it with a text-size className (e.g. "text-3xl"), not a
// fixed h-/w- box.
export function DotLogo({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("Brand-highlight inline-block shrink-0 leading-none text-white", className)}
      style={{
        fontFamily: "var(--font-anton)",
        padding: "0.05em 0.14em 0.07em",
        letterSpacing: "0.02em",
      }}
    >
      .
    </span>
  );
}