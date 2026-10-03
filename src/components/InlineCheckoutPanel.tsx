"use client";

import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  elementId: string;
  onClose: () => void;
}

// The old carousel embedded the inline-checkout mount div inside whichever
// card was expanded. Cards no longer expand (direct-buy, always simple), so
// this floating bottom sheet hosts the same mount div instead — rendered as
// a sibling of HeroParallax, never nested inside it: HeroParallax's
// [perspective]/rotateX transforms make any `position: fixed` descendant
// fix itself to that transformed ancestor instead of the viewport.
export function InlineCheckoutPanel({ open, elementId, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 32 }}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-lg px-4 pb-4 sm:px-6 sm:pb-6"
        >
          <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink-900">Complete checkout</p>
                <p className="text-xs text-ink-500">Secure payment by Dodo Payments</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-ink-200 text-ink-600 transition hover:bg-ink-50 hover:text-ink-900"
                aria-label="Cancel checkout"
              >
                <X size={15} />
              </button>
            </div>

            <div
              id={elementId}
              className="max-h-[70vh] min-h-[420px] overflow-y-auto overflow-x-hidden rounded-xl border border-ink-100 bg-white"
              aria-label="Inline checkout"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
