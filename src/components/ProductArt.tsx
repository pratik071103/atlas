import type { ArtSpec } from "@shared/catalog";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// Generated product artwork.
//
// Every catalog tier carries an ArtSpec (two gradient stops, an accent and a
// motif). Rather than shipping a folder of PNGs, the shapes are derived from
// the spec's seed with a small deterministic PRNG — same seed, same picture,
// on the server and in the browser, so hydration never disagrees. That also
// means no image requests and nothing to optimise or lazily load.
//
// `blurred` is what the /studio lock uses: the artwork stays mounted and the
// CSS filter animates away once a license key validates.
// ---------------------------------------------------------------------------

const VIEW_W = 200;
const VIEW_H = 150;

/** FNV-1a — small, stable, and enough to spread seeds across the shape space. */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/** xorshift32 — deterministic 0..1 stream, no dependency on Math.random. */
function makeRandom(seed: string): () => number {
  let state = hashSeed(seed) || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function motifShapes(art: ArtSpec): React.ReactNode {
  const rand = makeRandom(art.seed);
  const pick = (min: number, max: number) => round(min + rand() * (max - min));

  switch (art.motif) {
    case "orbit": {
      const cx = pick(60, 140);
      const cy = pick(50, 100);
      return (
        <g stroke={art.accent} fill="none">
          {[0, 1, 2, 3].map((i) => (
            <ellipse
              key={i}
              cx={cx}
              cy={cy}
              rx={round(18 + i * 17 + pick(0, 8))}
              ry={round(14 + i * 12 + pick(0, 6))}
              strokeWidth={round(0.6 + rand() * 1.6)}
              opacity={round(0.5 - i * 0.09)}
            />
          ))}
          <circle cx={round(cx + pick(20, 55))} cy={cy} r={pick(3, 6)} fill={art.accent} />
        </g>
      );
    }

    case "waves": {
      return (
        <g stroke={art.accent} fill="none" strokeLinecap="round">
          {Array.from({ length: 6 }, (_, i) => {
            const y = round(24 + i * 20 + pick(-5, 5));
            const lift = pick(14, 34);
            return (
              <path
                key={i}
                d={`M -10 ${y} C ${round(VIEW_W * 0.22)} ${round(y - lift)}, ${round(
                  VIEW_W * 0.55
                )} ${round(y + lift)}, ${VIEW_W + 10} ${round(y - lift / 2)}`}
                strokeWidth={round(0.8 + rand() * 2.2)}
                opacity={round(0.22 + rand() * 0.4)}
              />
            );
          })}
        </g>
      );
    }

    case "prism": {
      return (
        <g opacity="0.6">
          {Array.from({ length: 3 }, (_, i) => {
            const x = pick(20, 130);
            const y = pick(20, 90);
            const size = pick(45, 85);
            return (
              <polygon
                key={i}
                points={`${x},${round(y + size)} ${round(x + size / 2)},${y} ${round(
                  x + size
                )},${round(y + size)}`}
                fill={i === 1 ? art.accent : "none"}
                stroke={art.accent}
                strokeWidth={round(0.8 + rand())}
                opacity={round(0.25 + i * 0.18)}
              />
            );
          })}
        </g>
      );
    }

    case "grid": {
      const dots: React.ReactNode[] = [];
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 9; col++) {
          dots.push(
            <circle
              key={`${row}-${col}`}
              cx={round(14 + col * 22)}
              cy={round(16 + row * 24)}
              r={round(0.9 + rand() * 2.1)}
              fill={art.accent}
              opacity={round(0.18 + rand() * 0.5)}
            />
          );
        }
      }
      return (
        <g>
          {dots}
          <rect
            x={pick(25, 70)}
            y={pick(20, 50)}
            width={pick(60, 95)}
            height={pick(50, 75)}
            rx="10"
            fill="none"
            stroke={art.accent}
            strokeWidth="1.4"
            opacity="0.55"
          />
        </g>
      );
    }

    case "bloom": {
      const cx = pick(70, 130);
      const cy = pick(55, 95);
      const petals = 9;
      return (
        <g stroke={art.accent} fill="none">
          {Array.from({ length: petals }, (_, i) => (
            <ellipse
              key={i}
              cx={cx}
              cy={cy}
              rx={pick(48, 66)}
              ry={pick(11, 20)}
              strokeWidth="0.9"
              opacity="0.42"
              transform={`rotate(${round((360 / petals) * i)} ${cx} ${cy})`}
            />
          ))}
          <circle cx={cx} cy={cy} r={pick(5, 9)} fill={art.accent} opacity="0.85" />
        </g>
      );
    }
  }
}

interface Props {
  art: ArtSpec;
  /** Accessible description — the artwork is decorative when omitted. */
  alt?: string;
  blurred?: boolean;
  className?: string;
}

export function ProductArt({ art, alt, blurred = false, className }: Props) {
  const gradientId = `art-grad-${art.seed}`;
  const glowId = `art-glow-${art.seed}`;

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid slice"
        role={alt ? "img" : "presentation"}
        aria-label={alt}
        aria-hidden={alt ? undefined : true}
        // Scaled up while blurred so the blur's soft edge never reveals the
        // container's corners; the transition is the /studio unlock animation.
        className={cn(
          "h-full w-full transition-[filter,transform] duration-700 ease-out",
          blurred ? "blur-xl scale-110" : "blur-0 scale-100"
        )}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={art.from} />
            <stop offset="100%" stopColor={art.to} />
          </linearGradient>
          <radialGradient id={glowId} cx="0.25" cy="0.15" r="0.9">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width={VIEW_W} height={VIEW_H} fill={`url(#${gradientId})`} />
        {motifShapes(art)}
        <rect width={VIEW_W} height={VIEW_H} fill={`url(#${glowId})`} />
      </svg>
    </div>
  );
}
