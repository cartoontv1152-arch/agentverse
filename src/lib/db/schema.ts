import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  integer,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
  date,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Clerk user id (user_...). Clerk owns sign-in; this row owns the app profile and Nexconn identity. */
    clerkId: text("clerk_id"),
    email: text("email").notNull(),
    name: text("name").notNull(),
    /** False until the person confirms their display name (Clerk sign-up may not collect one). */
    nameConfirmed: boolean("name_confirmed").notNull().default(true),
    /** Legacy password logins (before Clerk). Dropped by a later migration. */
    passwordHash: text("password_hash"),
    avatarUrl: text("avatar_url"),
    nexconnId: text("nexconn_id").notNull(),
    nexconnToken: text("nexconn_token"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(t.email),
    uniqueIndex("users_nexconn_idx").on(t.nexconnId),
    uniqueIndex("users_clerk_idx").on(t.clerkId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("sessions_token_idx").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

export type AgentTool = "search" | "tasks" | "polls" | "summarize" | "translate";

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Stable key for built-in agents (e.g. "researcher"); null for custom agents. */
    builtinKey: text("builtin_key"),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Mention handle without "@", e.g. "Researcher". */
    handle: text("handle").notNull(),
    tagline: text("tagline").notNull().default(""),
    instructions: text("instructions").notNull().default(""),
    tools: jsonb("tools").$type<AgentTool[]>().notNull().default([]),
    avatarUrl: text("avatar_url"),
    nexconnId: text("nexconn_id").notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("agents_builtin_idx").on(t.builtinKey),
    uniqueIndex("agents_nexconn_idx").on(t.nexconnId),
    index("agents_owner_idx").on(t.ownerId),
  ],
);

export type ReplyMode = "mention" | "auto";

export const spaces = pgTable(
  "spaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    nexconnGroupId: text("nexconn_group_id").notNull(),
    /** "mention": agents reply only when @mentioned. "auto": agents may answer open questions. */
    replyMode: text("reply_mode").$type<ReplyMode>().notNull().default("mention"),
    requireApproval: boolean("require_approval").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("spaces_group_idx").on(t.nexconnGroupId)],
);

export const spaceMembers = pgTable(
  "space_members",
  {
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<"owner" | "member">().notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.spaceId, t.userId] }), index("space_members_user_idx").on(t.userId)],
);

export const spaceAgents = pgTable(
  "space_agents",
  {
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    /** When false the agent stays in the space but does not respond. */
    enabled: boolean("enabled").notNull().default(true),
    addedBy: uuid("added_by").references(() => users.id, { onDelete: "set null" }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.spaceId, t.agentId] }), index("space_agents_agent_idx").on(t.agentId)],
);

export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    uses: integer("uses").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("invites_code_idx").on(t.code), index("invites_space_idx").on(t.spaceId)],
);

/**
 * Server-side mirror of chat messages used as agent context. Nexconn remains the source of truth
 * for delivery and history; clients report their own sends here (attributed to the session user).
 */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** "g:<groupId>" for spaces, "a:<agentNexconnId>:<userNexconnId>" for agent DMs. */
    channelKey: text("channel_key").notNull(),
    spaceId: uuid("space_id").references(() => spaces.id, { onDelete: "cascade" }),
    nexconnMessageId: text("nexconn_message_id").notNull(),
    senderUserId: uuid("sender_user_id").references(() => users.id, { onDelete: "set null" }),
    senderAgentId: uuid("sender_agent_id").references(() => agents.id, { onDelete: "set null" }),
    senderName: text("sender_name").notNull(),
    kind: text("kind").$type<"text" | "card" | "notice">().notNull().default("text"),
    text: text("text").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("messages_nexconn_idx").on(t.nexconnMessageId),
    index("messages_channel_sent_idx").on(t.channelKey, t.sentAt),
  ],
);

export type CardKind = "tasks" | "poll" | "action";
export type ActionStatus = "pending" | "approved" | "dismissed" | "failed";

export interface TaskProposal {
  type: "tasks";
  title: string;
  items: { text: string; assigneeName?: string | null; due?: string | null }[];
}
export interface PollProposal {
  type: "poll";
  question: string;
  options: string[];
  multi: boolean;
}
export interface MemoryProposal {
  type: "memory";
  entries: { kind: "fact" | "decision"; text: string }[];
}
export type ActionProposal = TaskProposal | PollProposal | MemoryProposal;

export const cards = pgTable(
  "cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").$type<CardKind>().notNull(),
    channelKey: text("channel_key").notNull(),
    spaceId: uuid("space_id").references(() => spaces.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    /** Nexconn message that renders this card (set after the message is sent). */
    nexconnMessageId: text("nexconn_message_id"),
    title: text("title").notNull(),
    /** For polls: { multi }. For actions: the proposal. */
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").$type<ActionStatus | "open" | "closed">().notNull().default("open"),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resultCardId: uuid("result_card_id"),
    requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),
    revision: integer("revision").notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [index("cards_channel_idx").on(t.channelKey), index("cards_message_idx").on(t.nexconnMessageId)],
);

export const taskItems = pgTable(
  "task_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    /** Short key used in Nexconn message metadata ("t" + key). */
    key: text("key").notNull(),
    position: integer("position").notNull(),
    text: text("text").notNull(),
    assigneeUserId: uuid("assignee_user_id").references(() => users.id, { onDelete: "set null" }),
    due: date("due"),
    done: boolean("done").notNull().default(false),
    doneBy: uuid("done_by").references(() => users.id, { onDelete: "set null" }),
    doneAt: timestamp("done_at", { withTimezone: true }),
  },
  (t) => [index("task_items_card_idx").on(t.cardId), uniqueIndex("task_items_card_key_idx").on(t.cardId, t.key)],
);

export const pollOptions = pgTable(
  "poll_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    position: integer("position").notNull(),
    text: text("text").notNull(),
  },
  (t) => [index("poll_options_card_idx").on(t.cardId), uniqueIndex("poll_options_card_key_idx").on(t.cardId, t.key)],
);

export const pollVotes = pgTable(
  "poll_votes",
  {
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    optionId: uuid("option_id")
      .notNull()
      .references(() => pollOptions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.optionId, t.userId] }), index("poll_votes_card_idx").on(t.cardId)],
);

export const memoryItems = pgTable(
  "memory_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"fact" | "decision">().notNull(),
    text: text("text").notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    sourceMessageId: text("source_message_id"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("memory_space_idx").on(t.spaceId)],
);

/** Every agent run, used for usage limits and the usage meter. */
export const aiRuns = pgTable(
  "ai_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    spaceId: uuid("space_id").references(() => spaces.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    status: text("status").$type<"running" | "ok" | "error">().notNull().default("running"),
    error: text("error"),
    latencyMs: integer("latency_ms"),
    createdAt: createdAt(),
  },
  (t) => [index("ai_runs_user_idx").on(t.userId, t.createdAt), index("ai_runs_space_idx").on(t.spaceId, t.createdAt)],
);

/** Fixed-window counters for auth and upload rate limiting. */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

export type User = typeof users.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type Space = typeof spaces.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type MemoryItem = typeof memoryItems.$inferSelect;
