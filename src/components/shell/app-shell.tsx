"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { AppDataProvider, useAppData, type Me } from "@/client/app-data";
import { ToastProvider } from "@/components/ui/toast";
import { startChat } from "@/client/chat/engine";
import { Sidebar } from "./sidebar";
import { ConnectionBanner } from "./connection-banner";

function ChatBoot() {
  useEffect(() => {
    void startChat().catch((err) => console.warn("[chat] start failed", err));
  }, []);
  return null;
}

function Frame({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, setSidebarOpen } = useAppData();
  const pathname = usePathname();
  useEffect(() => setSidebarOpen(false), [pathname, setSidebarOpen]);
  return (
    <div className="flex h-dvh overflow-hidden bg-paper">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-control focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <div className="hidden w-[272px] shrink-0 border-r border-ink/10 lg:block">
        <Sidebar />
      </div>
      {/* Mobile drawer */}
      {sidebarOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-ink/35" onClick={() => setSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-[300px] border-r border-ink/10 bg-paper">
            <Sidebar />
          </div>
        </div>
      ) : null}
      <main id="main" className="flex min-w-0 flex-1 flex-col">
        <ConnectionBanner />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </main>
    </div>
  );
}

export function AppShell({ me, children }: { me: Me; children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AppDataProvider initialMe={me}>
        <ChatBoot />
        <Frame>{children}</Frame>
      </AppDataProvider>
    </ToastProvider>
  );
}
