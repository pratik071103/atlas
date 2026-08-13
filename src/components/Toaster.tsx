"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// Toasts.
//
// These exist for changes the customer did not just cause: a webhook landing,
// a plan change Dodo finally confirmed, credits appearing after a payment
// settles. Anything the user clicked gets inline feedback where they clicked
// instead — a toast for that would just move the answer away from the question.
// ---------------------------------------------------------------------------

type ToastTone = "success" | "info" | "error";

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
}

const DISMISS_MS = 6000;

const TONE_STYLE: Record<ToastTone, { icon: typeof Info; className: string }> = {
  success: { icon: CheckCircle2, className: "border-lime-200 bg-lime-50 text-lime-900" },
  info: { icon: Info, className: "border-lavender-200 bg-lavender-50 text-lavender-600" },
  error: { icon: TriangleAlert, className: "border-red-100 bg-red-50 text-red-700" },
};

interface ToastApi {
  toast: (tone: ToastTone, title: string, body?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((tone: ToastTone, title: string, body?: string) => {
    setToasts((prev) => [...prev, { id: nextId++, tone, title, body }]);
  }, []);

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
        // Announced politely: these report background state, so they must not
        // interrupt whatever the customer is reading.
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ToastRow key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastRow({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const { icon: Icon, className } = TONE_STYLE[toast.tone];

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-soft animate-fade-up",
        className
      )}
    >
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{toast.title}</p>
        {toast.body && <p className="mt-0.5 text-xs opacity-80">{toast.body}</p>}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
