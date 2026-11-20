"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

export interface Mentionable {
  nexconnId: string;
  /** Text inserted after "@" (agent handle, or person's name) */
  label: string;
  name: string;
  kind: "user" | "agent";
  avatarUrl: string | null;
  description?: string;
  disabled?: boolean;
}

interface ComposerProps {
  placeholder: string;
  mentionables: Mentionable[];
  disabled?: boolean;
  disabledReason?: string;
  onSend: (text: string, mentionedIds: string[]) => void;
  onTyping?: () => void;
  autoFocusKey?: string;
}

/** Finds an "@query" token ending at the caret. */
function activeMention(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const m = before.match(/(^|\s)@([^\s@]{0,30})$/);
  if (!m) return null;
  return { start: caret - m[2].length - 1, query: m[2] };
}

export function Composer({ placeholder, mentionables, disabled, disabledReason, onSend, onTyping, autoFocusKey }: ComposerProps) {
  const [text, setText] = useState("");
  const [caret, setCaret] = useState(0);
  const [highlight, setHighlight] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, [autoFocusKey]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const mention = dismissed ? null : activeMention(text, caret);
  const suggestions = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return mentionables
      .filter((m) => m.label.toLowerCase().startsWith(q) || m.name.toLowerCase().includes(q))
      .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "agent" ? -1 : 1))
      .slice(0, 8);
  }, [mention, mentionables]);
  const open = Boolean(mention) && suggestions.length > 0;

  useEffect(() => setHighlight(0), [mention?.query]);

  function insert(m: Mentionable) {
    if (!mention) return;
    const next = `${text.slice(0, mention.start)}@${m.label} ${text.slice(caret)}`;
    const pos = mention.start + m.label.length + 2;
    setText(next);
    setCaret(pos);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(pos, pos);
    });
  }

  function submit() {
    const value = text.trim();
    if (!value || disabled) return;
    const lower = value.toLowerCase();
    const mentioned = mentionables
      .filter((m) => {
        const token = `@${m.label.toLowerCase()}`;
        const i = lower.indexOf(token);
        if (i < 0) return false;
        const after = lower[i + token.length];
        return after === undefined || !/[a-z0-9]/.test(after);
      })
      .map((m) => m.nexconnId);
    onSend(value, [...new Set(mentioned)]);
    setText("");
    setCaret(0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insert(suggestions[highlight]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDismissed(true);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="relative px-3 pb-3 sm:px-6 sm:pb-5">
      {open ? (
        <div className="absolute bottom-full left-3 right-3 z-20 mb-1 overflow-hidden rounded-panel border border-ink/14 bg-surface shadow-[0_12px_32px_-16px_rgba(27,36,32,0.4)] sm:left-6 sm:right-auto sm:w-96">
          <ul role="listbox" id="mention-list" aria-label="Mention someone" className="max-h-72 overflow-y-auto py-1">
            {suggestions.map((s, i) => (
              <li
                key={s.nexconnId}
                id={`mention-${s.nexconnId}`}
                role="option"
                aria-selected={i === highlight}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insert(s);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${i === highlight ? "bg-ink/6" : ""}`}
              >
                <Avatar name={s.name} src={s.avatarUrl} kind={s.kind} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {s.name}
                    {s.kind === "agent" ? <span className="ml-1.5 text-2xs font-normal text-accent">Agent</span> : null}
                    {s.disabled ? <span className="ml-1.5 text-2xs font-normal text-ink/45">Paused</span> : null}
                  </p>
                  {s.description ? <p className="truncate text-2xs text-ink/55">{s.description}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className={`flex items-end gap-2 rounded-panel border bg-surface px-3 py-2 transition-colors ${disabled ? "border-ink/10" : "border-ink/18 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15"}`}>
        <textarea
          ref={ref}
          value={text}
          rows={1}
          disabled={disabled}
          placeholder={disabled ? disabledReason ?? placeholder : placeholder}
          aria-label="Message"
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? "mention-list" : undefined}
          aria-autocomplete="list"
          aria-activedescendant={open ? `mention-${suggestions[highlight]?.nexconnId}` : undefined}
          onChange={(e) => {
            setText(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
            setDismissed(false);
            if (e.target.value.trim()) onTyping?.();
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
          onKeyDown={onKeyDown}
          className="max-h-[200px] min-h-6 flex-1 resize-none bg-transparent py-1 text-[0.9375rem] leading-6 placeholder:text-ink/40 focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !text.trim()}
          aria-label="Send message"
          className="grid size-8 shrink-0 place-items-center rounded-control bg-accent text-paper transition-opacity hover:bg-accent/90 disabled:bg-ink/15 disabled:text-ink/40"
        >
          <SendHorizontal className="size-4" />
        </button>
      </div>
      <p className="mt-1.5 hidden px-1 text-2xs text-ink/45 sm:block">
        Enter to send, Shift + Enter for a new line. Type @ to mention a person or an agent.
      </p>
    </div>
  );
}
