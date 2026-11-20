"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpenCheck, Info, PanelRight, UserPlus, X } from "lucide-react";
import { api, ClientApiError, limitHint, useResource } from "@/client/api";
import { useAppData, type Profile } from "@/client/app-data";
import { chatStore, useChat, type ChatMessage } from "@/client/chat/store";
import { useToast } from "@/components/ui/toast";
import { Avatar } from "@/components/ui/avatar";
import { Button, IconButton } from "@/components/ui/button";
import { PageHeader, PageTitle } from "@/components/shell/page-header";
import { ChatView } from "@/components/chat/chat-view";
import { messageText } from "@/components/chat/message-row";
import type { Mentionable } from "@/components/chat/composer";
import { agentVisual } from "@/lib/agent-visual";
import { InviteDialog } from "./invite-dialog";
import { TranslateDialog } from "./translate-dialog";
import { SpacePanel, type PanelTab } from "./space-panel";
import type { SpaceDetail } from "./types";
import { useNow } from "@/client/use-now";
import { useMediaQuery } from "@/client/use-media-query";

/** The roster strip: agents as square tiles that light up in their own hue while they work. */
function AgentStrip({ detail, channelKey, onOpen }: { detail: SpaceDetail; channelKey: string; onOpen: () => void }) {
  const activity = useChat((s) => s.agents[channelKey]);
  const now = useNow(10000);
  if (detail.agents.length === 0) return null;
  return (
    <button type="button" onClick={onOpen} className="mr-1 hidden items-center gap-1.5 rounded-control px-2 py-1 transition-colors hover:bg-ink/5 md:flex" aria-label="Agents in this space">
      {detail.agents.slice(0, 6).map((a) => {
        const working = activity?.[a.nexconnId] && now - activity[a.nexconnId].at < 120000 && activity[a.nexconnId].state !== "error";
        const visual = agentVisual(a.handle, a.nexconnId);
        return (
          <span key={a.id} title={`@${a.handle}${a.enabled ? "" : " (paused)"}`} className={`relative transition-opacity ${a.enabled ? "" : "opacity-35 grayscale"}`}>
            <Avatar name={a.name} src={a.avatarUrl} kind="agent" handle={a.handle} seed={a.nexconnId} size="sm" />
            {working ? <span aria-hidden className="absolute -inset-[3px] animate-working rounded-[30%] border-2" style={{ borderColor: visual.colors.bg }} /> : null}
          </span>
        );
      })}
      {detail.agents.length > 6 ? <span className="ml-0.5 text-2xs font-semibold text-ink/50">+{detail.agents.length - 6}</span> : null}
    </button>
  );
}

export function SpaceView({ spaceId }: { spaceId: string }) {
  const { data: detail, error, reload } = useResource<SpaceDetail>(`/api/spaces/${spaceId}`);
  const { me, addProfiles } = useAppData();
  const { push } = useToast();
  const [panel, setPanel] = useState<PanelTab | null>(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 1280px)").matches ? "agents" : null,
  );
  const [inviting, setInviting] = useState(false);
  const [translating, setTranslating] = useState<ChatMessage | null>(null);
  const [notice, setNotice] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [catchup, setCatchup] = useState<{ unread: number; since: string } | null>(null);
  const [catchupBusy, setCatchupBusy] = useState(false);
  const [memoryVersion, setMemoryVersion] = useState(0);
  const [draft, setDraft] = useState<{ text: string; nonce: number } | null>(null);
  const initialUnread = useRef<number | null>(null);
  const wide = useMediaQuery("(min-width: 1280px)");

  const channelKey = detail ? `g:${detail.space.nexconnGroupId}` : null;

  useEffect(() => {
    if (!detail) return;
    const profiles: Profile[] = [
      ...detail.members.map((m) => ({ kind: "user" as const, id: m.id, nexconnId: m.nexconnId, name: m.name, avatarUrl: m.avatarUrl, handle: null })),
      ...detail.agents.map((a) => ({ kind: "agent" as const, id: a.id, nexconnId: a.nexconnId, name: a.name, avatarUrl: a.avatarUrl, handle: a.handle })),
    ];
    addProfiles(profiles);
  }, [detail, addProfiles]);

  // Capture unread count before the chat view marks the channel read, then record the visit.
  useEffect(() => {
    if (!channelKey || initialUnread.current !== null) return;
    initialUnread.current = chatStore.get().summaries[channelKey]?.unread ?? 0;
    const unread = initialUnread.current;
    api<{ previousReadAt: string }>(`/api/spaces/${spaceId}/read`, { method: "POST" })
      .then((d) => {
        if (unread >= 3) setCatchup({ unread, since: d.previousReadAt });
      })
      .catch(() => undefined);
  }, [channelKey, spaceId]);

  const mentionables: Mentionable[] = useMemo(() => {
    if (!detail) return [];
    return [
      ...detail.agents.map((a) => ({ nexconnId: a.nexconnId, label: a.handle, name: a.name, kind: "agent" as const, avatarUrl: a.avatarUrl, description: a.tagline, disabled: !a.enabled })),
      ...detail.members.filter((m) => m.id !== me.id).map((m) => ({ nexconnId: m.nexconnId, label: m.name, name: m.name, kind: "user" as const, avatarUrl: m.avatarUrl })),
    ];
  }, [detail, me.id]);

  const people = useMemo(() => (detail ? detail.members.map((m) => ({ id: m.id, name: m.name })) : []), [detail]);

  const onSent = useCallback(
    async (m: ChatMessage) => {
      try {
        const res = await api<{ triggered: { name: string }[]; paused: { name: string }[] }>(`/api/spaces/${spaceId}/messages`, {
          method: "POST",
          json: { messageId: m.messageId, text: messageText(m), mentionedIds: m.mentionedIds, sentTime: m.sentTime },
        });
        if (res.paused.length) {
          setNotice({ tone: "info", text: `${res.paused.map((p) => p.name).join(" and ")} ${res.paused.length === 1 ? "is" : "are"} paused in this space, so ${res.paused.length === 1 ? "it" : "they"} won't reply.` });
        } else setNotice(null);
      } catch (err) {
        if (err instanceof ClientApiError && err.status === 429) {
          setNotice({ tone: "error", text: `Agents didn't reply: ${err.message} ${limitHint(err) ?? ""}`.trim() });
        } else if (err instanceof ClientApiError) {
          setNotice({ tone: "error", text: `Your message was sent, but agents couldn't be reached: ${err.message}` });
        }
      }
    },
    [spaceId],
  );

  const onPin = useCallback(
    async (m: ChatMessage) => {
      try {
        const text = messageText(m).replace(/\n\n\*\*Sources\*\*[\s\S]*$/, "").slice(0, 400);
        await api(`/api/spaces/${spaceId}/memory`, { method: "POST", json: { kind: "fact", text, sourceMessageId: m.messageId } });
        setMemoryVersion((v) => v + 1);
        push("Pinned to space memory. Agents will use it as context.", "success");
      } catch (err) {
        push(err instanceof ClientApiError ? err.message : "Couldn't pin that message.", "error");
      }
    },
    [spaceId, push],
  );

  async function requestCatchup() {
    if (!catchup) return;
    setCatchupBusy(true);
    try {
      const res = await api<{ started: boolean }>(`/api/spaces/${spaceId}/catchup`, { method: "POST", json: { since: catchup.since } });
      push(res.started ? "The Summarizer is writing a private summary for you." : "Nothing new from others since your last visit.");
      setCatchup(null);
    } catch (err) {
      push(err instanceof ClientApiError ? err.message : "Couldn't start the summary.", "error", limitHint(err));
    } finally {
      setCatchupBusy(false);
    }
  }

  if (error) {
    return (
      <>
        <PageHeader>
          <PageTitle title="Space" />
        </PageHeader>
        <div className="mx-auto max-w-md px-6 py-16 text-center">
          <p className="font-display text-xl font-semibold">{error.status === 404 ? "This space doesn't exist, or you're not a member" : "This space didn't load"}</p>
          <p className="mt-2 text-ink/60">{error.status === 404 ? "Ask someone in the space for an invite link." : error.message}</p>
          {error.status !== 404 ? (
            <Button className="mt-5" onClick={() => void reload()}>
              Try again
            </Button>
          ) : null}
        </div>
      </>
    );
  }

  if (!detail || !channelKey) {
    return (
      <>
        <PageHeader>
          <div className="space-y-1.5">
            <div className="skeleton h-4 w-40 rounded" />
            <div className="skeleton h-3 w-24 rounded" />
          </div>
        </PageHeader>
        <div className="flex-1" aria-busy="true" />
      </>
    );
  }

  const togglePanel = (t: PanelTab) => setPanel((p) => (p === t ? null : t));
  const enabledAgents = detail.agents.filter((a) => a.enabled);
  const starters = [
    enabledAgents.find((a) => a.builtinKey === "researcher") && `@Researcher what should we know before we start?`,
    enabledAgents.find((a) => a.builtinKey === "planner") && `@Planner make a checklist for this week`,
    enabledAgents.find((a) => a.builtinKey === "pollster") && `@Pollster help us pick a day to meet`,
  ].filter((s): s is string => Boolean(s));

  const panelProps = {
    detail,
    tab: panel ?? ("people" as PanelTab),
    onTab: setPanel,
    onClose: () => setPanel(null),
    onInvite: () => setInviting(true),
    reload: () => void reload(),
    memoryVersion,
  };

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeader
          actions={
            <>
              <AgentStrip detail={detail} channelKey={channelKey} onOpen={() => togglePanel("agents")} />
              <span className="hidden sm:block">
                <Button size="sm" variant="secondary" onClick={() => setInviting(true)}>
                  <UserPlus aria-hidden className="size-4" /> Invite
                </Button>
              </span>
              <span className="sm:hidden">
                <IconButton label="Invite people" onClick={() => setInviting(true)}>
                  <UserPlus className="size-4" />
                </IconButton>
              </span>
              <IconButton
                label={panel ? "Hide details" : "Show details"}
                onClick={() => setPanel((p) => (p ? null : "people"))}
                aria-pressed={Boolean(panel)}
                className={panel ? "bg-ink/6 text-ink" : ""}
              >
                <PanelRight className="size-4" />
              </IconButton>
            </>
          }
        >
          <PageTitle
            title={detail.space.name}
            testId="space-title"
            subtitle={`${detail.members.length} ${detail.members.length === 1 ? "person" : "people"}, ${enabledAgents.length} ${enabledAgents.length === 1 ? "agent" : "agents"}${detail.space.description ? `. ${detail.space.description}` : ""}`}
          />
        </PageHeader>
        <ChatView
          channelKey={channelKey}
          isDirect={false}
          mentionables={mentionables}
          people={people}
          placeholder={`Message ${detail.space.name}`}
          onSent={onSent}
          onPin={onPin}
          onTranslate={(m) => setTranslating(m)}
          draft={draft}
          banner={
            catchup ? (
              <div className="mx-4 mb-2 mt-3 flex animate-rise flex-wrap items-center gap-3 rounded-panel border border-accent/20 bg-accent/[0.06] px-4 py-3 sm:mx-6">
                <BookOpenCheck aria-hidden className="size-5 text-accent" />
                <p className="min-w-0 flex-1 text-sm">
                  <span className="font-semibold">{catchup.unread} new messages</span> since you were last here.
                </p>
                <Button size="sm" variant="primary" loading={catchupBusy} onClick={requestCatchup}>
                  Catch me up
                </Button>
                <IconButton label="Dismiss" onClick={() => setCatchup(null)}>
                  <X className="size-4" />
                </IconButton>
              </div>
            ) : null
          }
          notice={
            notice ? (
              <div
                role={notice.tone === "error" ? "alert" : "status"}
                className={`mx-3 mb-1.5 flex animate-rise items-start gap-2.5 rounded-control px-3 py-2 text-sm sm:mx-6 ${notice.tone === "error" ? "border border-signal/25 bg-[#fdf1f0]" : "bg-paper text-ink/75"}`}
              >
                <Info aria-hidden className={`mt-0.5 size-4 shrink-0 ${notice.tone === "error" ? "text-signal" : "text-ink/45"}`} />
                <span className="flex-1">{notice.text}</span>
                <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)} className="rounded text-ink/45 hover:text-ink">
                  <X className="size-4" />
                </button>
              </div>
            ) : null
          }
          empty={
            <div className="mx-auto max-w-lg text-center">
              <div aria-hidden className="flex justify-center -space-x-2">
                {detail.members.slice(0, 3).map((m) => (
                  <Avatar key={m.id} name={m.name} src={m.avatarUrl} size="lg" className="ring-4 ring-surface" />
                ))}
                {enabledAgents.slice(0, 5).map((a) => (
                  <Avatar key={a.id} name={a.name} src={a.avatarUrl} kind="agent" handle={a.handle} seed={a.nexconnId} size="lg" className="ring-4 ring-surface" />
                ))}
              </div>
              <h2 className="mt-6 text-2xl font-semibold tracking-[-0.01em]">Start the conversation</h2>
              <p className="mt-2 text-ink/60">Say hello, invite your people, or ask an agent. Try one of these:</p>
              {starters.length ? (
                <ul className="mt-5 flex flex-col items-center gap-2">
                  {starters.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => setDraft({ text: s, nonce: Date.now() })}
                        className="rounded-full border border-ink/10 bg-surface px-4 py-2 text-sm text-ink/80 shadow-[0_1px_2px_rgb(22_26_44/0.04)] transition-[border-color,transform] hover:-translate-y-px hover:border-accent/40"
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <Button className="mt-6" size="sm" variant="ghost" onClick={() => setInviting(true)}>
                <UserPlus aria-hidden className="size-4" /> Invite people
              </Button>
            </div>
          }
        />
      </div>
      {panel && wide ? (
        <div className="w-[352px] shrink-0 animate-fade border-l border-ink/8">
          <SpacePanel {...panelProps} />
        </div>
      ) : null}
      {panel && !wide ? (
        <div className="fixed inset-0 z-30" role="dialog" aria-modal="true" aria-label="Space details">
          <button type="button" aria-label="Close details" className="absolute inset-0 animate-fade bg-ink/35" onClick={() => setPanel(null)} />
          <div className="absolute inset-y-0 right-0 w-[92%] max-w-[380px] animate-slide-in-right border-l border-ink/8 shadow-float">
            <SpacePanel {...panelProps} />
          </div>
        </div>
      ) : null}
      <InviteDialog spaceId={spaceId} spaceName={detail.space.name} open={inviting} onClose={() => setInviting(false)} />
      <TranslateDialog
        open={Boolean(translating)}
        onClose={() => setTranslating(null)}
        preview={translating ? messageText(translating).slice(0, 300) : ""}
        onTranslate={async (language) => {
          if (!translating) return;
          try {
            await api(`/api/spaces/${spaceId}/translate`, { method: "POST", json: { messageId: translating.messageId, language } });
            push(`Translating into ${language}. Only you will see it.`);
            setTranslating(null);
          } catch (err) {
            push(err instanceof ClientApiError ? err.message : "Couldn't translate.", "error", limitHint(err));
          }
        }}
      />
    </div>
  );
}
