"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Pencil, X } from "lucide-react";
import { api, ClientApiError, limitHint, useResource } from "@/client/api";
import { useAppData } from "@/client/app-data";
import type { ChatMessage } from "@/client/chat/store";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/shell/page-header";
import { ChatView } from "@/components/chat/chat-view";
import { messageText } from "@/components/chat/message-row";
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
          <h1 className="font-semibold">Agent</h1>
        </PageHeader>
        <p className="p-10 text-center text-sm text-ink/65">{error.status === 404 ? "This agent doesn't exist or isn't available to you." : error.message}</p>
      </>
    );
  }
  if (!agent) {
    return (
      <PageHeader>
        <div className="h-4 w-32 animate-pulse rounded bg-ink/8" />
      </PageHeader>
    );
  }

  const starters = agent.builtinKey ? STARTERS[agent.builtinKey] ?? [] : [];

  return (
    <>
      <PageHeader
        actions={
          agent.ownerId === me.id ? (
            <Link href={`/app/studio/${agent.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-control px-2.5 text-xs font-medium hover:bg-ink/6">
              <Pencil aria-hidden className="size-3.5" /> Edit in Studio
            </Link>
          ) : null
        }
      >
        <Avatar name={agent.name} src={agent.avatarUrl} kind="agent" size="sm" />
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold">{agent.name}</h1>
          <p className="truncate text-2xs text-ink/55">Private chat. Only you and {agent.name} see this.</p>
        </div>
      </PageHeader>
      <ChatView
        channelKey={`d:${agent.nexconnId}`}
        isDirect
        mentionables={[]}
        people={[{ id: me.id, name: me.name }]}
        placeholder={`Message ${agent.name}`}
        onSent={onSent}
        notice={
          notice ? (
            <div role="alert" className="mx-3 mb-1 flex items-start gap-2 rounded-control border border-signal/30 bg-signal/6 px-3 py-2 text-sm sm:mx-6">
              <span className="flex-1">{notice}</span>
              <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)}>
                <X className="size-4" />
              </button>
            </div>
          ) : null
        }
        empty={
          <div className="mx-auto max-w-md text-center">
            <Avatar name={agent.name} src={agent.avatarUrl} kind="agent" size="lg" className="mx-auto" />
            <h2 className="mt-3 text-lg font-semibold">{agent.name}</h2>
            <p className="mt-1 text-sm text-ink/65">{agent.tagline}</p>
            {starters.length ? (
              <div className="mt-5 flex flex-col gap-2">
                <p className="text-2xs text-ink/50">Try asking</p>
                {starters.map((s) => (
                  <p key={s} className="rounded-control border border-ink/12 bg-surface px-3 py-2 text-sm text-ink/80">
                    {s}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        }
      />
    </>
  );
}
