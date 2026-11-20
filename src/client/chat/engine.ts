"use client";

import type { BaseChannel, Message, MessagesQuery } from "@nexconn/chat";
import { api } from "@/client/api";
import { MSG, STREAM_SUMMARY_KEY, parseStreamSummary, type AgentStateContent } from "@/lib/message-types";
import { chatStore, emptyChannel, mergeMessages, messagePreview, type ChatMessage, type ChatState } from "./store";

/**
 * Nexconn Web Chat SDK integration (client side). One engine per tab:
 * - NCEngine.initialize once, custom message registration, handlers before connect
 * - connect with a server-issued token; on token errors fetch a fresh token and retry once
 * - SDK auto-reconnect; on reconnect we refresh channel summaries and the open channel
 * - realtime events (messages, updates, metadata, streaming, receipts, typing) feed a store
 */

type SDK = typeof import("@nexconn/chat");

let sdk: SDK | null = null;
let startPromise: Promise<void> | null = null;
let initializedAppKey: string | null = null;
let wasConnected = false;
const queries = new Map<string, MessagesQuery>();
const pendingSends = new Map<string, { text: string; mentionedIds: string[]; onSent?: (m: ChatMessage) => Promise<void> | void }>();
const lastTypingSent = new Map<string, number>();
let localSeq = 0;

const TOKEN_ERRORS = new Set([31004, 31005]);
const KICKED = 31010;
/** Transient connect failures worth retrying: timeout, navigation failed, server unavailable, reconnect exhausted. */
const RETRYABLE_CONNECT = new Set([-1, 34001, 35008, 33007, 30002]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let autoRetryTimer: ReturnType<typeof setTimeout> | null = null;

export function channelKeyOf(type: number, id: string): string {
  if (type === 3) return `g:${id}`;
  if (type === 1) return `d:${id}`;
  return `x:${type}:${id}`;
}

function channelFor(key: string): BaseChannel {
  if (!sdk) throw new Error("Chat is not ready");
  const [kind, id] = key.split(":");
  if (kind === "g") return new sdk.GroupChannel(id);
  if (kind === "d") return new sdk.DirectChannel(id);
  throw new Error(`Unsupported channel ${key}`);
}

function mapToObject(meta: unknown): Record<string, string> {
  if (!meta) return {};
  if (meta instanceof Map) return Object.fromEntries(meta as Map<string, string>);
  if (typeof meta === "object") return { ...(meta as Record<string, string>) };
  return {};
}

function parseExtra(extra: unknown): Record<string, string> {
  if (!extra) return {};
  if (typeof extra === "object") return extra as Record<string, string>;
  if (typeof extra === "string") {
    try {
      const v = JSON.parse(extra);
      return v && typeof v === "object" ? v : {};
    } catch {
      return {};
    }
  }
  return {};
}

const TRANSIENT_TYPES = new Set<string>([MSG.AGENT_STATE, MSG.TYPING]);

const attachedStreams = new Set<string>();

/** Fetches a stream message by id (if we don't have it yet) and pulls its chunks. */
async function attachStream(channelKey: string, messageId: string) {
  if (!sdk || attachedStreams.has(messageId)) return;
  attachedStreams.add(messageId);
  try {
    const res = await sdk.BaseChannel.getMessagesByIds({ channelIdentifier: channelFor(channelKey).identifier, messageIds: [messageId] });
    const raw = res.isOk ? res.data?.[messageId] : undefined;
    if (!raw) {
      attachedStreams.delete(messageId);
      return;
    }
    const m = toChatMessage(raw);
    upsertMessages(channelKey, [m]);
    bumpSummary(m, m.senderId !== chatStore.get().me && !isViewing(channelKey));
    if (m.streaming) await raw.requestStreamMessage();
  } catch {
    attachedStreams.delete(messageId);
  }
}
const COUNTED_TYPES = new Set<string>([MSG.TEXT, MSG.STREAM, MSG.TASKS, MSG.POLL, MSG.ACTION, "RC:ImgMsg", "RC:FileMsg"]);

export function toChatMessage(msg: Message): ChatMessage {
  const ident = msg.channelIdentifier;
  const channelKey = channelKeyOf(ident.channelType, ident.channelId);
  const content = (msg.content ?? {}) as Record<string, unknown>;
  const isStream = msg.messageType === MSG.STREAM;
  const extra = parseExtra(content.extra);
  const mentioned = (content.mentionedInfo as { userIdList?: string[] } | undefined)?.userIdList ?? [];
  const metadata = mapToObject(msg.metadata);
  const summary = isStream ? parseStreamSummary(metadata[STREAM_SUMMARY_KEY]) : null;
  return {
    key: msg.messageId || `c${msg.clientId}`,
    messageId: msg.messageId || null,
    channelKey,
    senderId: msg.senderUserId,
    type: msg.messageType,
    content,
    sentTime: msg.sentTime,
    status: "sent",
    streaming: isStream ? (summary ? !summary.complete : content.isCompleted !== true) : undefined,
    streamText: isStream ? (summary && summary.text.length >= String(content.content ?? "").length ? summary.text : String(content.content ?? "")) : undefined,
    metadata,
    isPrivate: (msg.directedUserIds?.length ?? 0) > 0 || extra.private === "1",
    edited: Boolean(msg.updateInfo) || Boolean(msg.hasChanged),
    mentionedIds: mentioned,
    needReceipt: Boolean(msg.needReceipt),
    receiptSent: Boolean(msg.sentReceipt),
  };
}

/* --------------------------------------------------------------------------------------------
 * Store updates
 * ------------------------------------------------------------------------------------------ */

function upsertMessages(channelKey: string, messages: ChatMessage[], patch?: Partial<ChatState["channels"][string]>) {
  chatStore.set((s) => {
    const current = s.channels[channelKey] ?? emptyChannel;
    return {
      ...s,
      channels: { ...s.channels, [channelKey]: { ...current, ...patch, messages: mergeMessages(current.messages, messages) } },
    };
  });
}

function updateMessageById(messageId: string, fn: (m: ChatMessage) => ChatMessage) {
  chatStore.set((s) => {
    for (const [key, channel] of Object.entries(s.channels)) {
      const index = channel.messages.findIndex((m) => m.messageId === messageId);
      if (index >= 0) {
        const messages = channel.messages.slice();
        messages[index] = fn(messages[index]);
        return { ...s, channels: { ...s.channels, [key]: { ...channel, messages } } };
      }
    }
    return s;
  });
}

function bumpSummary(m: ChatMessage, countUnread: boolean) {
  chatStore.set((s) => {
    const prev = s.summaries[m.channelKey] ?? { unread: 0, lastText: "", lastTime: 0, lastSenderId: "" };
    if (m.sentTime < prev.lastTime && !countUnread) return s;
    return {
      ...s,
      summaries: {
        ...s.summaries,
        [m.channelKey]: {
          unread: prev.unread + (countUnread ? 1 : 0),
          lastText: m.sentTime >= prev.lastTime ? messagePreview(m) : prev.lastText,
          lastTime: Math.max(prev.lastTime, m.sentTime),
          lastSenderId: m.sentTime >= prev.lastTime ? m.senderId : prev.lastSenderId,
        },
      },
    };
  });
}

function setAgentActivity(channelKey: string, agentNexconnId: string, content: AgentStateContent) {
  chatStore.set((s) => {
    const channel = { ...(s.agents[channelKey] ?? {}) };
    if (content.state === "done") delete channel[agentNexconnId];
    else channel[agentNexconnId] = { state: content.state, detail: content.detail, at: Date.now() };
    return { ...s, agents: { ...s.agents, [channelKey]: channel } };
  });
  if (content.state === "error") {
    // Error states clear on their own; the agent also posts a visible notice in the chat.
    setTimeout(() => {
      chatStore.set((s) => {
        const channel = { ...(s.agents[channelKey] ?? {}) };
        if (channel[agentNexconnId]?.state !== "error") return s;
        delete channel[agentNexconnId];
        return { ...s, agents: { ...s.agents, [channelKey]: channel } };
      });
    }, 8000);
  }
}

function setTyping(channelKey: string, userId: string) {
  const expires = Date.now() + 6000;
  chatStore.set((s) => ({ ...s, typing: { ...s.typing, [channelKey]: { ...(s.typing[channelKey] ?? {}), [userId]: expires } } }));
  setTimeout(() => {
    chatStore.set((s) => {
      const t = s.typing[channelKey];
      if (!t || (t[userId] ?? 0) > Date.now()) return s;
      const next = { ...t };
      delete next[userId];
      return { ...s, typing: { ...s.typing, [channelKey]: next } };
    });
  }, 6100);
}

function clearTyping(channelKey: string, userId: string) {
  chatStore.set((s) => {
    const t = s.typing[channelKey];
    if (!t?.[userId]) return s;
    const next = { ...t };
    delete next[userId];
    return { ...s, typing: { ...s.typing, [channelKey]: next } };
  });
}

function isViewing(channelKey: string): boolean {
  return chatStore.get().active === channelKey && typeof document !== "undefined" && document.visibilityState === "visible";
}

/* --------------------------------------------------------------------------------------------
 * Handlers
 * ------------------------------------------------------------------------------------------ */

function debug(...args: unknown[]) {
  try {
    if (typeof window !== "undefined" && window.localStorage.getItem("agv-debug") === "1") console.info("[agv]", ...args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))));
  } catch {
    // storage unavailable
  }
}

function handleIncoming(messages: Message[]) {
  const me = chatStore.get().me;
  debug("received", messages.map((m) => ({ type: m.messageType, channel: m.channelIdentifier?.channelId, sender: m.senderUserId, id: m.messageId, content: m.content })));
  const byChannel = new Map<string, ChatMessage[]>();
  for (const raw of messages) {
    const m = toChatMessage(raw);
    if (m.type === MSG.AGENT_STATE) {
      const state = m.content as unknown as AgentStateContent;
      setAgentActivity(m.channelKey, m.senderId, state);
      if (state.streamMessageId) void attachStream(m.channelKey, state.streamMessageId);
      continue;
    }
    if (m.type === MSG.TYPING) {
      if (m.senderId !== me) setTyping(m.channelKey, m.senderId);
      continue;
    }
    if (TRANSIENT_TYPES.has(m.type)) continue;
    clearTyping(m.channelKey, m.senderId);
    if (m.type === MSG.STREAM && m.streaming) {
      // Ask the SDK to deliver the remaining chunks (onStreamMessageRequestDelta).
      void raw.requestStreamMessage().catch(() => undefined);
    }
    const list = byChannel.get(m.channelKey) ?? [];
    list.push(m);
    byChannel.set(m.channelKey, list);
    const counts = COUNTED_TYPES.has(m.type) && m.senderId !== me && !isViewing(m.channelKey);
    bumpSummary(m, counts);
  }
  for (const [key, list] of byChannel) {
    upsertMessages(key, list);
    if (isViewing(key)) void markRead(key);
  }
}

async function registerHandlers(s: SDK) {
  const { NCEngine } = s;
  NCEngine.registerCustomMessages([
    { messageType: MSG.TASKS, isPersisted: true, isCounted: true },
    { messageType: MSG.POLL, isPersisted: true, isCounted: true },
    { messageType: MSG.ACTION, isPersisted: true, isCounted: true },
    { messageType: MSG.NOTICE, isPersisted: true, isCounted: false },
    { messageType: MSG.AGENT_STATE, isPersisted: false, isCounted: false, isStatusMessage: true },
    { messageType: MSG.TYPING, isPersisted: false, isCounted: false, isStatusMessage: true },
  ]);

  NCEngine.addConnectionStatusHandler(
    "agentverse",
    new s.ConnectionStatusHandler({
      onConnectionStatusChanged({ status, code }) {
        const C = s.ConnectionStatus;
        if (status === C.CONNECTED) {
          chatStore.set((st) => ({ ...st, connection: "connected", connectionCode: null }));
          if (wasConnected) void resyncAfterReconnect();
          wasConnected = true;
        } else if (status === C.CONNECTING) {
          chatStore.set((st) => ({ ...st, connection: wasConnected ? "reconnecting" : "connecting" }));
        } else if (status === C.DISCONNECTED) {
          if (code === KICKED) chatStore.set((st) => ({ ...st, connection: "kicked", connectionCode: code }));
          else chatStore.set((st) => ({ ...st, connection: wasConnected ? "reconnecting" : "error", connectionCode: code ?? null }));
        } else if (status === C.SUSPENDED) {
          chatStore.set((st) => ({ ...st, connection: "suspended", connectionCode: code ?? null }));
        }
      },
    }),
  );

  NCEngine.addMessageHandler(
    "agentverse",
    new s.MessageHandler({
      onMessageReceived({ messages }) {
        handleIncoming(messages);
      },
      onMessagesUpdated({ messages }) {
        debug("updated", messages.map((m) => ({ type: m.messageType, id: m.messageId, content: m.content })));
        const byChannel = new Map<string, ChatMessage[]>();
        for (const raw of messages) {
          const m = { ...toChatMessage(raw), edited: true };
          const list = byChannel.get(m.channelKey) ?? [];
          list.push(m);
          byChannel.set(m.channelKey, list);
        }
        byChannel.forEach((list, key) => upsertMessages(key, list));
      },
      onMessageMetadataUpdated({ messageId, metadata, channelIdentifier }) {
        debug("metadata", messageId, metadata);
        const summary = parseStreamSummary(metadata[STREAM_SUMMARY_KEY]);
        if (summary) {
          const key = channelKeyOf(channelIdentifier.channelType, channelIdentifier.channelId);
          const known = chatStore.get().channels[key]?.messages.some((m) => m.messageId === messageId);
          if (!known) void attachStream(key, messageId);
        }
        updateMessageById(messageId, (m) => ({
          ...m,
          metadata: { ...m.metadata, ...metadata },
          ...(summary && summary.text.length >= (m.streamText ?? "").length ? { streamText: summary.text, streaming: !summary.complete } : {}),
        }));
      },
      onMessageMetadataDeleted({ messageId, keys }) {
        updateMessageById(messageId, (m) => {
          const next = { ...m.metadata };
          keys.forEach((k) => delete next[k]);
          return { ...m, metadata: next };
        });
      },
      onMessageDeleted({ messages }) {
        const ids = new Set(messages.map((m) => m.messageId));
        chatStore.set((st) => {
          const channels = { ...st.channels };
          for (const [key, ch] of Object.entries(channels)) {
            if (ch.messages.some((m) => m.messageId && ids.has(m.messageId))) {
              channels[key] = { ...ch, messages: ch.messages.filter((m) => !m.messageId || !ids.has(m.messageId)) };
            }
          }
          return { ...st, channels };
        });
      },
      onStreamMessageRequestInit({ messageId }) {
        debug("stream init", messageId);
        updateMessageById(messageId, (m) => ({ ...m, streaming: true }));
      },
      onStreamMessageRequestDelta({ messageId, chunkInfo }) {
        debug("stream delta", messageId, chunkInfo);
        updateMessageById(messageId, (m) => {
          const full = chunkInfo.messageContent ?? (m.streamText ?? "") + (chunkInfo.content ?? "");
          return { ...m, streaming: true, streamText: full.length >= (m.streamText ?? "").length ? full : m.streamText };
        });
      },
      onStreamMessageRequestComplete({ messageId, code }) {
        debug("stream complete", messageId, code);
        updateMessageById(messageId, (m) => ({ ...m, streaming: false }));
      },
      onMessageReceiptResponse({ responses }) {
        chatStore.set((st) => {
          const receipts = { ...st.receipts };
          for (const r of responses) receipts[r.messageId] = { read: r.readCount, total: r.totalCount };
          return { ...st, receipts };
        });
      },
    }),
  );

  NCEngine.addChannelHandler(
    "agentverse",
    new s.ChannelHandler({
      onTypingStatusChanged({ channelIdentifier, userTypingStatus }) {
        const key = channelKeyOf(channelIdentifier.channelType, channelIdentifier.channelId);
        for (const t of userTypingStatus) setTyping(key, t.userId);
      },
    }),
  );
}

/* --------------------------------------------------------------------------------------------
 * Lifecycle
 * ------------------------------------------------------------------------------------------ */

interface TokenResponse {
  appKey: string;
  userId: string;
  token: string;
}

async function connectOnce(): Promise<void> {
  sdk ??= await import("@nexconn/chat");
  const s = sdk;
  chatStore.set((st) => ({ ...st, connection: "connecting" }));
  let cfg = await api<TokenResponse>("/api/nexconn/token");
  if (!initializedAppKey) {
    s.NCEngine.initialize({ appKey: cfg.appKey, areaCode: s.AreaCode.SG, logLevel: s.LogLevel.ERROR });
    initializedAppKey = cfg.appKey;
    await registerHandlers(s);
  }
  let res = await s.NCEngine.connect({ token: cfg.token });
  let refreshed = false;
  for (let attempt = 0; !res.isOk && attempt < 5; attempt++) {
    if (TOKEN_ERRORS.has(res.code) && !refreshed) {
      // Token refresh on connect failure.
      refreshed = true;
      cfg = await api<TokenResponse>("/api/nexconn/token?refresh=1");
    } else if (RETRYABLE_CONNECT.has(res.code)) {
      chatStore.set((st) => ({ ...st, connection: "connecting", connectionCode: res.code }));
      await sleep(Math.min(1500 * 2 ** attempt, 12000));
    } else {
      break;
    }
    res = await s.NCEngine.connect({ token: cfg.token });
  }
  if (!res.isOk) {
    chatStore.set((st) => ({ ...st, connection: res.code === KICKED ? "kicked" : "error", connectionCode: res.code }));
    if (res.code !== KICKED) scheduleAutoRetry();
    throw new Error(`Nexconn connect failed (${res.code})`);
  }
  wasConnected = true;
  chatStore.set((st) => ({ ...st, connection: "connected", connectionCode: null, me: res.data?.userId ?? cfg.userId }));
  await loadSummaries();
}

function scheduleAutoRetry() {
  if (autoRetryTimer || typeof window === "undefined") return;
  const retry = () => {
    if (autoRetryTimer) clearTimeout(autoRetryTimer);
    autoRetryTimer = null;
    window.removeEventListener("online", retry);
    if (chatStore.get().connection === "error") void retryConnect().catch(() => undefined);
  };
  autoRetryTimer = setTimeout(retry, 20000);
  window.addEventListener("online", retry, { once: true });
}

/** Starts the chat connection once per tab. Safe to call repeatedly. */
export function startChat(): Promise<void> {
  startPromise ??= connectOnce().catch((err) => {
    startPromise = null;
    throw err;
  });
  return startPromise;
}

export async function retryConnect(): Promise<void> {
  startPromise = null;
  return startChat();
}

export async function stopChat() {
  try {
    if (sdk && initializedAppKey) await sdk.NCEngine.disconnect();
  } finally {
    startPromise = null;
    wasConnected = false;
    queries.clear();
    chatStore.reset();
  }
}

async function resyncAfterReconnect() {
  await loadSummaries().catch(() => undefined);
  const active = chatStore.get().active;
  if (active) {
    queries.delete(active);
    await loadOlder(active, true).catch(() => undefined);
  }
}

export async function loadSummaries() {
  if (!sdk) return;
  const query = sdk.BaseChannel.createChannelsQuery({ pageSize: 100 });
  const res = await query.loadNextPage();
  if (!res.isOk || !res.data) return;
  const summaries: ChatState["summaries"] = {};
  for (const ch of res.data.data) {
    const key = channelKeyOf(ch.channelType, ch.channelId);
    const latest = ch.latestMessage ? toChatMessage(ch.latestMessage) : null;
    summaries[key] = {
      unread: key === chatStore.get().active ? 0 : ch.unreadCount,
      lastText: latest ? messagePreview(latest) : "",
      lastTime: latest?.sentTime ?? ch.operationTime ?? 0,
      lastSenderId: latest?.senderId ?? "",
    };
  }
  chatStore.set((st) => ({ ...st, summaries: { ...st.summaries, ...summaries }, summariesLoaded: true }));
}

/* --------------------------------------------------------------------------------------------
 * Channel operations
 * ------------------------------------------------------------------------------------------ */

export function setActiveChannel(key: string | null) {
  chatStore.set((s) => ({ ...s, active: key }));
  if (key) void markRead(key);
}

/** Loads the next (older) page of history. `fresh` restarts from the newest message. */
export async function loadOlder(channelKey: string, fresh = false) {
  try {
    await startChat();
  } catch {
    chatStore.set((s) => ({
      ...s,
      channels: {
        ...s.channels,
        [channelKey]: { ...(s.channels[channelKey] ?? emptyChannel), loading: false, error: "Couldn't connect to chat. We'll keep trying." },
      },
    }));
    return;
  }
  if (!sdk) return;
  const state = chatStore.get().channels[channelKey];
  if (!fresh && state?.loading) return;
  chatStore.set((s) => ({
    ...s,
    channels: { ...s.channels, [channelKey]: { ...(s.channels[channelKey] ?? emptyChannel), loading: true, error: null } },
  }));
  let query = fresh ? undefined : queries.get(channelKey);
  if (!query) {
    query = sdk.BaseChannel.createMessagesQuery({
      channelIdentifier: channelFor(channelKey).identifier,
      startTime: Date.now() + 5 * 60 * 1000,
      pageSize: 30,
      isAscending: false,
    });
    queries.set(channelKey, query);
  }
  const res = await query.loadNextPage();
  if (!res.isOk || !res.data) {
    chatStore.set((s) => ({
      ...s,
      channels: {
        ...s.channels,
        [channelKey]: { ...(s.channels[channelKey] ?? emptyChannel), loading: false, error: "Couldn't load messages. Check your connection and try again." },
      },
    }));
    return;
  }
  debug("history", res.data.data.map((m) => ({ type: m.messageType, id: m.messageId, content: m.content, metadata: mapToObject(m.metadata) })));
  const now = Date.now();
  const messages = res.data.data
    .filter((m) => !TRANSIENT_TYPES.has(m.messageType))
    .map((raw) => {
      const m = toChatMessage(raw);
      // A stream still open in history: fetch the rest if it is recent, otherwise show as is.
      if (m.type === MSG.STREAM && m.streaming) {
        if (now - m.sentTime < 3 * 60 * 1000) void raw.requestStreamMessage().catch(() => undefined);
        else m.streaming = false;
      }
      return m;
    });
  upsertMessages(channelKey, messages, { loading: false, loaded: true, hasMore: query.hasNext && messages.length > 0 });
  if (isViewing(channelKey)) void markRead(channelKey);
}

export async function markRead(channelKey: string) {
  if (!sdk) return;
  const summary = chatStore.get().summaries[channelKey];
  if (summary?.unread) {
    chatStore.set((s) => ({ ...s, summaries: { ...s.summaries, [channelKey]: { ...summary, unread: 0 } } }));
  }
  const channel = channelFor(channelKey);
  void channel.clearUnreadCount().catch(() => undefined);
  // Read receipts for messages that asked for one.
  const me = chatStore.get().me;
  const pending = (chatStore.get().channels[channelKey]?.messages ?? []).filter(
    (m) => m.messageId && m.needReceipt && !m.receiptSent && m.senderId !== me,
  );
  if (pending.length) {
    const ids = pending.map((m) => m.messageId!) ;
    const res = await channel.sendReadReceiptResponse(ids).catch(() => null);
    if (res?.isOk) {
      const set = new Set(ids);
      chatStore.set((s) => {
        const ch = s.channels[channelKey];
        if (!ch) return s;
        return {
          ...s,
          channels: { ...s.channels, [channelKey]: { ...ch, messages: ch.messages.map((m) => (m.messageId && set.has(m.messageId) ? { ...m, receiptSent: true } : m)) } },
        };
      });
    }
  }
}

export async function sendText(
  channelKey: string,
  text: string,
  mentionedIds: string[],
  onSent?: (m: ChatMessage) => Promise<void> | void,
  retryKey?: string,
) {
  const ready = await startChat().then(
    () => true,
    () => false,
  );
  if (!ready || !sdk) {
    const key = retryKey ?? `local-${Date.now()}-${++localSeq}`;
    pendingSends.set(key, { text, mentionedIds, onSent });
    upsertMessages(channelKey, [
      {
        key,
        messageId: null,
        channelKey,
        senderId: chatStore.get().me ?? "",
        type: MSG.TEXT,
        content: { text },
        sentTime: Date.now(),
        status: "failed",
        metadata: {},
        isPrivate: false,
        edited: false,
        mentionedIds,
        needReceipt: true,
        receiptSent: false,
      },
    ]);
    return;
  }
  const s = sdk;
  const me = chatStore.get().me ?? "";
  const key = retryKey ?? `local-${Date.now()}-${++localSeq}`;
  pendingSends.set(key, { text, mentionedIds, onSent });
  const isGroup = channelKey.startsWith("g:");
  const content: Record<string, unknown> = { text };
  if (isGroup && mentionedIds.length) content.mentionedInfo = { type: s.MentionedType.USERS, userIdList: mentionedIds };
  const optimistic: ChatMessage = {
    key,
    messageId: null,
    channelKey,
    senderId: me,
    type: MSG.TEXT,
    content,
    sentTime: Date.now(),
    status: "sending",
    metadata: {},
    isPrivate: false,
    edited: false,
    mentionedIds,
    needReceipt: true,
    receiptSent: false,
  };
  upsertMessages(channelKey, [optimistic]);
  const params = new s.SendTextMessageParams(
    isGroup && mentionedIds.length
      ? { text, mentionedInfo: { type: s.MentionedType.USERS, userIdList: mentionedIds } }
      : { text },
  );
  params.needReceipt = true;
  let res;
  try {
    res = await channelFor(channelKey).sendMessage(params);
  } catch {
    res = null;
  }
  if (!res?.isOk || !res.data) {
    chatStore.set((st) => {
      const ch = st.channels[channelKey] ?? emptyChannel;
      return {
        ...st,
        channels: {
          ...st.channels,
          [channelKey]: { ...ch, messages: ch.messages.map((m) => (m.key === key ? { ...m, status: "failed", errorCode: res?.code } : m)) },
        },
      };
    });
    return;
  }
  const sent = { ...toChatMessage(res.data), key };
  pendingSends.delete(key);
  chatStore.set((st) => {
    const ch = st.channels[channelKey] ?? emptyChannel;
    const exists = ch.messages.some((m) => m.messageId === sent.messageId && m.key !== key);
    const messages = exists ? ch.messages.filter((m) => m.key !== key) : ch.messages.map((m) => (m.key === key ? sent : m));
    return { ...st, channels: { ...st.channels, [channelKey]: { ...ch, messages: mergeMessages(messages, []) } } };
  });
  bumpSummary(sent, false);
  await onSent?.(sent);
}

export function retrySend(channelKey: string, key: string) {
  const pending = pendingSends.get(key);
  if (!pending) return;
  chatStore.set((st) => {
    const ch = st.channels[channelKey] ?? emptyChannel;
    return { ...st, channels: { ...st.channels, [channelKey]: { ...ch, messages: ch.messages.filter((m) => m.key !== key) } } };
  });
  void sendText(channelKey, pending.text, pending.mentionedIds, pending.onSent, key);
}

export function discardFailed(channelKey: string, key: string) {
  pendingSends.delete(key);
  chatStore.set((st) => {
    const ch = st.channels[channelKey] ?? emptyChannel;
    return { ...st, channels: { ...st.channels, [channelKey]: { ...ch, messages: ch.messages.filter((m) => m.key !== key) } } };
  });
}

/** Typing indicator: Nexconn typing status in direct channels, a transient custom message in groups. */
export function notifyTyping(channelKey: string) {
  if (!sdk || chatStore.get().connection !== "connected") return;
  const last = lastTypingSent.get(channelKey) ?? 0;
  if (Date.now() - last < 4000) return;
  lastTypingSent.set(channelKey, Date.now());
  const s = sdk;
  if (channelKey.startsWith("d:")) {
    void (channelFor(channelKey) as InstanceType<SDK["DirectChannel"]>).sendTypingStatus(MSG.TEXT).catch(() => undefined);
  } else if (channelKey.startsWith("g:")) {
    void channelFor(channelKey)
      .sendMessage(new s.SendMessageParams({ t: 1 }, MSG.TYPING))
      .catch(() => undefined);
  }
}
