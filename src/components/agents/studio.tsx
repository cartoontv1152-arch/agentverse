"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImageUp, Loader2, Play, RotateCcw, Trash2 } from "lucide-react";
import { api, ClientApiError, limitHint } from "@/client/api";
import { PageHeader } from "@/components/shell/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Textarea } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Markdown } from "@/components/chat/markdown";
import type { ProposalPayload } from "@/lib/message-types";
import { TOOL_INFO, type PublicAgentView } from "./types";

const TOOLS = ["search", "tasks", "polls", "summarize"] as const;
type Tool = (typeof TOOLS)[number];

interface Draft {
  name: string;
  handle: string;
  tagline: string;
  instructions: string;
  tools: Tool[];
  avatarUrl: string | null;
}

interface ConsoleTurn {
  role: "user" | "agent";
  text: string;
  status?: string | null;
  sources?: { n: number; title: string; url: string }[];
  proposals?: { summary: string; proposal: ProposalPayload }[];
  error?: string | null;
  pending?: boolean;
}

function handleFrom(name: string) {
  const cleaned = name.replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
  return /^[A-Za-z]/.test(cleaned) ? cleaned.slice(0, 24) : "";
}

function TestConsole({ agentId, draft, name }: { agentId: string | null; draft: Draft; name: string }) {
  const [turns, setTurns] = useState<ConsoleTurn[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  async function run() {
    const message = input.trim();
    if (!message || !agentId || running) return;
    setInput("");
    setRunning(true);
    const history = turns.filter((t) => !t.pending && !t.error).map((t) => ({ role: t.role, text: t.text }));
    setTurns((t) => [...t, { role: "user", text: message }, { role: "agent", text: "", pending: true, status: "Starting" }]);
    const update = (fn: (t: ConsoleTurn) => ConsoleTurn) =>
      setTurns((all) => {
        const next = all.slice();
        next[next.length - 1] = fn(next[next.length - 1]);
        return next;
      });
    try {
      const res = await fetch(`/api/agents/${agentId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history, draft: { name: draft.name, instructions: draft.instructions, tools: draft.tools, tagline: draft.tagline } }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        const err = new ClientApiError(res.status, data?.error?.code ?? "error", data?.error?.message ?? "The test failed.", data?.error?.details);
        update((t) => ({ ...t, pending: false, error: `${err.message} ${limitHint(err) ?? ""}`.trim() }));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as Record<string, unknown>;
          if (ev.type === "status") update((t) => ({ ...t, status: (ev.detail as string) ?? String(ev.state) }));
          else if (ev.type === "text") update((t) => ({ ...t, text: t.text + String(ev.delta) }));
          else if (ev.type === "proposal")
            update((t) => ({ ...t, proposals: [...(t.proposals ?? []), { summary: String(ev.summary), proposal: ev.proposal as ProposalPayload }] }));
          else if (ev.type === "sources") update((t) => ({ ...t, sources: ev.sources as ConsoleTurn["sources"] }));
          else if (ev.type === "error") update((t) => ({ ...t, error: String(ev.message) }));
          else if (ev.type === "done") update((t) => ({ ...t, pending: false, status: null }));
        }
        scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
      }
      update((t) => ({ ...t, pending: false, status: null }));
    } catch {
      update((t) => ({ ...t, pending: false, error: "Connection lost while testing. Try again." }));
    } finally {
      setRunning(false);
    }
  }

  return (
    <section aria-labelledby="console-heading" className="flex min-h-[420px] flex-col rounded-panel border border-ink/12 bg-surface lg:h-full">
      <div className="flex items-center gap-2 border-b border-ink/10 px-4 py-3">
        <h2 id="console-heading" className="flex-1 text-sm font-semibold">
          Test console
        </h2>
        {turns.length ? (
          <Button size="sm" variant="ghost" onClick={() => setTurns([])} disabled={running}>
            <RotateCcw aria-hidden className="size-3.5" /> Clear
          </Button>
        ) : null}
      </div>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-3" data-testid="test-console">
        {!agentId ? (
          <p className="text-sm text-ink/60">Save the agent to start testing. Tests use the real model and tools, with your unsaved edits applied.</p>
        ) : turns.length === 0 ? (
          <p className="text-sm text-ink/60">Ask {name || "your agent"} something. Nothing is posted to any chat; proposals are shown as previews.</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {turns.map((t, i) => (
              <li key={i} className="flex gap-2.5">
                <Avatar name={t.role === "user" ? "You" : name || "Agent"} kind={t.role === "agent" ? "agent" : "user"} size="sm" src={t.role === "agent" ? draft.avatarUrl : null} />
                <div className="min-w-0 flex-1 text-sm">
                  {t.text ? <Markdown text={t.text} /> : null}
                  {t.proposals?.map((p, j) => (
                    <div key={j} className="mt-2 rounded-control border border-accent/35 bg-accent/5 px-3 py-2 text-xs">
                      <span className="font-semibold text-accent">Would propose:</span> {p.summary}
                    </div>
                  ))}
                  {t.sources?.length ? (
                    <ol className="mt-2 flex flex-col gap-1 text-xs">
                      {t.sources.map((s) => (
                        <li key={s.n}>
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                            [{s.n}] {s.title}
                          </a>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  {t.pending ? (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-ink/55">
                      <Loader2 aria-hidden className="size-3 animate-spin" /> {t.status ?? "Working"}
                    </p>
                  ) : null}
                  {t.error ? <p className="mt-1 text-xs text-signal">{t.error}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      <form
        className="flex gap-2 border-t border-ink/10 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <Input aria-label="Test message" disabled={!agentId || running} value={input} onChange={(e) => setInput(e.target.value)} placeholder={agentId ? "Ask your agent something" : "Save first to test"} />
        <Button type="submit" variant="primary" disabled={!agentId || running || !input.trim()} loading={running}>
          {!running ? <Play aria-hidden className="size-4" /> : null} Run
        </Button>
      </form>
    </section>
  );
}

export function Studio({ agent }: { agent: PublicAgentView | null }) {
  const router = useRouter();
  const { push } = useToast();
  const [draft, setDraft] = useState<Draft>({
    name: agent?.name ?? "",
    handle: agent?.handle ?? "",
    tagline: agent?.tagline ?? "",
    instructions: agent?.instructions ?? "",
    tools: (agent?.tools.filter((t): t is Tool => (TOOLS as readonly string[]).includes(t)) ?? ["search"]) as Tool[],
    avatarUrl: agent?.avatarUrl ?? null,
  });
  const [handleTouched, setHandleTouched] = useState(Boolean(agent));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (file.size > 2 * 1024 * 1024) return push("Images must be 2 MB or smaller.", "error");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/uploads/avatar", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Upload failed.");
      setDraft((d) => ({ ...d, avatarUrl: data.url }));
    } catch (err) {
      push(err instanceof Error ? err.message : "Upload failed.", "error");
    } finally {
      setUploading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!draft.name.trim()) errs.name = "Name your agent.";
    if (!/^[A-Za-z][A-Za-z0-9]{1,23}$/.test(draft.handle)) errs.handle = "2 to 24 letters or digits, starting with a letter.";
    if (draft.instructions.trim().length < 10) errs.instructions = "Describe how the agent should behave (at least 10 characters).";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    setFormError(null);
    try {
      if (agent) {
        await api(`/api/agents/${agent.id}`, { method: "PATCH", json: draft });
        push("Agent saved.", "success");
        router.refresh();
      } else {
        const res = await api<{ agent: PublicAgentView }>("/api/agents", { method: "POST", json: draft });
        push(`${res.agent.name} is ready. Test it, then add it to a space.`, "success");
        router.replace(`/app/studio/${res.agent.id}`);
      }
    } catch (err) {
      if (err instanceof ClientApiError && typeof err.details?.field === "string") setErrors({ [err.details.field]: err.message });
      else setFormError(err instanceof ClientApiError ? err.message : "Couldn't save the agent.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader>
        <Link href="/app/agents" aria-label="Back to agents" className="rounded-control p-1.5 text-ink/60 hover:bg-ink/6 hover:text-ink">
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="truncate text-base font-semibold">{agent ? `Studio: ${agent.name}` : "Build an agent"}</h1>
      </PageHeader>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-8 lg:h-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <form onSubmit={save} className="flex flex-col gap-5" noValidate>
            <FormError message={formError} />
            <div className="flex items-center gap-4">
              <Avatar name={draft.name || "Agent"} src={draft.avatarUrl} kind="agent" size="xl" />
              <div className="flex flex-col gap-2">
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" aria-label="Upload avatar" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                <Button size="sm" variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>
                  {!uploading ? <ImageUp aria-hidden className="size-4" /> : null} Upload avatar
                </Button>
                {draft.avatarUrl ? (
                  <button type="button" onClick={() => setDraft((d) => ({ ...d, avatarUrl: null }))} className="text-left text-xs text-ink/55 hover:text-ink">
                    Remove image
                  </button>
                ) : (
                  <p className="text-2xs text-ink/50">PNG, JPG, WebP or GIF up to 2 MB.</p>
                )}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" error={errors.name}>
                {(p) => (
                  <Input
                    {...p}
                    value={draft.name}
                    maxLength={40}
                    placeholder="Trip Concierge"
                    onChange={(e) => {
                      const name = e.target.value;
                      setDraft((d) => ({ ...d, name, handle: handleTouched ? d.handle : handleFrom(name) }));
                    }}
                  />
                )}
              </Field>
              <Field label="Handle" error={errors.handle} hint="People type @handle to mention it.">
                {(p) => (
                  <div className="relative">
                    <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/45">@</span>
                    <Input
                      {...p}
                      className="pl-7"
                      value={draft.handle}
                      maxLength={24}
                      onChange={(e) => {
                        setHandleTouched(true);
                        setDraft((d) => ({ ...d, handle: e.target.value.replace(/[^A-Za-z0-9]/g, "") }));
                      }}
                    />
                  </div>
                )}
              </Field>
            </div>
            <Field label="Short description" hint="Shown in mention suggestions and the gallery.">
              {(p) => <Input {...p} value={draft.tagline} maxLength={120} placeholder="Finds stays and keeps the trip plan on track." onChange={(e) => setDraft((d) => ({ ...d, tagline: e.target.value }))} />}
            </Field>
            <Field label="Persona and instructions" error={errors.instructions} hint="How it should behave, what it knows, its tone. It also sees the conversation and space memory.">
              {(p) => (
                <Textarea
                  {...p}
                  rows={8}
                  maxLength={4000}
                  value={draft.instructions}
                  placeholder="You are the group's travel concierge. Suggest stays and day plans within the budget in space memory. Keep answers short and practical."
                  onChange={(e) => setDraft((d) => ({ ...d, instructions: e.target.value }))}
                />
              )}
            </Field>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">What it may do</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {TOOLS.map((tool) => {
                  const checked = draft.tools.includes(tool);
                  return (
                    <label key={tool} className={`flex cursor-pointer gap-3 rounded-control border px-3 py-2.5 ${checked ? "border-accent bg-accent/5" : "border-ink/14 hover:border-ink/30"}`}>
                      <input
                        type="checkbox"
                        className="mt-1 accent-[var(--accent)]"
                        checked={checked}
                        onChange={(e) => setDraft((d) => ({ ...d, tools: e.target.checked ? [...d.tools, tool] : d.tools.filter((t) => t !== tool) }))}
                      />
                      <span>
                        <span className="block text-sm font-medium">{TOOL_INFO[tool].label}</span>
                        <span className="block text-2xs text-ink/55">{TOOL_INFO[tool].description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 pt-4">
              <Button type="submit" variant="primary" loading={saving}>
                {agent ? "Save changes" : "Create agent"}
              </Button>
              {agent ? (
                <Button variant="ghost" className="ml-auto text-signal hover:bg-signal/8" onClick={() => setConfirmDelete(true)}>
                  <Trash2 aria-hidden className="size-4" /> Delete agent
                </Button>
              ) : null}
            </div>
          </form>
          <TestConsole agentId={agent?.id ?? null} draft={draft} name={draft.name} />
        </div>
      </div>
      {agent ? (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title={`Delete ${agent.name}?`}
          description="It leaves every space it's in. Its earlier messages stay in the history. This can't be undone."
          confirmLabel="Delete agent"
          danger
          loading={deleting}
          onConfirm={async () => {
            setDeleting(true);
            try {
              await api(`/api/agents/${agent.id}`, { method: "DELETE" });
              push(`${agent.name} was deleted.`);
              router.replace("/app/agents");
            } catch (err) {
              push(err instanceof ClientApiError ? err.message : "Couldn't delete.", "error");
              setDeleting(false);
            }
          }}
        />
      ) : null}
    </>
  );
}
