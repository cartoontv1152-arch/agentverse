export interface PublicAgentView {
  id: string;
  kind: "builtin" | "custom";
  builtinKey: string | null;
  ownerId: string | null;
  name: string;
  handle: string;
  tagline: string;
  instructions: string;
  tools: ("search" | "tasks" | "polls" | "summarize" | "translate")[];
  avatarUrl: string | null;
  nexconnId: string;
  spaceIds?: string[];
}

export const TOOL_INFO: Record<string, { label: string; description: string }> = {
  search: { label: "Web research", description: "Search Wikipedia and Hacker News, read web pages, cite sources." },
  tasks: { label: "Checklists", description: "Propose task checklists with assignees and due dates." },
  polls: { label: "Polls", description: "Propose polls with live vote counts." },
  summarize: { label: "Summaries", description: "Summarise what people missed and propose decisions for memory." },
  translate: { label: "Translation", description: "Translate messages into other languages." },
};
