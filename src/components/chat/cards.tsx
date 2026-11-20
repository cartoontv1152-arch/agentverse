"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, ListChecks, Pencil, Plus, Trash2, Vote, X, BookmarkPlus, CircleSlash } from "lucide-react";
import { api, ClientApiError } from "@/client/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import type { ChatMessage } from "@/client/chat/store";
import {
  ACTION_STATE_KEY,
  POLL_KEY_PREFIX,
  TASK_KEY_PREFIX,
  type ActionCardContent,
  type ActionState,
  type PollCardContent,
  type PollOptionState,
  type ProposalPayload,
  type TaskItemState,
  type TasksCardContent,
} from "@/lib/message-types";

export interface CardPerson {
  id: string;
  name: string;
}

function parse<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function useCardState<T>(cardId: string | undefined) {
  const [state, setState] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!cardId) return;
    let cancelled = false;
    api<{ card: T }>(`/api/cards/${cardId}`)
      .then((d) => !cancelled && setState(d.card))
      .catch((err) => !cancelled && setError(err instanceof ClientApiError ? err.message : "Couldn't load this card."));
    return () => {
      cancelled = true;
    };
  }, [cardId]);
  return { state, error };
}

const cardFrame = "mt-1.5 max-w-xl overflow-hidden rounded-panel border border-ink/14 bg-surface";

/* ---------------------------------------------------------------------------------------------
 * Checklist
 * ------------------------------------------------------------------------------------------- */

interface TasksState {
  kind: "tasks";
  revision: number;
  items: { id: string; key: string; text: string; done: boolean; doneByName: string | null; assigneeId: string | null; assigneeName: string | null; due: string | null }[];
}

function formatDue(due: string): string {
  const d = new Date(`${due}T00:00:00`);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function TasksCard({ message, people }: { message: ChatMessage; people: CardPerson[] }) {
  const content = message.content as unknown as TasksCardContent;
  const { state, error } = useCardState<TasksState>(content.cardId);
  const [local, setLocal] = useState<Record<string, TaskItemState>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const { push } = useToast();

  const items = useMemo(() => {
    return content.items.map((base) => {
      const fetched = state?.items.find((i) => i.key === base.key);
      let best: TaskItemState = fetched
        ? { d: fetched.done ? 1 : 0, by: fetched.doneByName, a: fetched.assigneeId, an: fetched.assigneeName, due: fetched.due, r: state!.revision }
        : { d: 0, a: base.assigneeId, an: base.assigneeName, due: base.due, r: 0 };
      for (const candidate of [parse<TaskItemState>(message.metadata[TASK_KEY_PREFIX + base.key]), local[base.key]]) {
        if (candidate && candidate.r >= best.r) best = candidate;
      }
      return { key: base.key, id: fetched?.id ?? null, text: base.text, ...best };
    });
  }, [content.items, state, message.metadata, local]);

  const doneCount = items.filter((i) => i.d === 1).length;

  async function patch(item: (typeof items)[number], body: Record<string, unknown>, optimistic: Partial<TaskItemState>) {
    if (!item.id) return;
    setBusy(item.key);
    setLocal((l) => ({ ...l, [item.key]: { ...item, ...optimistic, r: item.r + 0.5 } as TaskItemState }));
    try {
      const res = await api<{ state: TaskItemState }>(`/api/cards/${content.cardId}/items/${item.id}`, { method: "PATCH", json: body });
      setLocal((l) => ({ ...l, [item.key]: res.state }));
    } catch (err) {
      setLocal((l) => {
        const next = { ...l };
        delete next[item.key];
        return next;
      });
      push(err instanceof ClientApiError ? err.message : "Couldn't update the checklist.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={cardFrame} data-testid="tasks-card">
      <div className="flex items-center gap-2 border-b border-ink/10 px-4 py-3">
        <ListChecks aria-hidden className="size-4 text-accent" />
        <h3 className="min-w-0 flex-1 truncate font-semibold">{content.title}</h3>
        <span className="text-xs text-ink/55" aria-live="polite">
          {doneCount} of {items.length} done
        </span>
      </div>
      <div aria-hidden className="h-0.5 bg-ink/6">
        <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${items.length ? (doneCount / items.length) * 100 : 0}%` }} />
      </div>
      {error ? <p className="px-4 py-2 text-sm text-signal">{error}</p> : null}
      <ul className="divide-y divide-ink/8">
        {items.map((item) => (
          <li key={item.key} className="flex items-start gap-3 px-4 py-2.5">
            <button
              type="button"
              role="checkbox"
              aria-checked={item.d === 1}
              aria-label={`${item.d === 1 ? "Mark not done" : "Mark done"}: ${item.text}`}
              disabled={!item.id || busy === item.key}
              onClick={() => patch(item, { done: item.d !== 1 }, { d: item.d === 1 ? 0 : 1 })}
              className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-[5px] border transition-colors ${
                item.d === 1 ? "border-accent bg-accent text-paper" : "border-ink/30 bg-surface hover:border-accent"
              } disabled:opacity-60`}
            >
              {item.d === 1 ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : null}
            </button>
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${item.d === 1 ? "text-ink/50 line-through decoration-ink/35" : "text-ink"}`}>{item.text}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-ink/55">
                <label className="inline-flex items-center gap-1">
                  <span className="sr-only">Assignee for {item.text}</span>
                  <select
                    value={item.a ?? ""}
                    disabled={!item.id}
                    onChange={(e) => {
                      const id = e.target.value || null;
                      const name = people.find((p) => p.id === id)?.name ?? null;
                      void patch(item, { assigneeUserId: id }, { a: id, an: name });
                    }}
                    className="max-w-36 truncate rounded-chip border border-transparent bg-transparent py-0.5 text-2xs text-ink/70 hover:border-ink/15 focus:border-accent"
                  >
                    <option value="">Unassigned</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                    {item.a && !people.some((p) => p.id === item.a) ? <option value={item.a}>{item.an ?? "Assigned"}</option> : null}
                  </select>
                </label>
                <label className="inline-flex items-center gap-1">
                  <span>{item.due ? `Due ${formatDue(item.due)}` : "No due date"}</span>
                  <input
                    type="date"
                    aria-label={`Due date for ${item.text}`}
                    value={item.due ?? ""}
                    disabled={!item.id}
                    onChange={(e) => void patch(item, { due: e.target.value || null }, { due: e.target.value || null })}
                    className="w-6 cursor-pointer rounded-chip bg-transparent text-transparent [color-scheme:light] focus:w-auto focus:text-ink"
                  />
                </label>
                {item.d === 1 && item.by ? <span>Done by {item.by}</span> : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------
 * Poll
 * ------------------------------------------------------------------------------------------- */

interface PollState {
  kind: "poll";
  revision: number;
  multi: boolean;
  options: { id: string; key: string; text: string; count: number; voters: { nexconnId: string; name: string }[] }[];
}

export function PollCard({ message, me, nameOf }: { message: ChatMessage; me: string; nameOf: (nexconnId: string) => string | null }) {
  const content = message.content as unknown as PollCardContent;
  const { state } = useCardState<PollState>(content.cardId);
  const [local, setLocal] = useState<Record<string, PollOptionState>>({});
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  const options = useMemo(
    () =>
      content.options.map((base) => {
        const fetched = state?.options.find((o) => o.key === base.key);
        let best: PollOptionState = fetched ? { n: fetched.count, v: fetched.voters.map((v) => v.nexconnId), r: state!.revision } : { n: 0, v: [], r: 0 };
        for (const candidate of [parse<PollOptionState>(message.metadata[POLL_KEY_PREFIX + base.key]), local[base.key]]) {
          if (candidate && candidate.r >= best.r) best = candidate;
        }
        return { key: base.key, id: fetched?.id ?? null, text: base.text, ...best };
      }),
    [content.options, state, message.metadata, local],
  );
  const total = options.reduce((n, o) => n + o.n, 0);
  const voters = new Set(options.flatMap((o) => o.v));

  async function vote(option: (typeof options)[number]) {
    if (!option.id || busy) return;
    setBusy(true);
    try {
      const res = await api<{ metadata: Record<string, string> }>(`/api/cards/${content.cardId}/vote`, { method: "POST", json: { optionId: option.id } });
      const next: Record<string, PollOptionState> = {};
      for (const [k, v] of Object.entries(res.metadata)) {
        const parsed = parse<PollOptionState>(v);
        if (parsed) next[k.slice(POLL_KEY_PREFIX.length)] = parsed;
      }
      setLocal((l) => ({ ...l, ...next }));
    } catch (err) {
      push(err instanceof ClientApiError ? err.message : "Couldn't record your vote.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cardFrame} data-testid="poll-card">
      <div className="flex items-start gap-2 border-b border-ink/10 px-4 py-3">
        <Vote aria-hidden className="mt-0.5 size-4 text-accent" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{content.question}</h3>
          <p className="text-2xs text-ink/55" aria-live="polite">
            {voters.size} {voters.size === 1 ? "person" : "people"} voted{content.multi ? ", pick any" : ", pick one"}
          </p>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5 p-3">
        {options.map((o) => {
          const mine = o.v.includes(me);
          const pct = total ? Math.round((o.n / total) * 100) : 0;
          const names = o.v.map(nameOf).filter(Boolean).slice(0, 4).join(", ");
          return (
            <li key={o.key}>
              <button
                type="button"
                aria-pressed={mine}
                disabled={!o.id || busy}
                onClick={() => vote(o)}
                className={`relative flex w-full items-center gap-3 overflow-hidden rounded-control border px-3 py-2 text-left text-sm transition-colors disabled:cursor-wait ${
                  mine ? "border-accent" : "border-ink/14 hover:border-ink/35"
                }`}
              >
                <span aria-hidden className={`absolute inset-y-0 left-0 ${mine ? "bg-accent/14" : "bg-ink/6"} transition-[width] duration-300`} style={{ width: `${pct}%` }} />
                <span className={`relative grid size-4 shrink-0 place-items-center border ${content.multi ? "rounded-[4px]" : "rounded-full"} ${mine ? "border-accent bg-accent text-paper" : "border-ink/35"}`}>
                  {mine ? <Check aria-hidden className="size-3" strokeWidth={3} /> : null}
                </span>
                <span className="relative min-w-0 flex-1">
                  <span className="block truncate font-medium">{o.text}</span>
                  {names ? <span className="block truncate text-2xs text-ink/55">{names}</span> : null}
                </span>
                <span className="relative shrink-0 tabular-nums text-ink/70">
                  {o.n} <span className="ml-1 text-ink/40">{pct}%</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------
 * Action proposal
 * ------------------------------------------------------------------------------------------- */

interface ActionFetched {
  kind: "action";
  status: ActionState["s"];
  resolvedByName: string | null;
  revision: number;
}

function ProposalPreview({ proposal }: { proposal: ProposalPayload }) {
  if (proposal.type === "tasks") {
    return (
      <div>
        <p className="font-semibold">{proposal.title}</p>
        <ul className="mt-1.5 flex flex-col gap-1 text-sm">
          {proposal.items.map((i, idx) => (
            <li key={idx} className="flex gap-2">
              <span aria-hidden className="mt-1.5 size-3 shrink-0 rounded-[3px] border border-ink/30" />
              <span>
                {i.text}
                {i.assigneeName || i.due ? (
                  <span className="text-ink/50">
                    {" "}
                    ({[i.assigneeName, i.due ? `due ${i.due}` : null].filter(Boolean).join(", ")})
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (proposal.type === "poll") {
    return (
      <div>
        <p className="font-semibold">{proposal.question}</p>
        <ul className="mt-1.5 flex flex-col gap-1 text-sm">
          {proposal.options.map((o, idx) => (
            <li key={idx} className="flex gap-2">
              <span aria-hidden className={`mt-1.5 size-3 shrink-0 border border-ink/30 ${proposal.multi ? "rounded-[3px]" : "rounded-full"}`} />
              {o}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {proposal.entries.map((e, idx) => (
        <li key={idx}>
          <span className="mr-1.5 rounded-chip bg-ink/8 px-1.5 py-0.5 text-2xs font-medium">{e.kind === "decision" ? "Decision" : "Fact"}</span>
          {e.text}
        </li>
      ))}
    </ul>
  );
}

function ProposalEditor({ initial, onCancel, onSave }: { initial: ProposalPayload; onCancel: () => void; onSave: (p: ProposalPayload) => Promise<void> }) {
  const [draft, setDraft] = useState<ProposalPayload>(initial);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    await onSave(draft).finally(() => setSaving(false));
  };
  return (
    <div className="flex flex-col gap-3">
      {draft.type === "tasks" ? (
        <>
          <Input aria-label="Checklist title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          {draft.items.map((item, idx) => (
            <div key={idx} className="flex flex-wrap items-center gap-2">
              <Input
                aria-label={`Item ${idx + 1}`}
                className="min-w-48 flex-1"
                value={item.text}
                onChange={(e) => setDraft({ ...draft, items: draft.items.map((x, i) => (i === idx ? { ...x, text: e.target.value } : x)) })}
              />
              <Input
                aria-label={`Assignee for item ${idx + 1}`}
                placeholder="Assignee"
                className="w-32"
                value={item.assigneeName ?? ""}
                onChange={(e) => setDraft({ ...draft, items: draft.items.map((x, i) => (i === idx ? { ...x, assigneeName: e.target.value || null } : x)) })}
              />
              <input
                type="date"
                aria-label={`Due date for item ${idx + 1}`}
                className="h-10 rounded-control border border-ink/18 bg-surface px-2 text-sm"
                value={item.due ?? ""}
                onChange={(e) => setDraft({ ...draft, items: draft.items.map((x, i) => (i === idx ? { ...x, due: e.target.value || null } : x)) })}
              />
              <button type="button" aria-label={`Remove item ${idx + 1}`} className="p-1 text-ink/50 hover:text-signal" onClick={() => setDraft({ ...draft, items: draft.items.filter((_, i) => i !== idx) })}>
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <Button size="sm" variant="ghost" className="self-start" disabled={draft.items.length >= 20} onClick={() => setDraft({ ...draft, items: [...draft.items, { text: "", assigneeName: null, due: null }] })}>
            <Plus aria-hidden className="size-4" /> Add item
          </Button>
        </>
      ) : draft.type === "poll" ? (
        <>
          <Input aria-label="Poll question" value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} />
          {draft.options.map((o, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input aria-label={`Option ${idx + 1}`} value={o} onChange={(e) => setDraft({ ...draft, options: draft.options.map((x, i) => (i === idx ? e.target.value : x)) })} />
              <button type="button" aria-label={`Remove option ${idx + 1}`} disabled={draft.options.length <= 2} className="p-1 text-ink/50 hover:text-signal disabled:opacity-30" onClick={() => setDraft({ ...draft, options: draft.options.filter((_, i) => i !== idx) })}>
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <Button size="sm" variant="ghost" disabled={draft.options.length >= 8} onClick={() => setDraft({ ...draft, options: [...draft.options, ""] })}>
              <Plus aria-hidden className="size-4" /> Add option
            </Button>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.multi} onChange={(e) => setDraft({ ...draft, multi: e.target.checked })} className="accent-[var(--accent)]" />
              Allow several choices
            </label>
          </div>
        </>
      ) : (
        <>
          {draft.entries.map((entry, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <select
                aria-label={`Type of entry ${idx + 1}`}
                value={entry.kind}
                onChange={(e) => setDraft({ ...draft, entries: draft.entries.map((x, i) => (i === idx ? { ...x, kind: e.target.value as "fact" | "decision" } : x)) })}
                className="h-10 rounded-control border border-ink/18 bg-surface px-2 text-sm"
              >
                <option value="decision">Decision</option>
                <option value="fact">Fact</option>
              </select>
              <Input aria-label={`Entry ${idx + 1}`} value={entry.text} onChange={(e) => setDraft({ ...draft, entries: draft.entries.map((x, i) => (i === idx ? { ...x, text: e.target.value } : x)) })} />
              <button type="button" aria-label={`Remove entry ${idx + 1}`} disabled={draft.entries.length <= 1} className="p-1 text-ink/50 hover:text-signal disabled:opacity-30" onClick={() => setDraft({ ...draft, entries: draft.entries.filter((_, i) => i !== idx) })}>
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </>
      )}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" loading={saving} onClick={save}>
          Save changes
        </Button>
      </div>
    </div>
  );
}

const ACTION_TITLES: Record<ProposalPayload["type"], { verb: string; icon: typeof ListChecks }> = {
  tasks: { verb: "Create this checklist?", icon: ListChecks },
  poll: { verb: "Start this poll?", icon: Vote },
  memory: { verb: "Save to space memory?", icon: BookmarkPlus },
};

export function ActionCard({ message }: { message: ChatMessage }) {
  const content = message.content as unknown as ActionCardContent;
  const { state } = useCardState<ActionFetched>(content.cardId);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"approve" | "dismiss" | null>(null);
  const [localStatus, setLocalStatus] = useState<ActionState | null>(null);
  const { push } = useToast();

  let status: ActionState = state ? { s: state.status, by: state.resolvedByName, r: state.revision } : { s: "pending", r: 0 };
  for (const candidate of [parse<ActionState>(message.metadata[ACTION_STATE_KEY]), localStatus]) {
    if (candidate && candidate.r >= status.r && !(candidate.s === "pending" && status.s !== "pending")) status = candidate;
  }
  const meta = ACTION_TITLES[content.proposal.type];
  const Icon = meta.icon;

  async function decide(decision: "approve" | "dismiss") {
    setBusy(decision);
    try {
      await api(`/api/cards/${content.cardId}/action`, { method: "POST", json: { decision } });
      setLocalStatus({ s: decision === "approve" ? "approved" : "dismissed", by: "you", r: (status.r ?? 0) + 1 });
    } catch (err) {
      push(err instanceof ClientApiError ? err.message : "Couldn't update the proposal.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function saveEdit(proposal: ProposalPayload) {
    try {
      await api(`/api/cards/${content.cardId}/action`, { method: "PATCH", json: proposal });
      setEditing(false);
    } catch (err) {
      push(err instanceof ClientApiError ? err.message : "Couldn't save your edits.", "error");
    }
  }

  const resolved = status.s !== "pending";
  return (
    <div className={`${cardFrame} ${resolved ? "" : "border-accent/45"}`} data-testid="action-card" data-status={status.s}>
      <div className="flex items-center gap-2 border-b border-ink/10 px-4 py-2.5">
        <Icon aria-hidden className="size-4 text-accent" />
        <h3 className="flex-1 text-sm font-semibold">{meta.verb}</h3>
        {content.edited ? <span className="text-2xs text-ink/45">Edited</span> : null}
      </div>
      <div className="px-4 py-3">
        {editing ? (
          <ProposalEditor initial={content.proposal} onCancel={() => setEditing(false)} onSave={saveEdit} />
        ) : (
          <ProposalPreview proposal={content.proposal} />
        )}
      </div>
      {!editing ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 bg-paper/60 px-4 py-2.5">
          {status.s === "pending" ? (
            <>
              <Button size="sm" variant="primary" loading={busy === "approve"} disabled={busy !== null} onClick={() => decide("approve")}>
                <Check aria-hidden className="size-4" /> Approve
              </Button>
              <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => setEditing(true)}>
                <Pencil aria-hidden className="size-3.5" /> Edit
              </Button>
              <Button size="sm" variant="ghost" loading={busy === "dismiss"} disabled={busy !== null} onClick={() => decide("dismiss")}>
                <X aria-hidden className="size-4" /> Dismiss
              </Button>
              <span className="ml-auto text-2xs text-ink/50">Nothing happens until someone approves</span>
            </>
          ) : status.s === "approved" ? (
            <p className="flex items-center gap-1.5 text-sm text-accent">
              <CheckCircle2 aria-hidden className="size-4" /> Approved{status.by ? ` by ${status.by}` : ""}
            </p>
          ) : status.s === "dismissed" ? (
            <p className="flex items-center gap-1.5 text-sm text-ink/55">
              <CircleSlash aria-hidden className="size-4" /> Dismissed{status.by ? ` by ${status.by}` : ""}
            </p>
          ) : (
            <p className="text-sm text-signal">{status.error ?? "This action failed. Ask the agent again."}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
