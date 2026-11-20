"use client";

import Link from "next/link";
import { useState } from "react";
import { MessageSquare, Pencil, Plus, Check } from "lucide-react";
import { api, ClientApiError, useResource } from "@/client/api";
import { PageHeader } from "@/components/shell/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { TOOL_INFO, type PublicAgentView } from "@/components/agents/types";

interface Gallery {
  agents: (PublicAgentView & { spaceIds: string[] })[];
  spaces: { id: string; name: string; role: string }[];
}

function AddToSpace({ agent, spaces, onAdded }: { agent: Gallery["agents"][number]; spaces: Gallery["spaces"]; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const { push } = useToast();
  if (spaces.length === 0) return null;
  return (
    <div className="relative">
      <Button size="sm" variant="secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <Plus aria-hidden className="size-3.5" /> Add to space
      </Button>
      {open ? (
        <>
          <button type="button" aria-label="Close menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <ul role="menu" className="absolute left-0 top-full z-20 mt-1 w-60 overflow-hidden rounded-panel border border-ink/14 bg-surface py-1 shadow-[0_12px_32px_-16px_rgba(27,36,32,0.4)]">
            {spaces.map((s) => {
              const inSpace = agent.spaceIds.includes(s.id);
              return (
                <li key={s.id} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={inSpace || busy !== null}
                    onClick={async () => {
                      setBusy(s.id);
                      try {
                        await api(`/api/spaces/${s.id}/agents`, { method: "POST", json: { agentId: agent.id } });
                        push(`${agent.name} joined ${s.name}.`);
                        onAdded();
                        setOpen(false);
                      } catch (err) {
                        push(err instanceof ClientApiError ? err.message : "Couldn't add the agent.", "error");
                      } finally {
                        setBusy(null);
                      }
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-ink/5 disabled:cursor-default disabled:text-ink/45 disabled:hover:bg-transparent"
                  >
                    <span className="flex-1 truncate">{s.name}</span>
                    {inSpace ? <Check aria-hidden className="size-4 text-accent" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function AgentCard({ agent, spaces, onChanged }: { agent: Gallery["agents"][number]; spaces: Gallery["spaces"]; onChanged: () => void }) {
  return (
    <li className="flex flex-col rounded-panel border border-ink/12 bg-surface p-5" data-testid="agent-card">
      <div className="flex items-start gap-3">
        <Avatar name={agent.name} src={agent.avatarUrl} kind="agent" size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{agent.name}</h3>
          <p className="text-sm text-accent">@{agent.handle}</p>
        </div>
      </div>
      <p className="mt-3 flex-1 text-sm text-ink/70">{agent.tagline || "No description yet."}</p>
      {agent.tools.length ? (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Capabilities">
          {agent.tools.map((t) => (
            <li key={t} title={TOOL_INFO[t]?.description} className="rounded-chip border border-ink/12 px-1.5 py-0.5 text-2xs text-ink/70">
              {TOOL_INFO[t]?.label ?? t}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 text-2xs text-ink/50">
        {agent.spaceIds.length ? `In ${agent.spaceIds.length} of your spaces` : "Not in any of your spaces"}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/app/agent/${agent.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-control bg-ink px-2.5 text-xs font-medium text-paper hover:bg-ink/90">
          <MessageSquare aria-hidden className="size-3.5" /> Message
        </Link>
        <AddToSpace agent={agent} spaces={spaces} onAdded={onChanged} />
        {agent.kind === "custom" ? (
          <Link href={`/app/studio/${agent.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-control px-2.5 text-xs font-medium hover:bg-ink/6">
            <Pencil aria-hidden className="size-3.5" /> Edit
          </Link>
        ) : null}
      </div>
    </li>
  );
}

export default function AgentsPage() {
  const { data, error, loading, reload } = useResource<Gallery>("/api/agents");
  const builtins = data?.agents.filter((a) => a.kind === "builtin") ?? [];
  const mine = data?.agents.filter((a) => a.kind === "custom") ?? [];
  return (
    <>
      <PageHeader
        actions={
          <Link href="/app/studio/new" className="inline-flex h-8 items-center gap-1.5 rounded-control bg-accent px-3 text-xs font-medium text-paper hover:bg-accent/90">
            <Plus aria-hidden className="size-3.5" /> Build an agent
          </Link>
        }
      >
        <h1 className="text-base font-semibold">Agents and Studio</h1>
      </PageHeader>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
          {error ? <p className="text-signal">{error.message}</p> : null}
          <section aria-labelledby="builtin-heading">
            <h2 id="builtin-heading" className="text-xl font-semibold tracking-tight">
              Built-in agents
            </h2>
            <p className="mt-1 text-sm text-ink/60">Each one is a real member of the chat. Mention it in a space, or message it privately.</p>
            {loading && !data ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-56 animate-pulse rounded-panel bg-ink/6" />
                ))}
              </div>
            ) : (
              <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {builtins.map((a) => (
                  <AgentCard key={a.id} agent={a} spaces={data?.spaces ?? []} onChanged={() => void reload()} />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="mine-heading" className="mt-12">
            <h2 id="mine-heading" className="text-xl font-semibold tracking-tight">
              Your agents
            </h2>
            <p className="mt-1 text-sm text-ink/60">Give an agent a persona and choose what it may do. Test it in the Studio before adding it to a space.</p>
            {data && mine.length === 0 ? (
              <div className="mt-5 rounded-panel border border-dashed border-ink/20 p-8 text-center">
                <p className="font-medium">You haven&apos;t built an agent yet</p>
                <p className="mt-1 text-sm text-ink/60">For example a travel concierge for your trip group, or a release manager for your team.</p>
                <Link href="/app/studio/new" className="mt-4 inline-flex h-9 items-center gap-2 rounded-control bg-accent px-3.5 text-sm font-medium text-paper hover:bg-accent/90">
                  <Plus aria-hidden className="size-4" /> Build an agent
                </Link>
              </div>
            ) : (
              <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {mine.map((a) => (
                  <AgentCard key={a.id} agent={a} spaces={data?.spaces ?? []} onChanged={() => void reload()} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
