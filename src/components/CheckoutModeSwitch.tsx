import { ExternalLink, PanelTop, SquareCode, Store } from "lucide-react";
import { Card } from "./ui/Card";

export type CheckoutMode = "redirect" | "overlay" | "inline";

const MODES: { id: CheckoutMode; label: string; icon: typeof ExternalLink; blurb: string }[] = [
  {
    id: "redirect",
    label: "Redirect",
    icon: ExternalLink,
    blurb: "Customer is sent to a Dodo-hosted checkout page, then returned here.",
  },
  {
    id: "overlay",
    label: "Overlay",
    icon: PanelTop,
    blurb: "Checkout opens in a modal overlay on top of the current page.",
  },
  {
    id: "inline",
    label: "Inline",
    icon: SquareCode,
    blurb: "Checkout embeds directly inside the page — no redirect, no modal.",
  },
];

interface Props {
  value: CheckoutMode;
  onChange: (v: CheckoutMode) => void;
}

export function CheckoutModeSwitch({ value, onChange }: Props) {
  const active = MODES.find((m) => m.id === value)!;

  // Dodo-hosted storefront preview page, configured in .env
  // (VITE_DODO_STORE_URL). Hidden when not set.
  const storefrontUrl = (import.meta.env.VITE_DODO_STORE_URL as string) ?? "";

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
      <div className="flex items-center gap-2.5">
        {storefrontUrl && (
          <div className="storefront-btn-wrapper">
            <a
              href={storefrontUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="Btn"
              aria-label="Open Dodo storefront preview"
            >
              <span className="svgContainer">
                <Store size={18} strokeWidth={2.2} />
              </span>
              <span className="BG"></span>
            </a>
            <span className="storefront-tooltip">storefront preview</span>
          </div>
        )}

        <div className="inline-flex shrink-0 rounded-full border border-ink-200 bg-white p-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => onChange(m.id)}
              className={`rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                value === m.id ? "bg-ink-900 text-white" : "text-ink-600 hover:text-ink-900"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="flex items-center gap-2.5 px-3.5 py-2 min-w-0 sm:max-w-xs">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-lime-100 text-lime-800">
          <active.icon size={14} />
        </span>
        <p className="text-xs text-ink-600 leading-snug truncate sm:whitespace-normal">
          {active.blurb}
        </p>
      </Card>
    </div>
  );
}
