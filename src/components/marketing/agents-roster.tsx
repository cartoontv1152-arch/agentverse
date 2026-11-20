"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { agentVisual } from "@/lib/agent-visual";
import { useInView } from "./use-in-view";

export interface RosterAgent {
  key: string;
  handle: string;
  tagline: string;
  example: string;
}

/** The built-in agents as a member list. When it scrolls into view they join one by one. */
export function AgentsRoster({ agents, studioHref }: { agents: RosterAgent[]; studioHref: string }) {
  const { ref, inView } = useInView<HTMLOListElement>();
  return (
    <ol ref={ref} className="divide-y divide-ink/8 border-y border-ink/8">
      {agents.map((a, i) => {
        const visual = agentVisual(a.handle);
        return (
          <li
            key={a.key}
            className="reveal grid gap-x-8 gap-y-3 py-5 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,22rem)] lg:items-center"
            data-shown={inView}
            style={{ "--reveal-delay": `${i * 110}ms` } as React.CSSProperties}
          >
            <div className="flex items-center gap-3">
              <Avatar name={a.handle} handle={a.handle} kind="agent" size="md" />
              <div>
                <p className="font-display text-lg font-semibold leading-tight">@{a.handle}</p>
                <p className="text-2xs font-medium" style={{ color: visual.colors.text }}>
                  {inView ? "joined the space" : " "}
                </p>
              </div>
            </div>
            <p className="text-ink/70">{a.tagline}</p>
            <p className="justify-self-start rounded-panel rounded-bl-md border border-ink/8 bg-surface px-3 py-2 text-sm text-ink/80 sm:col-start-2 lg:col-start-auto">
              <span className="font-medium" style={{ color: visual.colors.text }}>
                @{a.handle}
              </span>{" "}
              {a.example}
            </p>
          </li>
        );
      })}
      <li
        className="reveal grid gap-x-8 gap-y-3 py-5 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,22rem)] lg:items-center"
        data-shown={inView}
        style={{ "--reveal-delay": `${agents.length * 110}ms` } as React.CSSProperties}
      >
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid size-9 place-items-center rounded-[26%] border-2 border-dashed border-ink/25 text-ink/50">
            <Plus className="size-4" />
          </span>
          <p className="font-display text-lg font-semibold leading-tight">Your own agent</p>
        </div>
        <p className="text-ink/70">Give it a name, avatar, persona and the tools it may use. Try it in a test console before it joins a space.</p>
        <Link href={studioHref} className="justify-self-start text-sm font-semibold text-accent underline-offset-4 hover:underline sm:col-start-2 lg:col-start-auto">
          Open the Agent Studio
        </Link>
      </li>
    </ol>
  );
}
