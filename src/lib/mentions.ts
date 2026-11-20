/** Pure helpers for deciding which agents a chat message addresses. */

export interface MentionCandidate {
  handle: string;
  nexconnId: string;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Agents addressed by a message, in the order they are mentioned. Uses Nexconn mentionedInfo ids
 * and "@Handle" text (case-insensitive). Max 3 agents per message.
 */
export function resolveMentionedAgents<A extends MentionCandidate>(text: string, mentionedIds: string[], candidates: A[]): A[] {
  const found: { agent: A; index: number }[] = [];
  for (const agent of candidates) {
    const match = new RegExp(`(^|[^\\w])@${escapeRegExp(agent.handle)}(?![\\w])`, "i").exec(text);
    const index = match ? match.index : mentionedIds.includes(agent.nexconnId) ? Number.MAX_SAFE_INTEGER - 1 : -1;
    if (index >= 0) found.push({ agent, index });
  }
  return found.sort((a, b) => a.index - b.index).slice(0, 3).map((f) => f.agent);
}

export function looksLikeOpenQuestion(text: string): boolean {
  const t = text.trim();
  return t.length >= 12 && /\?\s*$/.test(t) && !/@\w/.test(t);
}
