import "server-only";
import { and, desc, eq, gt } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export interface MirrorInput {
  channelKey: string;
  spaceId: string | null;
  nexconnMessageId: string;
  senderUserId?: string | null;
  senderAgentId?: string | null;
  senderName: string;
  kind: "text" | "card" | "notice";
  text: string;
  meta?: Record<string, unknown> | null;
  sentAt?: Date;
}

/** Records a message in the server-side mirror used for agent context. Idempotent per Nexconn id. */
export async function recordMirror(input: MirrorInput) {
  if (!input.nexconnMessageId) return;
  await getDb()
    .insert(schema.messages)
    .values({
      channelKey: input.channelKey,
      spaceId: input.spaceId,
      nexconnMessageId: input.nexconnMessageId,
      senderUserId: input.senderUserId ?? null,
      senderAgentId: input.senderAgentId ?? null,
      senderName: input.senderName,
      kind: input.kind,
      text: input.text.slice(0, 8000),
      meta: input.meta ?? null,
      sentAt: input.sentAt ?? new Date(),
    })
    .onConflictDoNothing({ target: schema.messages.nexconnMessageId });
}

export type MirrorMessage = typeof schema.messages.$inferSelect;

/** Most recent messages in a channel, oldest first. */
export async function recentMessages(channelKey: string, limit = 40): Promise<MirrorMessage[]> {
  const rows = await getDb()
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.channelKey, channelKey))
    .orderBy(desc(schema.messages.sentAt))
    .limit(limit);
  return rows.reverse();
}

export async function messagesSince(channelKey: string, since: Date, limit = 150): Promise<MirrorMessage[]> {
  const rows = await getDb()
    .select()
    .from(schema.messages)
    .where(and(eq(schema.messages.channelKey, channelKey), gt(schema.messages.sentAt, since)))
    .orderBy(desc(schema.messages.sentAt))
    .limit(limit);
  return rows.reverse();
}

export async function findMirrorMessage(nexconnMessageId: string): Promise<MirrorMessage | null> {
  const [row] = await getDb()
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.nexconnMessageId, nexconnMessageId))
    .limit(1);
  return row ?? null;
}
