"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAppData } from "@/client/app-data";
import { api } from "@/client/api";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/shell/page-header";
import { ChatView } from "./chat-view";

/** One-to-one chat with another person (Nexconn direct channel). */
export function DirectView({ nexconnId }: { nexconnId: string }) {
  const { profiles, addProfiles } = useAppData();
  const profile = profiles[nexconnId];
  const [checked, setChecked] = useState(Boolean(profile));

  useEffect(() => {
    if (profile) return;
    api<{ profiles: { kind: "user" | "agent"; id: string; nexconnId: string; name: string; avatarUrl: string | null; handle: string | null }[] }>(
      `/api/directory?ids=${encodeURIComponent(nexconnId)}`,
    )
      .then((d) => addProfiles(d.profiles))
      .finally(() => setChecked(true));
  }, [profile, nexconnId, addProfiles]);

  if (!profile) {
    return (
      <>
        <PageHeader>
          <h1 className="font-semibold">Direct message</h1>
        </PageHeader>
        <div className="p-10 text-center text-sm text-ink/65">
          {checked ? (
            <>
              You can only message people who share a space with you.{" "}
              <Link href="/app" className="font-medium text-accent hover:underline">
                Back to your spaces
              </Link>
            </>
          ) : (
            "Loading…"
          )}
        </div>
      </>
    );
  }

  if (profile.kind === "agent") {
    return (
      <div className="p-10 text-center text-sm">
        <Link href={`/app/agent/${profile.id}`} className="font-medium text-accent hover:underline">
          Open your chat with {profile.name}
        </Link>
      </div>
    );
  }

  return (
    <>
      <PageHeader>
        <Avatar name={profile.name} src={profile.avatarUrl} size="sm" />
        <h1 className="truncate text-base font-semibold">{profile.name}</h1>
      </PageHeader>
      <ChatView
        channelKey={`d:${nexconnId}`}
        isDirect
        mentionables={[]}
        people={[]}
        placeholder={`Message ${profile.name}`}
        empty={
          <div className="mx-auto max-w-sm text-center">
            <Avatar name={profile.name} src={profile.avatarUrl} size="lg" className="mx-auto" />
            <h2 className="mt-3 text-lg font-semibold">{profile.name}</h2>
            <p className="mt-1 text-sm text-ink/60">This is the start of your private conversation.</p>
          </div>
        }
      />
    </>
  );
}
