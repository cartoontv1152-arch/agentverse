"use client";

import { useSyncExternalStore } from "react";
import type { AgentStateName } from "@/lib/message-types";

export type ConnectionState = "idle" | "connecting" | "connected" | "reconnecting" | "suspended" | "kicked" | "error";

export interface ChatMessage {
  /** Stable React key: server message id, or a local id while sending. */
  key: string;
  messageId: string | null;
  channelKey: string;
  senderId: string;
  type: string;
  content: Record<string, unknown>;
  sentTime: number;
  status: "sending" | "sent" | "failed";
  errorCode?: number;
  /** Streaming agent replies */
  streaming?: boolean;
  streamText?: string;
  metadata: Record<string, string>;
  /** Delivered only to some members (targeted message) */
  isPrivate: boolean;
  edited: boolean;
  mentionedIds: string[];
  needReceipt: boolean;
  receiptSent: boolean;
}

export interface ChannelState {
  messages: ChatMessage[];
  loaded: boolean;
  loading: boolean;
  hasMore: boolean;
  error: string | null;
}

export interface ChannelSummary {
  unread: number;
  lastText: string;
  lastTime: number;
  lastSenderId: string;
}

export interface AgentActivity {
  state: AgentStateName;
  detail?: string;
  at: number;
}

export interface ChatState {
  connection: ConnectionState;
  connectionCode: number | null;
  me: string | null;
  channels: Record<string, ChannelState>;
  summaries: Record<string, ChannelSummary>;
  summariesLoaded: boolean;
  /** channelKey -> userId -> expiresAt */
  typing: Record<string, Record<string, number>>;
  /** channelKey -> agent Nexconn id -> activity */
  agents: Record<string, Record<string, AgentActivity>>;
  /** messageId -> read receipt counts */
  receipts: Record<string, { read: number; total: number }>;
  active: string | null;
}

const initial: ChatState = {
  connection: "idle",
  connectionCode: null,
  me: null,
  channels: {},
  summaries: {},
  summariesLoaded: false,
  typing: {},
  agents: {},
  receipts: {},
  active: null,
};

type Listener = () => void;

class Store {
  private state: ChatState = initial;
  private listeners = new Set<Listener>();

  get = () => this.state;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  set(updater: (s: ChatState) => ChatState) {
    const next = updater(this.state);
    if (next === this.state) return;
    this.state = next;
    this.listeners.forEach((l) => l());
  }

  reset() {
    this.state = initial;
    this.listeners.forEach((l) => l());
  }
}

export const chatStore = new Store();

export const emptyChannel: ChannelState = { messages: [], loaded: false, loading: false, hasMore: true, error: null };

export function useChat<T>(selector: (s: ChatState) => T): T {
  return useSyncExternalStore(
    chatStore.subscribe,
    () => selector(chatStore.get()),
    () => selector(initial),
  );
}

/* --------------------------------------------------------------------------------------------
 * Pure helpers (unit tested)
 * ------------------------------------------------------------------------------------------ */

/** Inserts or replaces messages (dedupe by message id / key) and keeps server-time order. */
export function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (incoming.length === 0) return existing;
  const byId = new Map<string, number>();
  const list = existing.slice();
  list.forEach((m, i) => {
    if (m.messageId) byId.set(m.messageId, i);
  });
  for (const msg of incoming) {
    const index = msg.messageId ? byId.get(msg.messageId) : list.findIndex((m) => m.key === msg.key);
    if (index !== undefined && index >= 0) {
      const prev = list[index];
      list[index] = {
        ...prev,
        ...msg,
        key: prev.key,
        metadata: { ...prev.metadata, ...msg.metadata },
        // Never move a streamed text backwards (history may hold a shorter snapshot).
        streamText:
          prev.streamText && msg.streamText !== undefined && prev.streamText.length > msg.streamText.length
            ? prev.streamText
            : msg.streamText ?? prev.streamText,
      };
    } else {
      list.push(msg);
      if (msg.messageId) byId.set(msg.messageId, list.length - 1);
    }
  }
  return list.sort((a, b) => a.sentTime - b.sentTime);
}

/** One line of plain text from a Markdown message: no sources footer, emphasis or extra spaces. */
function plainLine(text: string): string {
  return text
    .replace(/\n\n\*\*Sources\*\*[\s\S]*$/, "")
    .replace(/\s*\[\d{1,2}(?:\s*,\s*\d{1,2})*\]/g, "")
    .replace(/[*_`#>]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export function messagePreview(m: Pick<ChatMessage, "type" | "content" | "streamText">): string {
  const c = m.content as Record<string, unknown>;
  switch (m.type) {
    case "RC:TxtMsg":
      return plainLine(String(c.text ?? c.content ?? ""));
    case "RC:StreamMsg":
      // The channel list only carries a stream's first chunk, which can be empty.
      return plainLine(String(m.streamText || c.content || "")) || "Sent a reply";
    case "AGV:Tasks":
      return `Checklist: ${String(c.title ?? "")}`;
    case "AGV:Poll":
      return `Poll: ${String(c.question ?? "")}`;
    case "AGV:Action":
      return "Proposed an action";
    case "AGV:Notice":
      return String(c.text ?? "");
    default:
      return "Message";
  }
}
