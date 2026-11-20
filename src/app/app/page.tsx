"use client";

import Link from "next/link";
import { useState } from "react";
import { Hash, MessageSquare, Plus, Sparkles, UserPlus, Wand2 } from "lucide-react";
import { useAppData } from "@/client/app-data";
import { useChat } from "@/client/chat/store";
import { PageHeader, PageTitle } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { CreateSpaceDialog } from "@/components/spaces/create-space-dialog";
import { BUILTIN_AGENT_HANDLES } from "@/lib/agent-visual";

function timeAgo(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const steps = [
  { title: "Create a space", body: "A group chat for a trip, a team or a club. Five agents join it automatically." },
  { title: "Invite your people", body: "Share the invite link. People without an account sign up and land straight in the space." },
  { title: "Mention an agent", body: "Type @Planner, @Researcher or @Pollster. Their proposals wait for someone to approve." },
];

export default function HomePage() {
  const { me, spaces } = useAppData();
  const summaries = useChat((s) => s.summaries);
  const [creating, setCreating] = useState(false);
  const firstName = me.name.split(" ")[0];

  return (
    <>
      <PageHeader
        actions={
          spaces?.length ? (
            <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
              <Plus aria-hidden className="size-4" /> New space
            </Button>
          ) : null
        }
      >
        <PageTitle title="Home" />
      </PageHeader>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
          <h2 className="text-3xl font-semibold tracking-[-0.02em]" suppressHydrationWarning>
            {greeting()}, {firstName}
          </h2>

          {spaces === null ? (
            <div className="mt-8 space-y-3" aria-busy="true" aria-label="Loading your spaces">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-[4.5rem] rounded-panel" />
              ))}
            </div>
          ) : spaces.length === 0 ? (
            <section className="mt-8 overflow-hidden rounded-sheet border border-ink/8 bg-paper">
              <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12">
                <div>
                  <h3 className="text-2xl font-semibold tracking-[-0.01em]">Start with a space</h3>
                  <p className="mt-2 max-w-md text-ink/65">
                    A space is a group chat where people and agents work together. It takes a few seconds to set up.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <Button variant="primary" size="lg" onClick={() => setCreating(true)}>
                      <Plus aria-hidden className="size-4" /> Create a space
                    </Button>
                    <Link href="/app/agents" className="inline-flex h-11 items-center gap-2 rounded-control border border-ink/14 bg-surface px-5 text-[0.95rem] font-semibold transition-colors hover:border-ink/28">
                      <Sparkles aria-hidden className="size-4" /> Meet the agents
                    </Link>
                  </div>
                  <p className="mt-6 flex items-center gap-2 text-sm text-ink/55">
                    <UserPlus aria-hidden className="size-4" /> Got an invite link? Open it to join that space.
                  </p>
                </div>
                <ol className="flex flex-col gap-5">
                  {steps.map((s, i) => (
                    <li key={s.title} className="flex gap-4">
                      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-surface font-display text-sm font-semibold shadow-lift">
                        {i + 1}
                      </span>
                      <div>
                        <p className="font-semibold">{s.title}</p>
                        <p className="mt-0.5 text-sm text-ink/60">{s.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          ) : (
            <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
              <section aria-labelledby="spaces-heading">
                <h3 id="spaces-heading" className="text-sm font-semibold text-ink/55">
                  Your spaces
                </h3>
                <ul className="mt-3 flex flex-col gap-2">
                  {spaces.map((s) => {
                    const sum = summaries[`g:${s.nexconnGroupId}`];
                    return (
                      <li key={s.id}>
                        <Link
                          href={`/app/s/${s.id}`}
                          className="group flex items-center gap-3.5 rounded-panel border border-ink/8 bg-surface px-4 py-3.5 transition-[border-color,box-shadow] hover:border-ink/16 hover:shadow-lift"
                        >
                          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-control bg-paper text-ink/55 transition-colors group-hover:text-accent">
                            <Hash className="size-[1.1rem]" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className={`truncate font-display text-[1.02rem] ${sum?.unread ? "font-bold" : "font-semibold"}`}>{s.name}</span>
                              {s.role === "owner" ? <span className="shrink-0 text-2xs text-ink/40">Owner</span> : null}
                              <span className="ml-auto shrink-0 text-2xs text-ink/45">{sum ? timeAgo(sum.lastTime) : ""}</span>
                            </div>
                            <p className={`mt-0.5 truncate text-sm ${sum?.unread ? "text-ink/80" : "text-ink/50"}`}>{sum?.lastText || s.description || "No messages yet. Say hello."}</p>
                          </div>
                          {sum?.unread ? (
                            <span className="min-w-6 rounded-full bg-accent px-1.5 text-center text-2xs font-bold leading-6 text-white">{sum.unread}</span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
              <aside className="flex flex-col gap-8">
                <section aria-labelledby="agents-side-heading">
                  <h3 id="agents-side-heading" className="text-sm font-semibold text-ink/55">
                    Ask an agent privately
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {BUILTIN_AGENT_HANDLES.map((h) => (
                      <Link key={h} href="/app/agents" title={`@${h}`} className="rounded-[28%] transition-transform hover:-translate-y-0.5">
                        <Avatar name={h} handle={h} kind="agent" size="md" />
                        <span className="sr-only">@{h}</span>
                      </Link>
                    ))}
                  </div>
                  <Link href="/app/agents" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
                    <MessageSquare aria-hidden className="size-4" /> Open the agent gallery
                  </Link>
                </section>
                <section aria-labelledby="studio-side-heading" className="rounded-panel bg-paper p-4">
                  <h3 id="studio-side-heading" className="flex items-center gap-2 font-semibold">
                    <Wand2 aria-hidden className="size-4 text-accent" /> Build your own agent
                  </h3>
                  <p className="mt-1 text-sm text-ink/60">Give it a persona and tools, test it, then add it to any space.</p>
                  <Link href="/app/studio/new" className="mt-3 inline-flex text-sm font-semibold text-accent hover:underline">
                    Open the Studio
                  </Link>
                </section>
              </aside>
            </div>
          )}
        </div>
      </div>
      <CreateSpaceDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
