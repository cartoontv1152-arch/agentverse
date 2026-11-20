"use client";

import { Menu } from "lucide-react";
import { useAppData } from "@/client/app-data";
import { IconButton } from "@/components/ui/button";
import { useChat } from "@/client/chat/store";

/** Top bar for every app page. On small screens it carries the navigation toggle. */
export function PageHeader({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  const { setSidebarOpen } = useAppData();
  const unread = useChat((s) => Object.values(s.summaries).reduce((n, x) => n + x.unread, 0));
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-ink/8 bg-surface px-3 sm:px-5">
      <div className="relative lg:hidden">
        <IconButton label="Open navigation" onClick={() => setSidebarOpen(true)}>
          <Menu className="size-5" />
        </IconButton>
        {unread > 0 ? <span aria-hidden className="absolute right-1 top-1 size-2 rounded-full bg-accent ring-2 ring-surface" /> : null}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">{children}</div>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </header>
  );
}

/** Title block used inside PageHeader. */
export function PageTitle({ title, subtitle, testId }: { title: string; subtitle?: React.ReactNode; testId?: string }) {
  return (
    <div className="min-w-0">
      <h1 className="truncate font-display text-[1.05rem] font-semibold leading-tight tracking-[-0.01em]" data-testid={testId}>
        {title}
      </h1>
      {subtitle ? <p className="truncate text-2xs text-ink/50">{subtitle}</p> : null}
    </div>
  );
}
