"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Loader2 } from "lucide-react";
import { useChat, emptyChannel, type ChatMessage } from "@/client/chat/store";
import { discardFailed, loadOlder, notifyTyping, retrySend, sendText, setActiveChannel } from "@/client/chat/engine";
import { useAppData } from "@/client/app-data";
import { Avatar } from "@/components/ui/avatar";
import { agentVisual } from "@/lib/agent-visual";
import { MSG } from "@/lib/message-types";
import { useNow } from "@/client/use-now";
import { Composer, type Mentionable } from "./composer";
import { MessageRow, type RowContext, type SenderInfo } from "./message-row";
import type { CardPerson } from "./cards";

const GROUP_WINDOW = 5 * 60 * 1000;
const CARD_TYPES = new Set<string>([MSG.TASKS, MSG.POLL, MSG.ACTION, MSG.NOTICE]);

function dayLabel(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function Dots({ color = "var(--accent)" }: { color?: string }) {
  return (
    <span aria-hidden className="flex gap-0.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1 animate-working rounded-full" style={{ animationDelay: `${i * 180}ms`, backgroundColor: color }} />
      ))}
    </span>
  );
}

export interface ChatViewProps {
  channelKey: string;
  isDirect: boolean;
  mentionables: Mentionable[];
  people: CardPerson[];
  placeholder: string;
  empty: React.ReactNode;
  onSent?: (m: ChatMessage) => Promise<void> | void;
  onTranslate?: (m: ChatMessage) => void;
  onPin?: (m: ChatMessage) => void;
  banner?: React.ReactNode;
  notice?: React.ReactNode;
  composerDisabledReason?: string;
  /** Text to place in the composer (for example from a suggested prompt). */
  draft?: { text: string; nonce: number } | null;
}

export function AgentActivity({ channelKey }: { channelKey: string }) {
  const activity = useChat((s) => s.agents[channelKey]);
  const { profiles } = useAppData();
  const now = useNow(10000);
  const entries = Object.entries(activity ?? {}).filter(([, a]) => now - a.at < 120000);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 px-4 pb-1 sm:px-6" aria-live="polite" data-testid="agent-activity">
      {entries.map(([id, a]) => {
        const p = profiles[id];
        const name = p?.name ?? "An agent";
        const visual = agentVisual(p?.handle, id);
        const label =
          a.state === "error"
            ? `${name} ran into a problem`
            : a.detail
              ? `${name}: ${a.detail.charAt(0).toLowerCase()}${a.detail.slice(1)}`
              : `${name} is working`;
        return (
          <div key={id} className={`flex animate-fade items-center gap-2 text-xs ${a.state === "error" ? "text-signal" : "text-ink/65"}`}>
            <Avatar name={name} src={p?.avatarUrl} kind="agent" handle={p?.handle} seed={id} size="xs" />
            <span className="truncate">{label}</span>
            {a.state !== "error" ? <Dots color={visual.colors.bg} /> : null}
          </div>
        );
      })}
    </div>
  );
}

function TypingLine({ channelKey }: { channelKey: string }) {
  const typing = useChat((s) => s.typing[channelKey]);
  const me = useChat((s) => s.me);
  const { profiles } = useAppData();
  const now = useNow(2000);
  const names = Object.entries(typing ?? {})
    .filter(([id, exp]) => id !== me && exp > now)
    .map(([id]) => profiles[id]?.name?.split(" ")[0] ?? "Someone");
  return (
    <p className="flex h-5 items-center gap-1.5 px-4 text-xs text-ink/50 sm:px-6" aria-live="polite">
      {names.length ? (
        <>
          <Dots color="rgb(22 26 44 / 0.4)" />
          {names.length === 1 ? `${names[0]} is typing` : `${names.slice(0, 2).join(" and ")}${names.length > 2 ? " and others" : ""} are typing`}
        </>
      ) : null}
    </p>
  );
}

export function ChatView(props: ChatViewProps) {
  const { channelKey } = props;
  const channel = useChat((s) => s.channels[channelKey] ?? emptyChannel);
  const me = useChat((s) => s.me) ?? "";
  const receipts = useChat((s) => s.receipts);
  const connection = useChat((s) => s.connection);
  const { profiles, ensureProfiles } = useAppData();
  const scroller = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const prevHeight = useRef<number | null>(null);
  const [showJump, setShowJump] = useState(false);
  const [animateAfter] = useState(() => Date.now());

  useEffect(() => {
    setActiveChannel(channelKey);
    stick.current = true;
    void loadOlder(channelKey, true);
    const onVisible = () => document.visibilityState === "visible" && setActiveChannel(channelKey);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      setActiveChannel(null);
    };
  }, [channelKey]);

  const senderIds = useMemo(() => [...new Set(channel.messages.map((m) => m.senderId))], [channel.messages]);
  useEffect(() => ensureProfiles(senderIds), [senderIds, ensureProfiles]);

  // Older pages: keep the viewport anchored when content is prepended.
  const loadEarlier = useCallback(() => {
    if (!channel.hasMore || channel.loading || !channel.loaded) return;
    prevHeight.current = scroller.current?.scrollHeight ?? null;
    stick.current = false;
    void loadOlder(channelKey);
  }, [channel.hasMore, channel.loading, channel.loaded, channelKey]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadEarlier(), { root: scroller.current, rootMargin: "200px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [loadEarlier]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prevHeight.current !== null && !channel.loading) {
      el.scrollTop += el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
      return;
    }
    if (stick.current) el.scrollTop = el.scrollHeight;
  }, [channel.messages, channel.loading]);

  // Content can grow without the message list changing (fonts loading, a streamed reply or a
  // card filling in). Stay pinned to the newest message unless the reader scrolled up.
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = list.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const sc = scroller.current;
      if (sc && stick.current && prevHeight.current === null) sc.scrollTop = sc.scrollHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    stick.current = nearBottom;
    setShowJump(!nearBottom);
  };

  const lastOwnMessageId = useMemo(() => {
    for (let i = channel.messages.length - 1; i >= 0; i--) {
      const m = channel.messages[i];
      if (m.senderId === me && m.messageId) return m.messageId;
    }
    return null;
  }, [channel.messages, me]);

  const ctx: RowContext = useMemo(() => {
    const sender = (id: string): SenderInfo => {
      const p = profiles[id];
      if (p) return { name: p.name, avatarUrl: p.avatarUrl, kind: p.kind, handle: p.handle, seed: p.nexconnId };
      return { name: id === me ? "You" : "Unknown member", avatarUrl: null, kind: "user" };
    };
    return {
      me,
      sender,
      mentionTokens: props.mentionables.map((m) => ({ label: m.label, kind: m.kind })),
      people: props.people,
      nameOf: (id) => profiles[id]?.name ?? null,
      receipts,
      onRetry: (m) => retrySend(channelKey, m.key),
      onDiscard: (m) => discardFailed(channelKey, m.key),
      onTranslate: props.onTranslate,
      onPin: props.onPin,
      isDirect: props.isDirect,
      lastOwnMessageId,
      animateAfter,
    };
  }, [profiles, me, props.mentionables, props.people, props.onTranslate, props.onPin, props.isDirect, receipts, channelKey, lastOwnMessageId, animateAfter]);

  const { onSent } = props;
  const send = useCallback(
    (text: string, mentionedIds: string[]) => {
      stick.current = true;
      void sendText(channelKey, text, mentionedIds, onSent);
    },
    [channelKey, onSent],
  );

  const messages = channel.messages;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain" data-testid="message-scroller">
        <div ref={sentinel} aria-hidden className="h-px" />
        {channel.loading && messages.length > 0 ? (
          <p className="flex items-center justify-center gap-2 py-3 text-xs text-ink/50">
            <Loader2 aria-hidden className="size-3.5 animate-spin" /> Loading earlier messages
          </p>
        ) : null}
        {channel.loaded && !channel.hasMore && messages.length > 0 ? (
          <p className="pb-2 pt-6 text-center text-2xs text-ink/40">This is the beginning of the conversation.</p>
        ) : null}
        {props.banner}
        {!channel.loaded && channel.loading ? (
          <div className="flex flex-col gap-6 px-6 py-6" aria-busy="true" aria-label="Loading messages">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <div className={`skeleton size-9 shrink-0 ${i % 2 ? "rounded-[26%]" : "rounded-full"}`} />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="skeleton h-3 w-32 rounded" />
                  <div className="skeleton h-3 rounded" style={{ width: `${[66, 48, 72, 40][i]}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : channel.error && messages.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-signal">{channel.error}</p>
            <button type="button" onClick={() => void loadOlder(channelKey, true)} className="mt-2 text-sm font-semibold text-accent hover:underline">
              Try again
            </button>
          </div>
        ) : channel.loaded && messages.length === 0 ? (
          <div className="px-6 py-12">{props.empty}</div>
        ) : null}
        <ol ref={list} className="pb-4" aria-label="Messages">
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const newDay = !prev || new Date(prev.sentTime).toDateString() !== new Date(m.sentTime).toDateString();
            const grouped =
              !newDay &&
              prev &&
              prev.senderId === m.senderId &&
              m.sentTime - prev.sentTime < GROUP_WINDOW &&
              !CARD_TYPES.has(m.type) &&
              !CARD_TYPES.has(prev.type) &&
              prev.isPrivate === m.isPrivate;
            return (
              <Fragment key={m.key}>
                {newDay ? (
                  <li className="sticky top-0 z-[1] flex justify-center px-6 pb-1 pt-4" aria-label={dayLabel(m.sentTime)}>
                    <span className="rounded-full border border-ink/8 bg-surface/95 px-3 py-0.5 text-2xs font-semibold text-ink/55 shadow-[0_1px_2px_rgb(22_26_44/0.05)] backdrop-blur">
                      {dayLabel(m.sentTime)}
                    </span>
                  </li>
                ) : null}
                <MessageRow m={m} grouped={Boolean(grouped)} ctx={ctx} />
              </Fragment>
            );
          })}
        </ol>
      </div>
      {showJump ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              stick.current = true;
              scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
            }}
            className="absolute -top-12 left-1/2 z-10 inline-flex -translate-x-1/2 animate-pop items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-paper shadow-float transition-colors hover:bg-ink/85"
          >
            <ArrowDown aria-hidden className="size-3.5" /> Latest messages
          </button>
        </div>
      ) : null}
      <AgentActivity channelKey={channelKey} />
      {props.notice}
      <TypingLine channelKey={channelKey} />
      <Composer
        placeholder={props.placeholder}
        mentionables={props.mentionables}
        onSend={send}
        onTyping={() => notifyTyping(channelKey)}
        disabled={Boolean(props.composerDisabledReason) || connection === "kicked"}
        disabledReason={props.composerDisabledReason ?? (connection === "kicked" ? "This tab is disconnected" : undefined)}
        autoFocusKey={channelKey}
        draft={props.draft}
      />
    </div>
  );
}
