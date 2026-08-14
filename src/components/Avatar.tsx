import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// Identicon-style avatar generated from the user id.
//
// Nothing is uploaded and nothing is fetched: the same id always produces the
// same gradient and rotation, so a guest keeps their face across reloads and
// carries it into their account when they link.
// ---------------------------------------------------------------------------

const PALETTES: [string, string][] = [
  ["#c3ee3f", "#576f16"],
  ["#a488e6", "#7550c4"],
  ["#d3f16f", "#0c0f0c"],
  ["#ede9fb", "#8a67da"],
  ["#aede1f", "#1c211c"],
  ["#c1b2f0", "#485c17"],
];

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function initials(name: string | null, fallback: string): string {
  const source = name?.trim();
  if (!source) return fallback;
  const parts = source.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || fallback;
}

interface Props {
  userId: string;
  name: string | null;
  /** Shown when there is no name — guests get a letter, not a blank circle. */
  fallback?: string;
  className?: string;
}

export function Avatar({ userId, name, fallback = "G", className }: Props) {
  const seed = hash(userId);
  const [from, to] = PALETTES[seed % PALETTES.length];
  const angle = seed % 360;

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-display font-bold text-white",
        className
      )}
      style={{ background: `linear-gradient(${angle}deg, ${from}, ${to})` }}
      aria-hidden="true"
    >
      <span className="drop-shadow-[0_1px_2px_rgba(12,15,12,0.45)]">
        {initials(name, fallback)}
      </span>
    </span>
  );
}
