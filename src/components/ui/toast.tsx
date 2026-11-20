"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

type Tone = "info" | "error" | "success";
interface Toast {
  id: number;
  tone: Tone;
  message: string;
  detail?: string | null;
}

const ToastContext = createContext<{ push: (message: string, tone?: Tone, detail?: string | null) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (message: string, tone: Tone = "info", detail?: string | null) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t.slice(-3), { id, tone, message, detail }]);
      setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4200);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className="pointer-events-auto flex w-full max-w-md animate-rise items-start gap-3 rounded-panel bg-ink px-4 py-3 text-sm text-paper shadow-[0_18px_40px_-16px_rgb(22_26_44/0.6)]"
          >
            {t.tone === "error" ? (
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-[#ff8a80]" />
            ) : t.tone === "success" ? (
              <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-[#6ee7b7]" />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t.message}</p>
              {t.detail ? <p className="mt-0.5 text-paper/65">{t.detail}</p> : null}
            </div>
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="-mr-1 rounded p-0.5 text-paper/50 transition-colors hover:text-paper">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
