import { cn } from "@/lib/cn";

// The brand dot — a lime chip with a solid blue dot, echoing the
// "FOUNDRY . STUDIO" mark on the hero. Size via className (h-8 w-8 etc.).
export function DotLogo({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-full bg-brand-lime", className)}
    >
      <span className="block aspect-square w-[38%] rounded-full bg-brand-blue" />
    </span>
  );
}