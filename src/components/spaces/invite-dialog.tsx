"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2Off, RefreshCw } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api, ClientApiError } from "@/client/api";
import { useToast } from "@/components/ui/toast";

interface Invite {
  id: string;
  code: string;
  expiresAt: string;
  uses: number;
}

export function InviteDialog({ spaceId, spaceName, open, onClose }: { spaceId: string; spaceName: string; open: boolean; onClose: () => void }) {
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    setError(null);
    setLoading(true);
    api<{ invite: Invite | null }>(`/api/spaces/${spaceId}/invites`)
      .then(async (d) => d.invite ?? (await api<{ invite: Invite }>(`/api/spaces/${spaceId}/invites`, { method: "POST" })).invite)
      .then(setInvite)
      .catch((err) => setError(err instanceof ClientApiError ? err.message : "Couldn't create an invite link."))
      .finally(() => setLoading(false));
  }, [open, spaceId]);

  const url = invite && typeof window !== "undefined" ? `${window.location.origin}/join/${invite.code}` : "";

  async function regenerate(revokeOld: boolean) {
    setLoading(true);
    try {
      if (revokeOld && invite) await api(`/api/spaces/${spaceId}/invites/${invite.id}`, { method: "DELETE" });
      const d = await api<{ invite: Invite }>(`/api/spaces/${spaceId}/invites`, { method: "POST" });
      setInvite(d.invite);
      setCopied(false);
      if (revokeOld) push("Old link turned off. Share the new one.");
    } catch (err) {
      push(err instanceof ClientApiError ? err.message : "Couldn't update the link.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Invite people to ${spaceName}`} description="Anyone with this link can join, including people who don't have an account yet.">
      {error ? <p className="text-sm text-signal">{error}</p> : null}
      <div className="flex gap-2">
        <input
          readOnly
          aria-label="Invite link"
          value={loading && !invite ? "Creating link…" : url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-10 min-w-0 flex-1 rounded-control border border-ink/18 bg-surface px-3 text-sm text-ink/80"
          data-testid="invite-link"
        />
        <Button
          variant="primary"
          disabled={!invite}
          onClick={async () => {
            await navigator.clipboard.writeText(url).catch(() => undefined);
            setCopied(true);
          }}
        >
          {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
      {invite ? (
        <p className="mt-2 text-xs text-ink/55">
          Expires {new Date(invite.expiresAt).toLocaleDateString([], { month: "long", day: "numeric" })}. Used {invite.uses} {invite.uses === 1 ? "time" : "times"}.
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-2 border-t border-ink/10 pt-4">
        <Button size="sm" variant="ghost" disabled={loading} onClick={() => regenerate(false)}>
          <RefreshCw aria-hidden className="size-3.5" /> New link
        </Button>
        <Button size="sm" variant="ghost" disabled={loading || !invite} onClick={() => regenerate(true)}>
          <Link2Off aria-hidden className="size-3.5" /> Turn off this link
        </Button>
      </div>
    </Dialog>
  );
}
