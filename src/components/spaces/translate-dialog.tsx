"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

const COMMON = ["English", "Spanish", "French", "German", "Portuguese", "Hindi", "Japanese", "Chinese (Simplified)", "Arabic", "Korean"];

export function TranslateDialog({
  open,
  onClose,
  preview,
  onTranslate,
}: {
  open: boolean;
  onClose: () => void;
  preview: string;
  onTranslate: (language: string) => Promise<void>;
}) {
  const [language, setLanguage] = useState("");
  const [busy, setBusy] = useState(false);
  async function go(lang: string) {
    if (!lang.trim()) return;
    setBusy(true);
    await onTranslate(lang.trim()).finally(() => setBusy(false));
    setLanguage("");
  }
  return (
    <Dialog open={open} onClose={onClose} title="Translate message" description="The Translator replies privately. Only you will see the translation.">
      <blockquote className="mb-4 line-clamp-3 border-l-2 border-ink/20 pl-3 text-sm text-ink/70">{preview}</blockquote>
      <div className="flex flex-wrap gap-1.5">
        {COMMON.map((l) => (
          <button key={l} type="button" disabled={busy} onClick={() => go(l)} className="rounded-full border border-ink/15 px-3 py-1 text-sm hover:border-accent hover:text-accent">
            {l}
          </button>
        ))}
      </div>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void go(language);
        }}
      >
        <Input aria-label="Other language" placeholder="Another language" value={language} onChange={(e) => setLanguage(e.target.value)} maxLength={40} />
        <Button type="submit" variant="primary" loading={busy} disabled={!language.trim()}>
          Translate
        </Button>
      </form>
    </Dialog>
  );
}
