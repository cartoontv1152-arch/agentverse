"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { useAppData } from "@/client/app-data";
import { api } from "@/client/api";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader, PageTitle } from "@/components/shell/page-header";
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
          <PageTitle title="Direct message" />
        </PageHeader>
        <div className="mx-auto max-w-md px-6 py-16 text-center">
          {checked ? (
            <>
              <p className="font-display text-xl font-semibold">You can&apos;t message this person yet</p>
              <p className="mt-2 text-ink/60">You can message anyone who shares a space with you.</p>
              <Link href="/app" className="mt-5 inline-flex text-sm font-semibold text-accent hover:underline">
                Back to your spaces
              </Link>
            </>
          ) : (
            <div className="mx-auto flex flex-col items-center gap-3" aria-busy="true">
              <div className="skeleton size-12 rounded-full" />
              <div className="skeleton h-4 w-32 rounded" />
            </div>
          )}
        </div>
      </>
    );
  }

  if (profile.kind === "agent") {
    return (
      <div className="p-10 text-center text-sm">
        <Link href={`/app/agent/${profile.id}`} className="font-semibold text-accent hover:underline">
          Open your chat with {profile.name}
        </Link>
      </div>
    );
  }

  return (
    <>
      <PageHeader>
        <Avatar name={profile.name} src={profile.avatarUrl} size="sm" />
        <PageTitle
          title={profile.name}
          subtitle={
            <span className="inline-flex items-center gap-1">
              <Lock aria-hidden className="size-3" /> Direct message
            </span>
          }
        />
      </PageHeader>
      <ChatView
        channelKey={`d:${nexconnId}`}
        isDirect
        mentionables={[]}
        people={[]}
        placeholder={`Message ${profile.name}`}
        empty={
          <div className="mx-auto max-w-sm text-center">
            <Avatar name={profile.name} src={profile.avatarUrl} size="xl" className="mx-auto" />
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.01em]">{profile.name}</h2>
            <p className="mt-1.5 text-ink/60">This is the start of your private conversation. Only the two of you can see it.</p>
          </div>
        }
      />
    </>
  );
}
