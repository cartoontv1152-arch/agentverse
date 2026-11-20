"use client";

import Link from "next/link";
import { useState } from "react";
import { Hash, Plus, Sparkles, UserPlus } from "lucide-react";
import { useAppData } from "@/client/app-data";
import { useChat } from "@/client/chat/store";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { CreateSpaceDialog } from "@/components/spaces/create-space-dialog";

function timeAgo(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function HomePage() {
  const { me, spaces } = useAppData();
  const summaries = useChat((s) => s.summaries);
  const [creating, setCreating] = useState(false);
  const firstName = me.name.split(" ")[0];

  return (
    <>
      <PageHeader>
        <h1 className="text-base font-semibold">Home</h1>
      </PageHeader>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Hi {firstName}</h2>
          {spaces === null ? (
            <div className="mt-8 space-y-3" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-panel bg-ink/6" />
              ))}
            </div>
          ) : spaces.length === 0 ? (
            <section className="mt-6 rounded-panel border border-ink/12 bg-surface p-6 sm:p-8">
              <h3 className="text-xl font-semibold">Start with a space</h3>
              <p className="mt-2 max-w-xl text-ink/70">
                A space is a group chat for people and agents. Create one, invite friends or teammates with a link, and mention an agent
                when you want help: <span className="font-medium text-ink">@Researcher</span> looks things up,{" "}
                <span className="font-medium text-ink">@Planner</span> turns talk into a checklist, <span className="font-medium text-ink">@Pollster</span>{" "}
                runs a vote.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => setCreating(true)}>
                  <Plus aria-hidden className="size-4" /> Create a space
                </Button>
                <Link href="/app/agents" className="inline-flex h-9 items-center gap-2 rounded-control border border-ink/18 bg-surface px-3.5 text-sm font-medium hover:border-ink/35">
                  <Sparkles aria-hidden className="size-4" /> Meet the agents
                </Link>
              </div>
              <p className="mt-6 flex items-center gap-2 text-sm text-ink/55">
                <UserPlus aria-hidden className="size-4" /> Got an invite link? Open it to join that space.
              </p>
            </section>
          ) : (
            <section className="mt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink/60">Your spaces</h3>
                <Button size="sm" variant="ghost" onClick={() => setCreating(true)}>
                  <Plus aria-hidden className="size-4" /> New space
                </Button>
              </div>
              <ul className="mt-2 divide-y divide-ink/8 overflow-hidden rounded-panel border border-ink/12 bg-surface">
                {spaces.map((s) => {
                  const sum = summaries[`g:${s.nexconnGroupId}`];
                  return (
                    <li key={s.id}>
                      <Link href={`/app/s/${s.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-ink/3">
                        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-control bg-ink/6">
                          <Hash className="size-4 text-ink/60" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className={`truncate ${sum?.unread ? "font-semibold" : "font-medium"}`}>{s.name}</span>
                            <span className="ml-auto shrink-0 text-2xs text-ink/45">{sum ? timeAgo(sum.lastTime) : ""}</span>
                          </div>
                          <p className="truncate text-sm text-ink/55">{sum?.lastText || s.description || "No messages yet"}</p>
                        </div>
                        {sum?.unread ? (
                          <span className="min-w-5 rounded-full bg-accent px-1.5 text-center text-2xs font-semibold leading-5 text-paper">{sum.unread}</span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>
      <CreateSpaceDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
