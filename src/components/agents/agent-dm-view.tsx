"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Lock, Pencil, X } from "lucide-react";
import { api, ClientApiError, limitHint, useResource } from "@/client/api";
import { useAppData } from "@/client/app-data";
import type { ChatMessage } from "@/client/chat/store";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader, PageTitle } from "@/components/shell/page-header";
import { ChatView } from "@/components/chat/chat-view";
import { messageText } from "@/components/chat/message-row";
import { agentVisual } from "@/lib/agent-visual";
import type { PublicAgentView } from "./types";

const STARTERS: Record<string, string[]> = {
  researcher: ["What is the history of the Lisbon tram network?", "What are people on Hacker News saying about local-first software?"],
  planner: ["Plan a weekend trip to Goa for four friends next month", "Make a checklist for launching a small newsletter"],
  pollster: ["Make a poll: pizza, sushi or tacos for Friday?"],
  summarizer: ["Summarise our conversation so far"],
  translator: ["Translate 'See you at the station at nine' into Portuguese"],
};

/** Private chat with an agent over a Nexconn direct channel; the agent replies server-side. */
export function AgentDmView({ agentId }: { agentId: string }) {
  const { data, error } = useResource<{ agent: PublicAgentView }>(`/api/agents/${agentId}`);
  const { me, addProfiles } = useAppData();
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ text: string; nonce: number } | null>(null);
  const agent = data?.agent;

  useEffect(() => {
    if (agent) addProfiles([{ kind: "agent", id: agent.id, nexconnId: agent.nexconnId, name: agent.name, avatarUrl: agent.avatarUrl, handle: agent.handle }]);
  }, [agent, addProfiles]);

  const onSent = useCallback(
    async (m: ChatMessage) => {
      try {
        await api(`/api/agents/${agentId}/dm`, { method: "POST", json: { messageId: m.messageId, text: messageText(m), mentionedIds: [], sentTime: m.sentTime } });
        setNotice(null);
      } catch (err) {
        setNotice(err instanceof ClientApiError ? `${err.message} ${limitHint(err) ?? ""}`.trim() : "The agent couldn't be reached.");
      }
    },
    [agentId],
  );

  if (error) {
    return (
      <>
        <PageHeader>
          <PageTitle title="Agent" />
        </PageHeader>
        <div className="mx-auto max-w-md px-6 py-16 text-center">
          <p className="font-display text-xl font-semibold">{error.status === 404 ? "This agent isn't available to you" : "This chat didn't load"}</p>
          <p className="mt-2 text-ink/60">{error.status === 404 ? "It may have been deleted, or it belongs to a space you're not in." : error.message}</p>
          <Link href="/app/agents" className="mt-5 inline-flex text-sm font-semibold text-accent hover:underline">
            Back to agents
          </Link>
        </div>
      </>
    );
  }
  if (!agent) {
    return (
      <PageHeader>
        <div className="skeleton size-7 rounded-[26%]" />
        <div className="skeleton h-4 w-32 rounded" />
      </PageHeader>
    );
  }

  const starters = agent.builtinKey ? STARTERS[agent.builtinKey] ?? [] : [];
  const visual = agentVisual(agent.handle, agent.nexconnId);

  return (
    <>
      <PageHeader
        actions={
          agent.ownerId === me.id ? (
            <Link href={`/app/studio/${agent.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-control px-2.5 text-xs font-semibold transition-colors hover:bg-ink/6">
              <Pencil aria-hidden className="size-3.5" /> Edit in Studio
            </Link>
          ) : null
        }
      >
        <Avatar name={agent.name} src={agent.avatarUrl} kind="agent" handle={agent.handle} seed={agent.nexconnId} size="sm" />
        <PageTitle
          title={agent.name}
          subtitle={
            <span className="inline-flex items-center gap-1">
              <Lock aria-hidden className="size-3" /> Private chat. Only you and {agent.name} see this.
            </span>
          }
        />
      </PageHeader>
      <ChatView
        channelKey={`d:${agent.nexconnId}`}
        isDirect
        mentionables={[]}
        people={[{ id: me.id, name: me.name }]}
        placeholder={`Message ${agent.name}`}
        onSent={onSent}
        draft={draft}
        notice={
          notice ? (
            <div role="alert" className="mx-3 mb-1.5 flex animate-rise items-start gap-2 rounded-control border border-signal/25 bg-[#fdf1f0] px-3 py-2 text-sm sm:mx-6">
              <span className="flex-1">{notice}</span>
              <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)} className="rounded text-ink/45 hover:text-ink">
                <X className="size-4" />
              </button>
            </div>
          ) : null
        }
        empty={
          <div className="mx-auto max-w-md text-center">
            <Avatar name={agent.name} src={agent.avatarUrl} kind="agent" handle={agent.handle} seed={agent.nexconnId} size="xl" className="mx-auto" />
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.01em]">{agent.name}</h2>
            <p className="mt-1 font-medium" style={{ color: visual.colors.text }}>
              @{agent.handle}
            </p>
            <p className="mt-2 text-ink/60">{agent.tagline}</p>
            {starters.length ? (
              <div className="mt-6 flex flex-col items-center gap-2">
                <p className="text-2xs font-semibold text-ink/45">Try asking</p>
                {starters.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setDraft({ text: s, nonce: Date.now() })}
                    className="rounded-full border border-ink/10 bg-surface px-4 py-2 text-sm text-ink/80 shadow-[0_1px_2px_rgb(22_26_44/0.04)] transition-[border-color,transform] hover:-translate-y-px hover:border-accent/40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        }
      />
    </>
  );
}
