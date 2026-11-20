"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { X } from "lucide-react";

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
      setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4000);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-panel border px-4 py-3 text-sm shadow-[0_6px_24px_-12px_rgba(27,36,32,0.35)] ${
              t.tone === "error" ? "border-signal/35 bg-surface text-ink" : "border-ink/15 bg-ink text-paper"
            }`}
          >
            {t.tone === "error" ? <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-signal" /> : null}
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t.message}</p>
              {t.detail ? <p className={t.tone === "error" ? "text-ink/65" : "text-paper/70"}>{t.detail}</p> : null}
            </div>
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="opacity-60 hover:opacity-100">
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
