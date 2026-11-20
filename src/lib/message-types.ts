/**
 * Custom Nexconn message types used by AgentVerse. Shared by the server (Platform Chat API sends)
 * and the client (NCEngine.registerCustomMessages + rendering). Keep in sync on both sides.
 */
export const MSG = {
  TEXT: "RC:TxtMsg",
  STREAM: "RC:StreamMsg",
  TASKS: "AGV:Tasks",
  POLL: "AGV:Poll",
  ACTION: "AGV:Action",
  NOTICE: "AGV:Notice",
  /** Transient: agent working status (not stored, not counted). */
  AGENT_STATE: "AGV:AgentState",
  /** Transient: a person is typing in a group channel (Nexconn typing status covers direct channels). */
  TYPING: "AGV:Typing",
} as const;

export type ProposalPayload =
  | { type: "tasks"; title: string; items: { text: string; assigneeName?: string | null; due?: string | null }[] }
  | { type: "poll"; question: string; options: string[]; multi: boolean }
  | { type: "memory"; entries: { kind: "fact" | "decision"; text: string }[] };

export interface TasksCardContent {
  cardId: string;
  agentId: string | null;
  title: string;
  items: { key: string; text: string; assigneeId: string | null; assigneeName: string | null; due: string | null }[];
}

export interface PollCardContent {
  cardId: string;
  agentId: string | null;
  question: string;
  multi: boolean;
  options: { key: string; text: string }[];
}

export interface ActionCardContent {
  cardId: string;
  agentId: string;
  agentName: string;
  requestedByName: string | null;
  proposal: ProposalPayload;
  edited?: boolean;
}

export interface NoticeContent {
  level: "error" | "info";
  agentId?: string | null;
  text: string;
}

export type AgentStateName = "thinking" | "searching" | "writing" | "proposing" | "done" | "error";

export interface AgentStateContent {
  agentId: string;
  state: AgentStateName;
  detail?: string;
  /** Set when the status is only for some members (private replies). */
  privateTo?: string[];
  /** While writing: the RC:StreamMsg message id, so clients can pull the stream (requestStreamMessage). */
  streamMessageId?: string;
}

/** Nexconn stores the accumulated text of a stream message in this metadata key. */
export const STREAM_SUMMARY_KEY = "RC_Ext_StreamMsgSummary";

/** Live card state carried in Nexconn message metadata. */
export interface TaskItemState {
  /** done */
  d: 0 | 1;
  /** done by (display name) */
  by?: string | null;
  /** assignee user id / name */
  a?: string | null;
  an?: string | null;
  due?: string | null;
  /** card revision when written; newer wins */
  r: number;
}

export interface PollOptionState {
  /** vote count */
  n: number;
  /** voter Nexconn ids (capped) */
  v: string[];
  r: number;
}

export interface ActionState {
  s: "pending" | "approved" | "dismissed" | "failed";
  by?: string | null;
  at?: number;
  /** result card id */
  rc?: string | null;
  error?: string | null;
  r: number;
}

export const TASK_KEY_PREFIX = "t";
export const POLL_KEY_PREFIX = "o";
export const ACTION_STATE_KEY = "st";

export interface Source {
  title: string;
  url: string;
}

const SOURCES_HEADER = "**Sources**";

/** Appends cited sources to an agent reply as a Markdown footer (persisted with the message). */
export function formatSourcesFooter(cited: { n: number; source: Source }[]): string {
  if (cited.length === 0) return "";
  const lines = cited.map(({ n, source }) => `[${n}] [${source.title.replace(/[[\]]/g, "")}](${source.url})`);
  return `\n\n${SOURCES_HEADER}\n${lines.join("\n")}`;
}

/** Splits an agent reply into body text and the sources listed in its footer. */
export function splitSourcesFooter(text: string): { body: string; sources: { n: number; title: string; url: string }[] } {
  const index = text.lastIndexOf(`\n${SOURCES_HEADER}\n`);
  if (index < 0) return { body: text, sources: [] };
  const sources: { n: number; title: string; url: string }[] = [];
  for (const line of text.slice(index + SOURCES_HEADER.length + 2).split("\n")) {
    const m = line.trim().match(/^\[(\d+)\] \[(.+)\]\((https?:\/\/\S+)\)$/);
    if (m) sources.push({ n: Number(m[1]), title: m[2], url: m[3] });
  }
  if (sources.length === 0) return { body: text, sources: [] };
  return { body: text.slice(0, index).trimEnd(), sources };
}

export function parseStreamSummary(value: string | undefined): { complete: boolean; text: string } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { complete?: boolean; summary?: string };
    return typeof parsed.summary === "string" ? { complete: parsed.complete === true, text: parsed.summary } : null;
  } catch {
    return null;
  }
}
