"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "./button";

/** Accessible modal built on <dialog>: focus trap, Escape to close, backdrop click to close. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby={titleId}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-2xl" : "max-w-md"} rounded-sheet border border-ink/10 bg-surface p-0 text-ink shadow-[0_2px_6px_rgb(22_26_44/0.06),0_40px_90px_-30px_rgb(22_26_44/0.55)] backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]`}
    >
      {open ? (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
            <div>
              <h2 id={titleId} className="text-xl font-semibold tracking-[-0.01em]">
                {title}
              </h2>
              {description ? <p className="mt-1 text-sm text-ink/60">{description}</p> : null}
            </div>
            <button type="button" aria-label="Close" onClick={onClose} className="-mr-1.5 rounded-control p-1.5 text-ink/50 transition-colors hover:bg-ink/6 hover:text-ink">
              <X className="size-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-6 pb-6 pt-3">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  danger = false,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className="text-ink/70">{description}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
