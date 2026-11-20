"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, MessageSquare, Pencil, Plus, Trash2, UserPlus, X } from "lucide-react";
import { api, ClientApiError, useResource } from "@/client/api";
import { useAppData } from "@/client/app-data";
import { useToast } from "@/components/ui/toast";
import { Avatar } from "@/components/ui/avatar";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import type { SpaceDetail, Usage } from "./types";

export type PanelTab = "people" | "agents" | "memory" | "settings";

interface MemoryItem {
  id: string;
  kind: "fact" | "decision";
  text: string;
  createdAt: string;
  userName: string | null;
  agentName: string | null;
}

function Meter({ label, usage }: { label: string; usage: Usage }) {
  const pct = Math.min(100, Math.round((usage.used / usage.limit) * 100));
  const near = pct >= 80;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className={`tabular-nums ${near ? "text-signal" : "text-ink/60"}`}>
          {usage.used} of {usage.limit}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/6" role="meter" aria-valuenow={usage.used} aria-valuemin={0} aria-valuemax={usage.limit} aria-label={label}>
        <div className={`h-full rounded-full transition-[width] duration-500 ${near ? "bg-signal" : "bg-accent"}`} style={{ width: `${pct}%` }} />
      </div>
      {usage.resetsAt && near ? (
        <p className="mt-1 text-2xs text-ink/55">Frees up from {new Date(usage.resetsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.</p>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------- */

function PeopleTab({ detail, onInvite, reload }: { detail: SpaceDetail; onInvite: () => void; reload: () => void }) {
  const { me } = useAppData();
  const { push } = useToast();
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <Button variant="secondary" onClick={onInvite} className="w-full">
        <UserPlus aria-hidden className="size-4" /> Invite people
      </Button>
      <ul className="flex flex-col gap-0.5">
        {detail.members.map((m) => (
          <li key={m.id} className="group flex items-center gap-3 rounded-control px-2 py-2 transition-colors hover:bg-paper">
            <Avatar name={m.name} src={m.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {m.name}
                {m.id === me.id ? <span className="font-normal text-ink/50"> (you)</span> : null}
              </p>
              <p className="text-2xs text-ink/50">{m.role === "owner" ? "Owner" : "Member"}</p>
            </div>
            {m.id !== me.id ? (
              <Link href={`/app/dm/${m.nexconnId}`} aria-label={`Message ${m.name}`} title="Message" className="rounded-control p-1.5 text-ink/50 hover:bg-ink/6 hover:text-ink">
                <MessageSquare className="size-4" />
              </Link>
            ) : null}
            {detail.role === "owner" && m.id !== me.id ? (
              <IconButton label={`Remove ${m.name}`} onClick={() => setRemoving({ id: m.id, name: m.name })}>
                <X className="size-4" />
              </IconButton>
            ) : null}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.name}?`}
        description="They'll lose access to this space and its history. You can invite them again later."
        confirmLabel="Remove"
        danger
        loading={busy}
        onConfirm={async () => {
          if (!removing) return;
          setBusy(true);
          try {
            await api(`/api/spaces/${detail.space.id}/members/${removing.id}`, { method: "DELETE" });
            push(`${removing.name} was removed.`);
            reload();
          } catch (err) {
            push(err instanceof ClientApiError ? err.message : "Couldn't remove them.", "error");
          } finally {
            setBusy(false);
            setRemoving(null);
          }
        }}
      />
    </div>
  );
}

function AgentsTab({ detail, reload }: { detail: SpaceDetail; reload: () => void }) {
  const { me } = useAppData();
  const { push } = useToast();
  const gallery = useResource<{ agents: { id: string; name: string; handle: string; tagline: string; avatarUrl: string | null; kind: string }[] }>("/api/agents");
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const available = (gallery.data?.agents ?? []).filter((a) => !detail.agents.some((s) => s.id === a.id));

  async function act(fn: () => Promise<unknown>, key: string, ok?: string) {
    setBusy(key);
    try {
      await fn();
      if (ok) push(ok);
      reload();
    } catch (err) {
      push(err instanceof ClientApiError ? err.message : "Something went wrong.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-1">
        {detail.agents.length === 0 ? <li className="text-sm text-ink/55">No agents in this space. Add one below.</li> : null}
        {detail.agents.map((a) => (
          <li key={a.id} className={`rounded-panel border border-ink/8 bg-surface px-3 py-3 transition-opacity ${a.enabled ? "" : "opacity-70"}`}>
            <div className="flex items-center gap-3">
              <Avatar name={a.name} src={a.avatarUrl} kind="agent" handle={a.handle} seed={a.nexconnId} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">@{a.handle}</p>
                <p className="line-clamp-2 text-2xs text-ink/55">{a.tagline || (a.kind === "custom" ? "Custom agent" : "")}</p>
              </div>
              <Switch
                label={`${a.name} responds in this space`}
                checked={a.enabled}
                disabled={busy === a.id || (detail.role !== "owner")}
                onChange={(v) => act(() => api(`/api/spaces/${detail.space.id}/agents/${a.id}`, { method: "PATCH", json: { enabled: v } }), a.id, v ? `${a.name} will respond again.` : `${a.name} is paused here.`)}
              />
            </div>
            <div className="mt-2.5 flex items-center gap-3 pl-12 text-2xs font-medium">
              <span className={a.enabled ? "text-success" : "text-ink/50"}>{a.enabled ? "Responds" : "Paused"}</span>
              <Link href={`/app/agent/${a.id}`} className="text-ink/60 hover:text-ink hover:underline">
                Message privately
              </Link>
              {detail.role === "owner" ? (
                <button type="button" onClick={() => setRemoving({ id: a.id, name: a.name })} className="text-ink/60 hover:text-signal hover:underline">
                  Remove
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <div>
        <h3 className="mb-2 text-xs font-semibold text-ink/55">Add an agent</h3>
        {gallery.loading && !gallery.data ? (
          <p className="text-sm text-ink/50">Loading agents…</p>
        ) : available.length === 0 ? (
          <p className="text-sm text-ink/55">
            Every agent you can use is already here.{" "}
            <Link href="/app/studio/new" className="font-medium text-accent hover:underline">
              Build a new one
            </Link>
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {available.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-control px-2 py-2 transition-colors hover:bg-paper">
                <Avatar name={a.name} src={a.avatarUrl} kind="agent" handle={a.handle} seed={a.id} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">@{a.handle}</p>
                  <p className="truncate text-2xs text-ink/55">{a.tagline}</p>
                </div>
                <Button size="sm" variant="secondary" loading={busy === `add-${a.id}`} onClick={() => act(() => api(`/api/spaces/${detail.space.id}/agents`, { method: "POST", json: { agentId: a.id } }), `add-${a.id}`, `${a.name} joined the space.`)}>
                  <Plus aria-hidden className="size-3.5" /> Add
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-2xs text-ink/50">{me.id === detail.space.ownerId ? "As the owner you decide which agents respond here." : "Only the owner can pause or remove agents."}</p>
      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.name} from this space?`}
        description="It will stop responding and leave the group. Its earlier messages stay in the history."
        confirmLabel="Remove agent"
        danger
        loading={busy === "remove"}
        onConfirm={async () => {
          if (!removing) return;
          await act(() => api(`/api/spaces/${detail.space.id}/agents/${removing.id}`, { method: "DELETE" }), "remove", `${removing.name} left the space.`);
          setRemoving(null);
        }}
      />
    </div>
  );
}

export function MemoryTab({ spaceId, version }: { spaceId: string; version: number }) {
  const { data, loading, reload } = useResource<{ items: MemoryItem[] }>(`/api/spaces/${spaceId}/memory`);
  const { push } = useToast();
  const [kind, setKind] = useState<"fact" | "decision">("decision");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [deleting, setDeleting] = useState<MemoryItem | null>(null);

  useEffect(() => {
    if (version > 0) void reload();
  }, [version, reload]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    try {
      await api(`/api/spaces/${spaceId}/memory`, { method: "POST", json: { kind, text } });
      setText("");
      await reload();
    } catch (err) {
      push(err instanceof ClientApiError ? err.message : "Couldn't save that.", "error");
    } finally {
      setSaving(false);
    }
  }

  const items = data?.items ?? [];
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink/60">Agents read these facts and decisions before answering in this space.</p>
      <form onSubmit={add} className="flex flex-col gap-2.5 rounded-panel border border-ink/8 bg-paper p-3">
        <div className="flex gap-1" role="radiogroup" aria-label="Memory type">
          {(["decision", "fact"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${kind === k ? "bg-ink text-paper" : "text-ink/60 hover:bg-ink/6"}`}
            >
              {k === "decision" ? "Decision" : "Fact"}
            </button>
          ))}
        </div>
        <Textarea aria-label="Memory text" rows={2} value={text} maxLength={400} onChange={(e) => setText(e.target.value)} placeholder={kind === "decision" ? "We're flying out on May 3." : "Budget is 1,200 EUR per person."} />
        <Button type="submit" size="sm" variant="primary" loading={saving} disabled={!text.trim()} className="self-end">
          <BookmarkPlus aria-hidden className="size-3.5" /> Pin to memory
        </Button>
      </form>
      {loading && !data ? (
        <p className="text-sm text-ink/50">Loading memory…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink/55">Nothing pinned yet. Pin a message from the chat, or add a fact above.</p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="memory-list">
          {items.map((m) => (
            <li key={m.id} className="animate-fade rounded-panel border border-ink/8 bg-surface px-3 py-2.5">
              <div className="flex items-start gap-2">
                <span className={`mt-0.5 shrink-0 rounded-chip px-1.5 py-px text-2xs font-semibold ${m.kind === "decision" ? "bg-[#e5f5ef] text-[#13724f]" : "bg-ink/6 text-ink/65"}`}>
                  {m.kind === "decision" ? "Decision" : "Fact"}
                </span>
                {editing?.id === m.id ? (
                  <form
                    className="flex flex-1 flex-col gap-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        await api(`/api/spaces/${spaceId}/memory/${m.id}`, { method: "PATCH", json: { text: editing.text } });
                        setEditing(null);
                        await reload();
                      } catch (err) {
                        push(err instanceof ClientApiError ? err.message : "Couldn't save.", "error");
                      }
                    }}
                  >
                    <Textarea aria-label="Edit memory" rows={2} value={editing.text} onChange={(e) => setEditing({ id: m.id, text: e.target.value })} />
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                      <Button size="sm" type="submit" variant="primary">
                        Save
                      </Button>
                    </div>
                  </form>
                ) : (
                  <p className="flex-1 text-sm">{m.text}</p>
                )}
              </div>
              {editing?.id !== m.id ? (
                <div className="mt-1.5 flex items-center gap-2 pl-[3.6rem] text-2xs text-ink/50">
                  <span className="flex-1 truncate">{m.agentName ? `Saved by ${m.agentName}${m.userName ? `, approved by ${m.userName}` : ""}` : m.userName ? `Added by ${m.userName}` : ""}</span>
                  <button type="button" aria-label="Edit" onClick={() => setEditing({ id: m.id, text: m.text })} className="rounded p-1 hover:bg-ink/6 hover:text-ink">
                    <Pencil className="size-3.5" />
                  </button>
                  <button type="button" aria-label="Delete" onClick={() => setDeleting(m)} className="rounded p-1 hover:bg-ink/6 hover:text-signal">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this memory?"
        description="Agents will no longer use it as context."
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await api(`/api/spaces/${spaceId}/memory/${deleting.id}`, { method: "DELETE" });
            await reload();
          } catch (err) {
            push(err instanceof ClientApiError ? err.message : "Couldn't delete.", "error");
          }
          setDeleting(null);
        }}
      />
    </div>
  );
}

function SettingsTab({ detail, reload }: { detail: SpaceDetail; reload: () => void }) {
  const router = useRouter();
  const { reloadSpaces } = useAppData();
  const { push } = useToast();
  const isOwner = detail.role === "owner";
  const [name, setName] = useState(detail.space.name);
  const [description, setDescription] = useState(detail.space.description);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<"leave" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);

  async function update(body: Record<string, unknown>, message: string) {
    try {
      await api(`/api/spaces/${detail.space.id}`, { method: "PATCH", json: body });
      push(message);
      reload();
      void reloadSpaces();
    } catch (err) {
      push(err instanceof ClientApiError ? err.message : "Couldn't save.", "error");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {isOwner ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            await update({ name, description }, "Space details saved.");
            setSaving(false);
          }}
        >
          <Field label="Name">{(p) => <Input {...p} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Description" hint="Agents read this as context.">
            {(p) => <Textarea {...p} rows={2} value={description} maxLength={280} onChange={(e) => setDescription(e.target.value)} />}
          </Field>
          <Button type="submit" size="sm" variant="secondary" loading={saving} className="self-end" disabled={!name.trim()}>
            Save details
          </Button>
        </form>
      ) : null}

      <fieldset className="flex flex-col gap-2" disabled={!isOwner}>
        <legend className="mb-1 text-sm font-semibold">When agents reply</legend>
        {(
          [
            ["mention", "Only when mentioned", "Agents stay quiet unless someone @mentions them."],
            ["auto", "Also answer open questions", "An agent may pick up a question nobody addressed, if it clearly fits its skills."],
          ] as const
        ).map(([value, label, hint]) => (
          <label key={value} className={`flex cursor-pointer gap-3 rounded-panel border px-3 py-2.5 transition-colors ${detail.space.replyMode === value ? "border-accent bg-accent/[0.05]" : "border-ink/10 hover:border-ink/20"}`}>
            <input
              type="radio"
              name="replyMode"
              className="mt-1 accent-[var(--accent)]"
              checked={detail.space.replyMode === value}
              onChange={() => update({ replyMode: value }, "Reply setting saved.")}
            />
            <span>
              <span className="block text-sm font-medium">{label}</span>
              <span className="block text-2xs text-ink/55">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold">Approve agent actions</p>
          <p className="text-2xs text-ink/55">Checklists, polls and memory updates wait for a person to approve them.</p>
        </div>
        <Switch label="Require approval for agent actions" checked={detail.space.requireApproval} disabled={!isOwner} onChange={(v) => update({ requireApproval: v }, v ? "Agent actions now need approval." : "Agents can now act without approval.")} />
      </div>
      {!isOwner ? <p className="-mt-3 text-2xs text-ink/50">Only the owner can change these settings.</p> : null}

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold">Agent usage this hour</p>
        <Meter label="Your agent replies" usage={detail.usage.user} />
        {detail.usage.space ? <Meter label="This space" usage={detail.usage.space} /> : null}
      </div>

      <div className="border-t border-ink/10 pt-4">
        {isOwner ? (
          <Button variant="ghost" className="text-signal hover:bg-signal/8" onClick={() => setConfirm("delete")}>
            <Trash2 aria-hidden className="size-4" /> Delete space
          </Button>
        ) : (
          <Button variant="ghost" className="text-signal hover:bg-signal/8" onClick={() => setConfirm("leave")}>
            Leave space
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === "delete" ? `Delete ${detail.space.name}?` : `Leave ${detail.space.name}?`}
        description={
          confirm === "delete"
            ? "This removes the space, its members, cards and memory for everyone. It can't be undone."
            : "You'll stop receiving messages. Someone can invite you again."
        }
        confirmLabel={confirm === "delete" ? "Delete space" : "Leave space"}
        danger
        loading={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            if (confirm === "delete") await api(`/api/spaces/${detail.space.id}`, { method: "DELETE" });
            else await api(`/api/spaces/${detail.space.id}/leave`, { method: "POST" });
            await reloadSpaces();
            router.replace("/app");
          } catch (err) {
            push(err instanceof ClientApiError ? err.message : "Something went wrong.", "error");
            setBusy(false);
            setConfirm(null);
          }
        }}
      />
    </div>
  );
}

export function SpacePanel({
  detail,
  tab,
  onTab,
  onClose,
  onInvite,
  reload,
  memoryVersion,
}: {
  detail: SpaceDetail;
  tab: PanelTab;
  onTab: (t: PanelTab) => void;
  onClose: () => void;
  onInvite: () => void;
  reload: () => void;
  memoryVersion: number;
}) {
  const tabs: [PanelTab, string][] = [
    ["people", `People ${detail.members.length}`],
    ["agents", `Agents ${detail.agents.length}`],
    ["memory", "Memory"],
    ["settings", "Settings"],
  ];
  return (
    <aside aria-label="Space details" className="flex h-full flex-col bg-surface">
      <div className="flex h-14 shrink-0 items-center gap-1 border-b border-ink/8 px-3">
        <div role="tablist" aria-label="Space panel" className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto rounded-control bg-paper p-0.5">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => onTab(key)}
              className={`flex-1 shrink-0 rounded-[7px] px-2 py-1.5 text-xs font-semibold transition-[background-color,color,box-shadow] ${tab === key ? "bg-surface text-ink shadow-lift" : "text-ink/55 hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <IconButton label="Close panel" onClick={onClose}>
          <X className="size-4" />
        </IconButton>
      </div>
      <div role="tabpanel" className="min-h-0 flex-1 animate-fade overflow-y-auto p-4" key={tab}>
        {tab === "people" ? <PeopleTab detail={detail} onInvite={onInvite} reload={reload} /> : null}
        {tab === "agents" ? <AgentsTab detail={detail} reload={reload} /> : null}
        {tab === "memory" ? <MemoryTab spaceId={detail.space.id} version={memoryVersion} /> : null}
        {tab === "settings" ? <SettingsTab key={detail.space.id} detail={detail} reload={reload} /> : null}
      </div>
    </aside>
  );
}
