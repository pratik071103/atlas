"use client";

import { Store } from "lucide-react";
import { StorefrontButton } from "@/components/ui/StorefrontButton";
import { LinkPreview } from "@/components/ui/LinkPreview";
import type { CheckoutMode } from "@/lib/checkout";

const MODES: { id: CheckoutMode; label: string }[] = [
  { id: "redirect", label: "Redirect" },
  { id: "overlay", label: "Overlay" },
  { id: "inline", label: "Inline" },
];

interface Props {
  value: CheckoutMode;
  onChange: (v: CheckoutMode) => void;
}

export function CheckoutModeSwitch({ value, onChange }: Props) {
  // Dodo-hosted storefront preview page. Hidden when NEXT_PUBLIC_DODO_STORE_URL
  // is not set.
  const storefrontUrl = process.env.NEXT_PUBLIC_DODO_STORE_URL ?? "";

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
      <div className="flex items-center gap-2.5">
        {storefrontUrl && (
          // The image card replaces StorefrontButton's own text tooltip —
          // both at once would stack two floating things over one small
          // icon. The caption inside the card carries the label instead.
          <LinkPreview
            imageSrc="/storefront-preview.png"
            caption="storefront preview"
            alt="Preview of the Foundry.Studio storefront"
          >
            <StorefrontButton
              href={storefrontUrl}
              target="_blank"
              rel="noopener noreferrer"
              icon={Store}
              ariaLabel="Open Dodo storefront preview"
            />
          </LinkPreview>
        )}

        <div className="inline-flex shrink-0 rounded-full border border-ink-200 bg-white p-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
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
    </div>
  );
}
