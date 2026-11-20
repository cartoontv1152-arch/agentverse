"use client";

import { useState } from "react";
import { WifiOff, RotateCw } from "lucide-react";
import { useChat } from "@/client/chat/store";
import { retryConnect } from "@/client/chat/engine";

/** Visible only when realtime is not healthy: reconnecting, offline, signed in elsewhere, or failed. */
export function ConnectionBanner() {
  const connection = useChat((s) => s.connection);
  const code = useChat((s) => s.connectionCode);
  const [retrying, setRetrying] = useState(false);

  if (connection === "connected" || connection === "idle" || connection === "connecting") return null;

  const messages: Record<string, string> = {
    reconnecting: "Reconnecting to chat. Messages will appear when the connection is back.",
    suspended: "You're offline. We'll reconnect automatically when your network returns.",
    kicked: "You signed in to AgentVerse somewhere else, so this tab was disconnected.",
    error: `Couldn't connect to chat${code ? ` (code ${code})` : ""}.`,
  };
  const canRetry = connection === "kicked" || connection === "error";

  return (
    <div role="status" className="flex items-center gap-3 border-b border-signal/25 bg-signal/6 px-4 py-2 text-sm text-ink">
      <WifiOff aria-hidden className="size-4 shrink-0 text-signal" />
      <p className="flex-1">{messages[connection]}</p>
      {canRetry ? (
        <button
          type="button"
          disabled={retrying}
          onClick={async () => {
            setRetrying(true);
            await retryConnect().catch(() => undefined);
            setRetrying(false);
          }}
          className="inline-flex items-center gap-1.5 rounded-control px-2 py-1 font-medium text-accent hover:bg-accent/8"
        >
          <RotateCw aria-hidden className={`size-3.5 ${retrying ? "animate-spin" : ""}`} />
          {connection === "kicked" ? "Use this tab" : "Try again"}
        </button>
      ) : null}
    </div>
  );
}
