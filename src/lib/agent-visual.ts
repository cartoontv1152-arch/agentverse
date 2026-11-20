import { Languages, ListChecks, ScrollText, Search, Vote, type LucideIcon } from "lucide-react";

/**
 * Visual identity for agents. Built-in agents have a fixed hue and icon (their handles are
 * reserved, so the handle is a safe key). Custom agents get a stable hue from their id.
 */

export type Hue = "cobalt" | "saffron" | "berry" | "jade" | "iris" | "teal";

export const HUES: Record<Hue, { bg: string; fg: string; soft: string; text: string }> = {
  cobalt: { bg: "#3554e0", fg: "#ffffff", soft: "#eaeefc", text: "#2a44c4" },
  saffron: { bg: "#e8a23a", fg: "#161a2c", soft: "#fcf3e4", text: "#8a5a0f" },
  berry: { bg: "#c8457a", fg: "#ffffff", soft: "#f9e9f0", text: "#a2335f" },
  jade: { bg: "#1e9e74", fg: "#ffffff", soft: "#e5f5ef", text: "#13724f" },
  iris: { bg: "#7d58d6", fg: "#ffffff", soft: "#f0ebfb", text: "#5f3fb8" },
  teal: { bg: "#0e8fa8", fg: "#ffffff", soft: "#e3f3f6", text: "#0a6b7e" },
};

const BUILTIN: Record<string, { hue: Hue; icon: LucideIcon }> = {
  researcher: { hue: "cobalt", icon: Search },
  planner: { hue: "saffron", icon: ListChecks },
  pollster: { hue: "berry", icon: Vote },
  summarizer: { hue: "jade", icon: ScrollText },
  translator: { hue: "iris", icon: Languages },
};

export const BUILTIN_AGENT_HANDLES = ["Researcher", "Planner", "Pollster", "Summarizer", "Translator"] as const;

const CUSTOM_HUES: Hue[] = ["teal", "iris", "berry", "jade", "saffron", "cobalt"];

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export interface AgentVisual {
  hue: Hue;
  colors: (typeof HUES)[Hue];
  icon: LucideIcon | null;
}

/** Hue and icon for an agent, from its handle (built-ins) or a stable seed (custom agents). */
export function agentVisual(handle?: string | null, seed?: string | null): AgentVisual {
  const builtin = handle ? BUILTIN[handle.toLowerCase()] : undefined;
  if (builtin) return { hue: builtin.hue, colors: HUES[builtin.hue], icon: builtin.icon };
  const hue = CUSTOM_HUES[hash(seed || handle || "agent") % CUSTOM_HUES.length];
  return { hue, colors: HUES[hue], icon: null };
}
