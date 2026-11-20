import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Minimal, typed client for the Nexconn Platform Chat API (server REST).
 * Docs: https://docs.nexconn.ai/platform-chat-api/prepare-to-use-api/auth
 *
 * - Every request is signed: Signature = sha1(appSecret + nonce + timestamp).
 * - Primary/backup domain failover as recommended in the "Base URL" doc.
 * - The App Secret never leaves this module.
 */

export class NexconnError extends Error {
  constructor(
    public path: string,
    public code: number,
    message: string,
  ) {
    super(`Nexconn ${path} failed (${code}): ${message}`);
  }
}

let preferBackup = false;

function backupBase(primary: string): string {
  return primary.replace("://api.", "://api-b.");
}

function signHeaders(): Record<string, string> {
  const nonce = randomBytes(8).toString("hex").slice(0, 16);
  const timestamp = String(Date.now());
  const signature = createHash("sha1")
    .update(env.nexconnAppSecret + nonce + timestamp)
    .digest("hex");
  return {
    "App-Key": env.nexconnAppKey,
    Nonce: nonce,
    Timestamp: timestamp,
    Signature: signature,
    "Content-Type": "application/json",
    "X-Request-ID": randomBytes(16).toString("hex"),
  };
}

interface NexconnResponse<R> {
  code: number;
  result?: R;
  errorMessage?: string;
}

async function call<R = unknown>(path: string, body: unknown): Promise<R | undefined> {
  const primary = env.nexconnApiBase;
  const bases = preferBackup ? [backupBase(primary), primary] : [primary, backupBase(primary)];
  let lastError: unknown;
  for (const [index, base] of bases.entries()) {
    try {
      const res = await fetch(base + path, {
        method: "POST",
        headers: signHeaders(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as NexconnResponse<R>;
      if (data.code !== 0 && data.code !== 200) {
        throw new NexconnError(path, data.code, data.errorMessage ?? `HTTP ${res.status}`);
      }
      preferBackup = index === 1 ? !preferBackup : preferBackup;
      return data.result;
    } catch (err) {
      if (err instanceof NexconnError) throw err;
      lastError = err;
    }
  }
  throw new NexconnError(path, -1, lastError instanceof Error ? lastError.message : "network error");
}

/* ----------------------------------------------------------------------------------------------
 * Users
 * -------------------------------------------------------------------------------------------- */

/** Registers the user (if new) and issues an access token. */
export async function issueAccessToken(userId: string, name: string, avatarUrl?: string | null) {
  const result = await call<{ userId: string; accessToken: string }>("/v4/auth/access-token/issue", {
    userId,
    name: name.slice(0, 64),
    ...(avatarUrl ? { avatarUrl } : {}),
  });
  if (!result?.accessToken) throw new NexconnError("/v4/auth/access-token/issue", -2, "no token returned");
  return result.accessToken;
}

export async function updateUser(userId: string, name: string, avatarUrl?: string | null) {
  await call("/v4/user/update", { userId, name: name.slice(0, 64), ...(avatarUrl ? { avatarUrl } : {}) });
}

/* ----------------------------------------------------------------------------------------------
 * Group channels (spaces)
 * -------------------------------------------------------------------------------------------- */

export async function createGroup(channelId: string, name: string, owner: string, userIds: string[] = []) {
  await call("/v4/group-channel/create", {
    channelId,
    name: name.slice(0, 64),
    owner,
    userIds: userIds.slice(0, 30),
    permissions: { joinPerm: 1, memInvitePerm: 2 },
  });
}

export async function joinGroup(channelId: string, userIds: string[]) {
  if (userIds.length === 0) return;
  await call("/v4/group-channel/join", { channelId, userIds });
}

export async function leaveGroup(channelId: string, userIds: string[]) {
  if (userIds.length === 0) return;
  await call("/v4/group-channel/leave", { channelId, userIds });
}

export async function updateGroupName(channelId: string, name: string) {
  await call("/v4/group-channel/profile/update", { channelId, groupProfile: { name: name.slice(0, 64) } });
}

export async function dismissGroup(channelId: string) {
  await call("/v4/group-channel/dismiss", { channelId });
}

/* ----------------------------------------------------------------------------------------------
 * Messages
 * -------------------------------------------------------------------------------------------- */

export type ChannelTarget = { type: "group"; groupId: string } | { type: "direct"; userId: string };

export interface SendOptions {
  from: string;
  to: ChannelTarget;
  messageType: string;
  content: unknown;
  /** Persist in cloud history (default true). Transient status messages pass false. */
  persist?: boolean;
  mentionUserIds?: string[];
  metadata?: Record<string, string>;
  pushContent?: string;
  /** Group only: deliver to these members only (targeted message). */
  toUserIds?: string[];
}

/** Sends a message as `from` (an agent or the system) via the Platform Chat API. Returns the message id. */
export async function sendMessage(opts: SendOptions): Promise<string> {
  const persist = opts.persist ?? true;
  const content = typeof opts.content === "string" ? opts.content : JSON.stringify(opts.content);
  const common = {
    fromUserId: opts.from,
    messageType: opts.messageType,
    content,
    isEchoToSender: 1,
    shouldPersist: persist ? 1 : 0,
    ...(opts.pushContent ? { pushContent: opts.pushContent } : {}),
  };
  if (opts.to.type === "group") {
    const targeted = opts.toUserIds && opts.toUserIds.length > 0;
    const result = await call<{ messageIds: { channelId: string; messageId: string }[] }>(
      "/v4/group-channel/message/send",
      {
        ...common,
        toChannelIds: [opts.to.groupId],
        ...(targeted ? { toUserIds: opts.toUserIds } : {}),
        ...(opts.mentionUserIds?.length ? { hasMention: 1 } : {}),
        ...(!targeted && opts.metadata ? { hasMetadata: true, metadata: opts.metadata } : {}),
      },
    );
    return result?.messageIds?.[0]?.messageId ?? "";
  }
  const result = await call<{ messageIds: { userId: string; messageId: string }[] }>(
    "/v4/direct-channel/message/send",
    {
      ...common,
      toUserIds: [opts.to.userId],
      ...(opts.metadata ? { hasMetadata: true, metadata: opts.metadata } : {}),
    },
  );
  return result?.messageIds?.[0]?.messageId ?? "";
}

/** Replaces a sent message's content for everyone (24h window). */
export async function updateMessage(from: string, to: ChannelTarget, messageId: string, content: unknown) {
  const body = {
    fromUserId: from,
    messageId,
    content: typeof content === "string" ? content : JSON.stringify(content),
  };
  if (to.type === "group") {
    await call("/v4/group-channel/message/update", { ...body, channelId: to.groupId });
  } else {
    await call("/v4/direct-channel/message/update", { ...body, targetId: to.userId });
  }
}

/** Sets message metadata (KV) and echoes the change to the operator's clients. */
export async function setMessageMetadata(
  operatorUserId: string,
  to: ChannelTarget,
  messageId: string,
  metadata: Record<string, string>,
) {
  await call("/v4/channel-type/message/metadata/set", {
    messageId,
    userId: operatorUserId,
    channelType: to.type === "group" ? 3 : 1,
    channelId: to.type === "group" ? to.groupId : to.userId,
    metadata,
    isEchoToSender: 1,
  });
}

export interface StreamChunk {
  content: string;
  seq: number;
  complete: boolean;
  messageId?: string;
  type?: "text" | "markdown";
  extra?: Record<string, string>;
  mentionUserIds?: string[];
}

/** Sends one RC:StreamMsg chunk. The first chunk (no messageId) returns the new message id. */
export async function sendStreamChunk(
  from: string,
  to: ChannelTarget,
  chunk: StreamChunk,
  toUserIds?: string[],
): Promise<string | undefined> {
  const content: Record<string, unknown> = {
    content: chunk.content,
    seq: chunk.seq,
    complete: chunk.complete,
  };
  if (chunk.messageId) content.messageId = chunk.messageId;
  if (!chunk.messageId) {
    content.type = chunk.type ?? "markdown";
    if (chunk.extra) content.extra = chunk.extra;
    if (chunk.mentionUserIds?.length) content.mentionedInfo = { type: 2, userIdList: chunk.mentionUserIds };
  }
  const common = {
    fromUserId: from,
    messageType: "RC:StreamMsg",
    content,
    isEchoToSender: 1,
    shouldPersist: 1,
  };
  if (to.type === "group") {
    const result = await call<{ messageId?: string }>("/v4/group-channel/message/stream/send", {
      ...common,
      toChannelId: to.groupId,
      ...(toUserIds?.length ? { toUserIds } : {}),
    });
    return result?.messageId;
  }
  const result = await call<{ messageId?: string }>("/v4/direct-channel/message/stream/send", {
    ...common,
    toUserId: to.userId,
  });
  return result?.messageId;
}
