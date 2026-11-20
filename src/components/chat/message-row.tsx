"use client";

import { memo } from "react";
import { AlertTriangle, EyeOff, Languages, Pin, RotateCw, Trash2, Info, ExternalLink } from "lucide-react";
import type { ChatMessage } from "@/client/chat/store";
import { Avatar } from "@/components/ui/avatar";
import { agentVisual, HUES, type AgentVisual } from "@/lib/agent-visual";
import { Markdown, type MarkdownOptions } from "./markdown";
import { ActionCard, PollCard, TasksCard, type CardPerson } from "./cards";
import { MSG, splitSourcesFooter, type NoticeContent } from "@/lib/message-types";

export interface SenderInfo {
  name: string;
  avatarUrl: string | null;
  kind: "user" | "agent";
  handle?: string | null;
  seed?: string | null;
}

export interface RowContext {
  me: string;
  sender: (nexconnId: string) => SenderInfo;
  mentionTokens: MarkdownOptions["mentions"];
  people: CardPerson[];
  nameOf: (nexconnId: string) => string | null;
  receipts: Record<string, { read: number; total: number }>;
  onRetry: (m: ChatMessage) => void;
  onDiscard: (m: ChatMessage) => void;
  onTranslate?: (m: ChatMessage) => void;
  onPin?: (m: ChatMessage) => void;
  isDirect: boolean;
  lastOwnMessageId: string | null;
  /** Messages sent after this time animate in; older history renders still. */
  animateAfter: number;
}

export function messageText(m: ChatMessage): string {
  if (m.type === MSG.STREAM) return m.streamText ?? String(m.content.content ?? "");
  return String(m.content.text ?? m.content.content ?? "");
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Sources({ sources }: { sources: { n: number; title: string; url: string }[] }) {
  return (
    <div className="mt-2.5 flex flex-col gap-1.5" aria-label="Sources">
      <p className="text-2xs font-semibold text-ink/45">Sources</p>
      <ol className="flex flex-wrap gap-1.5">
        {sources.map((s) => {
          let host = "";
          try {
            host = new URL(s.url).hostname.replace(/^www\./, "");
          } catch {
            host = s.url;
          }
          return (
            <li key={s.n} className="max-w-full">
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="group inline-flex max-w-full items-center gap-2 rounded-control border border-ink/10 bg-paper px-2 py-1 text-xs transition-colors hover:border-accent/40 hover:bg-accent/5"
              >
                <span className="grid size-4 shrink-0 place-items-center rounded-[4px] bg-accent/12 text-[0.65rem] font-bold text-accent">{s.n}</span>
                <span className="truncate font-medium">{s.title}</span>
                <span className="hidden shrink-0 text-ink/40 sm:inline">{host}</span>
                <ExternalLink aria-hidden className="size-3 shrink-0 text-ink/35 group-hover:text-accent" />
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Body({ m, ctx, visual }: { m: ChatMessage; ctx: RowContext; visual: AgentVisual | null }) {
  const tint = visual?.colors ?? HUES.cobalt;
  switch (m.type) {
    case MSG.TEXT: {
      const { body, sources } = splitSourcesFooter(messageText(m));
      if (sources.length === 0) return <Markdown text={body} options={{ mentions: ctx.mentionTokens }} />;
      return (
        <div>
          <Markdown text={body} options={{ mentions: ctx.mentionTokens, citations: new Map(sources.map((s) => [s.n, s.url])) }} />
          <Sources sources={sources} />
        </div>
      );
    }
    case MSG.STREAM: {
      const { body, sources } = splitSourcesFooter(messageText(m));
      const citations = new Map(sources.map((s) => [s.n, s.url]));
      return (
        <div>
          {body ? (
            <Markdown text={body} options={{ mentions: ctx.mentionTokens, citations }} />
          ) : (
            <p className="flex items-center gap-1.5 text-ink/45">
              Writing
              <span aria-hidden className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="size-1 animate-working rounded-full bg-ink/40" style={{ animationDelay: `${i * 180}ms` }} />
                ))}
              </span>
            </p>
          )}
          {m.streaming && body ? <span aria-hidden className="ml-0.5 inline-block h-4 w-1 translate-y-0.5 animate-caret rounded-[1px]" style={{ backgroundColor: tint.bg }} /> : null}
          {sources.length && !m.streaming ? <Sources sources={sources} /> : null}
        </div>
      );
    }
    case MSG.TASKS:
      return <TasksCard message={m} people={ctx.people} tint={tint} />;
    case MSG.POLL:
      return <PollCard message={m} me={ctx.me} nameOf={ctx.nameOf} tint={tint} />;
    case MSG.ACTION:
      return <ActionCard message={m} tint={tint} />;
    case MSG.NOTICE: {
      const c = m.content as unknown as NoticeContent;
      return (
        <p
          role={c.level === "error" ? "alert" : undefined}
          className={`mt-0.5 inline-flex items-start gap-2 rounded-control px-3 py-2 text-sm ${
            c.level === "error" ? "border border-signal/25 bg-[#fdf1f0] text-ink" : "bg-paper text-ink/75"
          }`}
        >
          {c.level === "error" ? <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-signal" /> : <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-ink/45" />}
          {c.text}
        </p>
      );
    }
    default:
      return <p className="text-sm italic text-ink/50">This message type isn&apos;t supported here yet.</p>;
  }
}

export const MessageRow = memo(function MessageRow({ m, grouped, ctx }: { m: ChatMessage; grouped: boolean; ctx: RowContext }) {
  const sender = ctx.sender(m.senderId);
  const isAgent = sender.kind === "agent";
  const visual = isAgent ? agentVisual(sender.handle, sender.seed ?? m.senderId) : null;
  const mine = m.senderId === ctx.me;
  const canTranslate = ctx.onTranslate && (m.type === MSG.TEXT || m.type === MSG.STREAM) && m.messageId && !m.isPrivate;
  const canPin = ctx.onPin && (m.type === MSG.TEXT || m.type === MSG.STREAM) && m.messageId && !m.isPrivate;
  const receipt = mine && m.messageId && m.messageId === ctx.lastOwnMessageId ? ctx.receipts[m.messageId] : undefined;
  const live = m.status === "sending" || m.sentTime >= ctx.animateAfter;

  return (
    <li
      data-testid="message"
      data-type={m.type}
      data-sender-kind={sender.kind}
      className={`group relative flex gap-3 px-4 transition-colors hover:bg-paper/70 sm:px-6 ${grouped ? "pt-0.5" : "pt-3"} ${live ? "animate-rise" : ""} ${
        m.isPrivate ? "bg-accent/[0.035]" : ""
      }`}
    >
      <div className="w-9 shrink-0">
        {!grouped ? <Avatar name={sender.name} src={sender.avatarUrl} kind={sender.kind} handle={sender.handle} seed={sender.seed ?? m.senderId} /> : null}
      </div>
      <div className="min-w-0 flex-1 pb-1">
        {!grouped ? (
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold" style={visual ? { color: visual.colors.text } : undefined}>
              {sender.name}
            </span>
            {isAgent && visual ? (
              <span className="rounded-chip px-1.5 text-2xs font-semibold" style={{ backgroundColor: visual.colors.soft, color: visual.colors.text }}>
                Agent
              </span>
            ) : null}
            <time className="text-2xs text-ink/40" dateTime={new Date(m.sentTime).toISOString()}>
              {formatTime(m.sentTime)}
            </time>
            {m.isPrivate ? (
              <span className="inline-flex items-center gap-1 text-2xs font-medium text-accent">
                <EyeOff aria-hidden className="size-3" /> Only visible to you
              </span>
            ) : null}
            {m.edited && m.type === MSG.TEXT ? <span className="text-2xs text-ink/40">edited</span> : null}
          </div>
        ) : null}
        <div className={`${m.status === "sending" ? "opacity-55" : ""} text-[0.9375rem] leading-relaxed transition-opacity`}>
          <Body m={m} ctx={ctx} visual={visual} />
        </div>
        {m.status === "failed" ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-signal" role="alert">
            <AlertTriangle aria-hidden className="size-3.5" />
            Not sent{m.errorCode ? ` (code ${m.errorCode})` : ""}.
            <button type="button" onClick={() => ctx.onRetry(m)} className="inline-flex items-center gap-1 rounded px-1 font-semibold underline-offset-2 hover:underline">
              <RotateCw aria-hidden className="size-3" /> Retry
            </button>
            <button type="button" onClick={() => ctx.onDiscard(m)} className="inline-flex items-center gap-1 rounded px-1 text-ink/55 hover:text-ink">
              <Trash2 aria-hidden className="size-3" /> Discard
            </button>
          </div>
        ) : null}
        {receipt && receipt.read > 0 ? <p className="mt-0.5 text-2xs text-ink/45">{ctx.isDirect ? "Seen" : `Seen by ${receipt.read}`}</p> : null}
      </div>
      {canTranslate || canPin ? (
        <div className="absolute -top-3 right-4 hidden gap-0.5 rounded-control border border-ink/10 bg-surface p-0.5 shadow-lift group-focus-within:flex group-hover:flex sm:right-6">
          {canTranslate ? (
            <button type="button" title="Translate" aria-label="Translate message" onClick={() => ctx.onTranslate!(m)} className="rounded-[7px] p-1.5 text-ink/55 transition-colors hover:bg-ink/6 hover:text-ink">
              <Languages className="size-4" />
            </button>
          ) : null}
          {canPin ? (
            <button type="button" title="Pin to memory" aria-label="Pin message to space memory" onClick={() => ctx.onPin!(m)} className="rounded-[7px] p-1.5 text-ink/55 transition-colors hover:bg-ink/6 hover:text-ink">
              <Pin className="size-4" />
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
});
