"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bot, Hash, Home, LogOut, MessageSquarePlus, Plus, Settings, Sparkles } from "lucide-react";
import { useClerk } from "@clerk/nextjs";
import { useAppData } from "@/client/app-data";
import { useChat } from "@/client/chat/store";
import { stopChat } from "@/client/chat/engine";
import { Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { CreateSpaceDialog } from "@/components/spaces/create-space-dialog";
import { NewMessageDialog } from "@/components/shell/new-message-dialog";

function Badge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="ml-auto min-w-5 rounded-full bg-accent px-1.5 text-center text-2xs font-bold leading-5 text-white" aria-label={`${count} unread`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

function NavItem({ href, active, unread = false, children }: { href: string; active: boolean; unread?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group flex h-9 items-center gap-2.5 rounded-control px-2.5 text-sm transition-colors ${
        active ? "bg-surface font-semibold text-ink shadow-lift" : `${unread ? "font-semibold text-ink" : "text-ink/70"} hover:bg-ink/5 hover:text-ink`
      }`}
    >
      {children}
    </Link>
  );
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-1 mt-6 flex h-6 items-center justify-between pl-2.5 pr-1">
      <h2 className="text-xs font-semibold text-ink/50">{children}</h2>
      {action}
    </div>
  );
}

export function Sidebar() {
  const { me, spaces, profiles, ensureProfiles } = useAppData();
  const summaries = useChat((s) => s.summaries);
  const connection = useChat((s) => s.connection);
  const pathname = usePathname();
  const { signOut } = useClerk();
  const [creating, setCreating] = useState(false);
  const [composing, setComposing] = useState(false);

  const directKeys = useMemo(
    () =>
      Object.entries(summaries)
        .filter(([key]) => key.startsWith("d:"))
        .sort((a, b) => b[1].lastTime - a[1].lastTime)
        .map(([key]) => key.slice(2)),
    [summaries],
  );
  useEffect(() => ensureProfiles(directKeys), [directKeys, ensureProfiles]);

  const people = directKeys.filter((id) => profiles[id]?.kind === "user" && id !== me.nexconnId);
  const agentChats = directKeys.filter((id) => profiles[id]?.kind === "agent");

  async function logout() {
    await stopChat().catch(() => undefined);
    await signOut({ redirectUrl: "/login" });
  }

  const statusTone = connection === "connected" ? "bg-success" : connection === "connecting" || connection === "idle" ? "bg-ink/25 animate-working" : "bg-signal";
  const statusLabel = connection === "connected" ? "Connected" : connection === "connecting" || connection === "idle" ? "Connecting" : "Not connected";

  return (
    <nav aria-label="Main" className="flex h-full flex-col bg-paper">
      <div className="flex h-14 shrink-0 items-center gap-2 px-4">
        <Link href="/app" className="rounded-control" aria-label="AgentVerse home">
          <Logo />
        </Link>
        <span className="ml-auto flex items-center gap-1.5 rounded-full px-2 py-1 text-2xs text-ink/50" title={statusLabel}>
          <span aria-hidden className={`size-2 rounded-full ${statusTone}`} />
          <span className="sr-only">{statusLabel}</span>
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-4 pt-2">
        <div className="flex flex-col gap-0.5">
          <NavItem href="/app" active={pathname === "/app"}>
            <Home aria-hidden className="size-4 opacity-80" /> Home
          </NavItem>
          <NavItem href="/app/agents" active={pathname.startsWith("/app/agents") || pathname.startsWith("/app/studio")}>
            <Sparkles aria-hidden className="size-4 opacity-80" /> Agents and Studio
          </NavItem>
        </div>

        <SectionTitle
          action={
            <IconButton label="Create a space" className="size-6" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
            </IconButton>
          }
        >
          Spaces
        </SectionTitle>
        <div className="flex flex-col gap-0.5">
          {spaces === null ? (
            <div className="space-y-2 px-2.5 py-1.5" aria-hidden>
              <div className="skeleton h-4 w-3/4 rounded" />
              <div className="skeleton h-4 w-1/2 rounded" />
            </div>
          ) : spaces.length === 0 ? (
            <button type="button" onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-control px-2.5 py-2 text-left text-sm text-ink/55 transition-colors hover:bg-ink/5 hover:text-ink">
              <Plus aria-hidden className="size-4" /> Create your first space
            </button>
          ) : (
            spaces.map((s) => {
              const unread = summaries[`g:${s.nexconnGroupId}`]?.unread ?? 0;
              return (
                <NavItem key={s.id} href={`/app/s/${s.id}`} active={pathname === `/app/s/${s.id}`} unread={unread > 0}>
                  <Hash aria-hidden className="size-4 shrink-0 opacity-55" />
                  <span className="truncate">{s.name}</span>
                  <Badge count={unread} />
                </NavItem>
              );
            })
          )}
        </div>

        <SectionTitle
          action={
            <IconButton label="New direct message" className="size-6" onClick={() => setComposing(true)}>
              <MessageSquarePlus className="size-4" />
            </IconButton>
          }
        >
          Direct messages
        </SectionTitle>
        <div className="flex flex-col gap-0.5">
          {people.length === 0 ? (
            <p className="px-2.5 py-1 text-sm text-ink/45">Message anyone who shares a space with you.</p>
          ) : (
            people.map((id) => {
              const unread = summaries[`d:${id}`]?.unread ?? 0;
              return (
                <NavItem key={id} href={`/app/dm/${id}`} active={pathname === `/app/dm/${id}`} unread={unread > 0}>
                  <Avatar name={profiles[id]?.name ?? "?"} src={profiles[id]?.avatarUrl} size="xs" />
                  <span className="truncate">{profiles[id]?.name}</span>
                  <Badge count={unread} />
                </NavItem>
              );
            })
          )}
        </div>

        <SectionTitle>Agent chats</SectionTitle>
        <div className="flex flex-col gap-0.5">
          {agentChats.length === 0 ? (
            <Link href="/app/agents" className="flex items-center gap-2 rounded-control px-2.5 py-1.5 text-sm text-ink/45 transition-colors hover:bg-ink/5 hover:text-ink">
              <Bot aria-hidden className="size-4" /> Message an agent privately
            </Link>
          ) : (
            agentChats.map((id) => {
              const p = profiles[id];
              const unread = summaries[`d:${id}`]?.unread ?? 0;
              return (
                <NavItem key={id} href={`/app/agent/${p.id}`} active={pathname === `/app/agent/${p.id}`} unread={unread > 0}>
                  <Avatar name={p.name} src={p.avatarUrl} kind="agent" handle={p.handle} seed={p.nexconnId} size="xs" />
                  <span className="truncate">{p.name}</span>
                  <Badge count={unread} />
                </NavItem>
              );
            })
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5 border-t border-ink/8 px-3 py-3">
        <Avatar name={me.name} src={me.avatarUrl} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{me.name}</p>
          <p className="truncate text-2xs text-ink/50">{me.email}</p>
        </div>
        <Link
          href="/app/settings"
          aria-label="Profile settings"
          title="Profile settings"
          className={`inline-flex size-8 items-center justify-center rounded-control transition-colors hover:bg-ink/6 hover:text-ink ${pathname === "/app/settings" ? "bg-ink/6 text-ink" : "text-ink/60"}`}
        >
          <Settings className="size-4" />
        </Link>
        <IconButton label="Log out" onClick={logout}>
          <LogOut className="size-4" />
        </IconButton>
      </div>

      <CreateSpaceDialog open={creating} onClose={() => setCreating(false)} />
      <NewMessageDialog open={composing} onClose={() => setComposing(false)} />
    </nav>
  );
}
